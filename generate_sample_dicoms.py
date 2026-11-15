"""
Sample DICOM Series Generator for ZeroTouch
Generates a realistic multi-slice phantom CT/MRI dataset with anatomical structures,
metadata, window center/width tags, and slice numbering.
"""

import os
import numpy as np
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
import datetime


def generate_sample_dicoms(output_dir="assets/sample_dicom_files", num_slices=20, size=512):
    """
    Creates synthetic axial brain CT/MRI phantom slices in standard DICOM format.
    """
    os.makedirs(output_dir, exist_ok=True)
    print(f"Generating {num_slices} sample DICOM slices in '{output_dir}'...")

    study_instance_uid = generate_uid()
    series_instance_uid = generate_uid()

    center = size // 2

    for i in range(num_slices):
        filename = os.path.join(output_dir, f"slice_{i:03d}.dcm")

        # 1. File Meta Information
        file_meta = FileMetaDataset()
        file_meta.MediaStorageSOPClassUID = pydicom.uid.CTImageStorage
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        file_meta.ImplementationClassUID = "1.2.826.0.1.3680043.8.498.1"

        # 2. Main Dataset
        ds = FileDataset(filename, {}, file_meta=file_meta, preamble=b"\0" * 128)
        ds.PatientName = "ZeroTouch^Phantom"
        ds.PatientID = "ZT-2026-MED"
        ds.StudyDate = datetime.date.today().strftime("%Y%m%d")
        ds.StudyTime = datetime.datetime.now().strftime("%H%M%S")
        ds.Modality = "CT"
        ds.StudyDescription = "ZeroTouch Calibration & Testing Phantom"
        ds.SeriesDescription = "Axial Brain 5mm"
        ds.StudyInstanceUID = study_instance_uid
        ds.SeriesInstanceUID = series_instance_uid
        ds.SOPClassUID = pydicom.uid.CTImageStorage
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.InstanceNumber = i + 1

        ds.Rows = size
        ds.Columns = size
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 0  # Unsigned

        # Standard window level and width for CT brain
        ds.WindowCenter = 400
        ds.WindowWidth = 800
        ds.RescaleIntercept = "0"
        ds.RescaleSlope = "1"

        # 3. Create synthetic anatomical image slice
        # Create coordinate grid
        y, x = np.ogrid[:size, :size]
        dist_from_center = np.sqrt((x - center) ** 2 + (y - center) ** 2)

        # Base background
        img = np.zeros((size, size), dtype=np.uint16)

        # Elliptical skull boundary with slice-dependent cross section
        slice_radius = int(180 * np.sin((i + 1) / (num_slices + 2) * np.pi) + 30)
        skull_mask = dist_from_center <= slice_radius
        inner_skull_mask = dist_from_center <= (slice_radius - 12)

        # Skull bone (dense, high intensity: ~900)
        img[skull_mask] = 850
        # Brain parenchyma (medium intensity: ~400)
        img[inner_skull_mask] = 380

        # Ventricles (CSF, lower intensity: ~180)
        v_offset = 25
        v_left = np.sqrt((x - (center - v_offset)) ** 2 + (y - center) ** 2) < 22
        v_right = np.sqrt((x - (center + v_offset)) ** 2 + (y - center) ** 2) < 22
        img[inner_skull_mask & (v_left | v_right)] = 180

        # Synthetic lesion/target feature in middle slices for interaction confirmation
        if 6 <= i <= 14:
            lesion_dist = np.sqrt((x - (center + 60)) ** 2 + (y - (center - 50)) ** 2)
            lesion_mask = lesion_dist < (12 + (i - 6) * 1.5)
            img[inner_skull_mask & lesion_mask] = 620

        # Add minor procedural texture noise
        noise = (np.random.normal(0, 10, (size, size))).astype(np.int32)
        img_with_noise = np.clip(img.astype(np.int32) + noise, 0, 4095).astype(np.uint16)

        ds.PixelData = img_with_noise.tobytes()

        # Save DICOM file
        ds.save_as(filename, write_like_original=False)

    print(f"Successfully generated {num_slices} DICOM slices in '{output_dir}'.")


if __name__ == "__main__":
    generate_sample_dicoms()
