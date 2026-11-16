/**
 * 0Touch DICOM Parser & Multi-frame Volume Decoder
 * Robust support for:
 * - MONOCHROME1 and MONOCHROME2 (8-bit and 16-bit, signed/unsigned)
 * - PALETTE COLOR with Red/Green/Blue Palette Color Lookup Tables (US Cine, e.g. 0020.DCM)
 * - Multi-frame Cine studies and single-frame slices
 */

import dicomParser from 'dicom-parser';

export interface DecodedDICOMFrame {
  width: number;
  height: number;
  frameIndex: number;
  totalFrames: number;
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept: number;
  rescaleSlope: number;
  photometricInterpretation: string;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  getPixelValue: (x: number, y: number) => { raw: number; rescaled: number } | null;
  renderToCanvas: (canvas: HTMLCanvasElement, customWc?: number, customWw?: number, invert?: boolean) => void;
}

export interface DICOMStudyMeta {
  patientName: string;
  patientId: string;
  patientBirthDate?: string;
  patientSex?: string;
  modality: string;
  studyDate: string;
  studyTime?: string;
  seriesDescription: string;
  studyDescription?: string;
  institutionName?: string;
  manufacturer?: string;
  kvp?: string;
  sliceThickness?: string;
  pixelSpacing?: string;
  instanceNumber: number;
  rows: number;
  columns: number;
  numberOfFrames: number;
  frames: DecodedDICOMFrame[];
}

