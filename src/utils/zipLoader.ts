/**
 * 0Touch DICOM Zip Extractor
 * Unpacks .zip archives in-memory, discovers all nested .dcm / .dicom files,
 * and passes them directly to the DICOM parser.
 */

import JSZip from 'jszip';

export interface ExtractedDicomFile {
  name: string;
  buffer: ArrayBuffer;
}

export async function extractDicomFilesFromZip(zipBuffer: ArrayBuffer): Promise<ExtractedDicomFile[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const dicomFiles: ExtractedDicomFile[] = [];

  const entries = Object.keys(zip.files);
  for (const path of entries) {
    const file = zip.files[path];
    if (file.dir) continue;

    const lower = file.name.toLowerCase();
    // Exclude OS metadata (e.g. __MACOSX)
    if (file.name.includes('__MACOSX') || file.name.startsWith('.')) continue;

    // Check if filename ends with dcm or is a typical DICOM slice name
    const isDcm = lower.endsWith('.dcm') || lower.endsWith('.dicom') || !lower.includes('.');

    if (isDcm) {
      const buffer = await file.async('arraybuffer');
      // Verify DICOM magic bytes 'DICM' at offset 128 if file size >= 132
      if (buffer.byteLength >= 132) {
        const u8 = new Uint8Array(buffer, 128, 4);
        const magic = String.fromCharCode(...u8);
        if (magic === 'DICM' || lower.endsWith('.dcm') || lower.endsWith('.dicom')) {
          const simpleName = file.name.split('/').pop() || file.name;
          dicomFiles.push({ name: simpleName, buffer });
        }
      }
    }
  }

  return dicomFiles;
}