export function parseDICOMBuffer(arrayBuffer: ArrayBuffer, fileName: string): DICOMStudyMeta {
  const byteArray = new Uint8Array(arrayBuffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const patientName = dataSet.string('x00100010') || 'ANONYMOUS';
  const patientId = dataSet.string('x00100020') || 'N/A';
  const patientBirthDate = dataSet.string('x00100030');
  const patientSex = dataSet.string('x00100040');
  const modality = dataSet.string('x00080060') || 'OT';
  const studyDate = dataSet.string('x00080020') || 'N/A';
  const studyTime = dataSet.string('x00080030');
  const seriesDescription = dataSet.string('x0008103e') || fileName;
  const studyDescription = dataSet.string('x00081030');
  const institutionName = dataSet.string('x00080080');
  const manufacturer = dataSet.string('x00080070');
  const kvp = dataSet.string('x00180060');
  const sliceThickness = dataSet.string('x00180050');
  const pixelSpacing = dataSet.string('x00280030');
  const instanceNumber = dataSet.intString('x00200013') || 1;

  const rows = dataSet.uint16('x00280010') || 512;
  const columns = dataSet.uint16('x00280011') || 512;
  const numberOfFrames = dataSet.intString('x00280008') || 1;
  const bitsAllocated = dataSet.uint16('x00280100') || 16;
  const bitsStored = dataSet.uint16('x00280101') || bitsAllocated;
  const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0 = unsigned, 1 = signed
  const samplesPerPixel = dataSet.uint16('x00280002') || 1;
  const photometric = (dataSet.string('x00280004') || 'MONOCHROME2').trim().toUpperCase();

  // Window center / width
  let windowCenter = 128;
  let windowWidth = 256;
  const wcStr = dataSet.string('x00281050');
  const wwStr = dataSet.string('x00281051');
  if (wcStr) windowCenter = parseFloat(wcStr.split('\\')[0]) || 128;
  if (wwStr) windowWidth = parseFloat(wwStr.split('\\')[0]) || 256;

  const rescaleIntercept = dataSet.floatString('x00281052') || 0;
  const rescaleSlope = dataSet.floatString('x00281053') || 1;

  // Check for PALETTE COLOR Lookup Tables (x00281101..x00281103 descriptor, x00281201..x00281203 data)
  let redLut: Uint8Array | null = null;
  let greenLut: Uint8Array | null = null;
  let blueLut: Uint8Array | null = null;

  if (photometric === 'PALETTE COLOR') {
    const redElement = dataSet.elements.x00281201;
    const greenElement = dataSet.elements.x00281202;
    const blueElement = dataSet.elements.x00281203;

    if (redElement && greenElement && blueElement) {
      const redDesc = dataSet.uint16('x00281101') || 256;
      const numEntries = redDesc === 0 ? 65536 : redDesc;
      const lutBits = dataSet.uint16('x00281101', 2) || 8;

      const extractLutChannel = (elem: any): Uint8Array => {
        const rawBytes = byteArray.subarray(elem.dataOffset, elem.dataOffset + elem.length);
        const channel = new Uint8Array(numEntries);
        if (lutBits === 16 || rawBytes.length >= numEntries * 2) {
          // 16-bit little-endian entries:
          // Low byte is rawBytes[i * 2], High byte is rawBytes[i * 2 + 1]
          for (let i = 0; i < numEntries; i++) {
            channel[i] = rawBytes[i * 2 + 1]; // Take upper 8 bits
          }
        } else {
          // 8-bit entries
          for (let i = 0; i < numEntries; i++) {
            channel[i] = rawBytes[i];
          }
        }
        return channel;
      };

      redLut = extractLutChannel(redElement);
      greenLut = extractLutChannel(greenElement);
      blueLut = extractLutChannel(blueElement);
    }
  }

  // Pixel data element
  const pixelDataElement = dataSet.elements.x7fe00010;
  if (!pixelDataElement) {
    throw new Error('No pixel data element (7FE0,0010) found in DICOM file');
  }

  const pixelDataOffset = pixelDataElement.dataOffset;
  const bytesPerPixel = Math.ceil(bitsAllocated / 8);
  const frameLength = rows * columns * samplesPerPixel * bytesPerPixel;

  const frames: DecodedDICOMFrame[] = [];

  for (let f = 0; f < numberOfFrames; f++) {
    const frameOffset = pixelDataOffset + f * frameLength;
    const frameBytes = byteArray.subarray(frameOffset, frameOffset + frameLength);

    const frame: DecodedDICOMFrame = {
      width: columns,
      height: rows,
      frameIndex: f,
      totalFrames: numberOfFrames,
      windowCenter,
      windowWidth,
      rescaleIntercept,
      rescaleSlope,
      photometricInterpretation: photometric,
      bitsAllocated,
      bitsStored,
      pixelRepresentation,
      getPixelValue: (x: number, y: number) => {
        if (x < 0 || x >= columns || y < 0 || y >= rows) return null;
        const index = y * columns + x;
        if (bitsAllocated === 8) {
          const raw = frameBytes[index] ?? 0;
          return { raw, rescaled: raw * rescaleSlope + rescaleIntercept };
        } else {
          const buffer = frameBytes.buffer;
          const byteOffset = frameBytes.byteOffset;
          const length = rows * columns;
          const pixels =
            pixelRepresentation === 1
              ? new Int16Array(buffer, byteOffset, length)
              : new Uint16Array(buffer, byteOffset, length);
          const raw = pixels[index] ?? 0;
          return { raw, rescaled: raw * rescaleSlope + rescaleIntercept };
        }
      },
      renderToCanvas: (canvas, customWc, customWw, invert = false) => {
        canvas.width = columns;
        canvas.height = rows;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imgData = ctx.createImageData(columns, rows);
        const data = imgData.data;

        // 1. PALETTE COLOR (e.g. Ultrasound 0020.DCM)
        if (photometric === 'PALETTE COLOR' && redLut && greenLut && blueLut) {
          const numPixels = rows * columns;
          for (let i = 0, j = 0; i < numPixels; i++, j += 4) {
            const indexVal = frameBytes[i];
            data[j] = redLut[indexVal];
            data[j + 1] = greenLut[indexVal];
            data[j + 2] = blueLut[indexVal];
            data[j + 3] = 255;
          }
        }
        // 2. RGB Direct
        else if (samplesPerPixel === 3) {
          for (let i = 0, j = 0; i < frameBytes.length; i += 3, j += 4) {
            data[j] = frameBytes[i];
            data[j + 1] = frameBytes[i + 1];
            data[j + 2] = frameBytes[i + 2];
            data[j + 3] = 255;
          }
        }
        // 3. 8-Bit Grayscale
        else if (bitsAllocated === 8) {
          const wc = customWc !== undefined ? customWc : windowCenter;
          const ww = customWw !== undefined ? customWw : windowWidth;
          const halfWw = ww / 2;
          const minVal = wc - halfWw;

          for (let i = 0, j = 0; i < frameBytes.length; i++, j += 4) {
            let val = frameBytes[i];
            if (photometric === 'MONOCHROME1') val = 255 - val;
            let intensity = Math.round(((val - minVal) / ww) * 255);
            intensity = Math.max(0, Math.min(255, intensity));
            if (invert) intensity = 255 - intensity;

            data[j] = intensity;
            data[j + 1] = intensity;
            data[j + 2] = intensity;
            data[j + 3] = 255;
          }
        }
        // 4. 16-Bit Grayscale (Uint16 or Int16)
        else {
          const wc = customWc !== undefined ? customWc : windowCenter;
          const ww = customWw !== undefined ? customWw : windowWidth;
          const halfWw = ww / 2;
          const minVal = wc - halfWw;

          const buffer = frameBytes.buffer;
          const byteOffset = frameBytes.byteOffset;
          const length = rows * columns;

          let pixels: Int16Array | Uint16Array;
          if (pixelRepresentation === 1) {
            pixels = new Int16Array(buffer, byteOffset, length);
          } else {
            pixels = new Uint16Array(buffer, byteOffset, length);
          }

          for (let i = 0, j = 0; i < length; i++, j += 4) {
            let raw = pixels[i];
            let val = raw * rescaleSlope + rescaleIntercept;
            if (photometric === 'MONOCHROME1') val = -val;

            let intensity = Math.round(((val - minVal) / ww) * 255);
            intensity = Math.max(0, Math.min(255, intensity));
            if (invert) intensity = 255 - intensity;

            data[j] = intensity;
            data[j + 1] = intensity;
            data[j + 2] = intensity;
            data[j + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
      },
    };

    frames.push(frame);
  }

  return {
    patientName,
    patientId,
    patientBirthDate,
    patientSex,
    modality,
    studyDate,
    studyTime,
    seriesDescription,
    studyDescription,
    institutionName,
    manufacturer,
    kvp,
    sliceThickness,
    pixelSpacing,
    instanceNumber,
    rows,
    columns,
    numberOfFrames,
    frames,
  };
}
