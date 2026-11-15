"""
ZeroTouch DICOM Viewer Module
Handles multi-frame/multi-slice DICOM series, continuous zoom, windowing (brightness/contrast),
panning (ROI positioning), and smooth interpolation.
Features modality-aware clinical viewing presets and adaptive sensitivity scaling.
"""

import os
import cv2
import numpy as np
import pydicom
from typing import List, Optional, Dict, Any


class DICOMViewer:
    """
    DICOM image loading and manipulation engine.
    Supports:
    - Multi-slice 3D volumes (e.g. sample_dicom_files CT or MRBRAIN.DCM) and cine series
    - Continuous zoom with boundary clamping
    - Window Center / Window Width brightness & contrast adjustment with adaptive scaling
    - 2D Panning (moving region of interest horizontally/vertically)
    - Modality-aware active viewing window presets (CT vs MR)
    - Smooth parameter transitions (EMA)
    """

    # Standard CT presets (Hounsfield Units: HU)
    CT_PRESETS = [
        {"name": "BRAIN", "wc": 40.0, "ww": 80.0},
        {"name": "BONE", "wc": 500.0, "ww": 2000.0},
        {"name": "SOFT TISSUE", "wc": 50.0, "ww": 350.0},
        {"name": "LUNG", "wc": -600.0, "ww": 1500.0},
    ]

    def __init__(self, dicom_folder: str = "assets"):
        self.datasets: List[pydicom.Dataset] = []
        self.slice_index: int = 0
        self.total_slices: int = 1

        # Zoom
        self.zoom_scale: float = 1.0
        self.target_zoom: float = 1.0
        self.min_zoom: float = 0.3
        self.max_zoom: float = 4.0

        # Panning offsets (pixels relative to canvas center)
        self.pan_x: float = 0.0
        self.pan_y: float = 0.0
        self.target_pan_x: float = 0.0
        self.target_pan_y: float = 0.0

        # Load DICOM files
        self._load_dicom_data(dicom_folder)

        # Min / max range
        self.pixel_min = float(np.min(self.pixel_data))
        self.pixel_max = float(np.max(self.pixel_data))
        self.pixel_range = max(self.pixel_max - self.pixel_min, 1.0)

        # Detect modality
        self.modality = getattr(self.current_volume, "Modality", "US") if self.current_volume else "GEN"

        # Determine native Window Center & Window Width from dataset header or dynamic range
        wc_header = getattr(self.current_volume, "WindowCenter", None) if self.current_volume else None
        ww_header = getattr(self.current_volume, "WindowWidth", None) if self.current_volume else None

        if wc_header is not None and ww_header is not None:
            try:
                native_wc = float(wc_header[0] if isinstance(wc_header, (list, pydicom.multival.MultiValue)) else wc_header)
                native_ww = float(ww_header[0] if isinstance(ww_header, (list, pydicom.multival.MultiValue)) else ww_header)
            except Exception:
                native_wc = (self.pixel_min + self.pixel_max) / 2.0
                native_ww = self.pixel_range
        else:
            native_wc = (self.pixel_min + self.pixel_max) / 2.0
            native_ww = self.pixel_range

        self.native_wc = native_wc
        self.native_ww = native_ww

        self.window_center = native_wc
        self.window_width = max(native_ww, 1.0)
        self.target_window_center = self.window_center
        self.target_window_width = self.window_width

        # Configure presets tailored to modality and dynamic range
        self._init_presets()
        self.preset_index: int = 0

        # Smoothing coefficient (EMA)
        self.alpha = 0.25

    def _init_presets(self):
        """Sets up clinical presets appropriate for US, CT, MR, or general modalities."""
        if self.modality == "CT":
            # Standard Hounsfield Unit presets
            self.presets = [
                {"name": "NATIVE / DEFAULT", "wc": self.native_wc, "ww": self.native_ww},
                {"name": "BRAIN", "wc": 40.0, "ww": 80.0},
                {"name": "BONE", "wc": 500.0, "ww": 2000.0},
                {"name": "SOFT TISSUE", "wc": 50.0, "ww": 350.0},
                {"name": "LUNG", "wc": -600.0, "ww": 1500.0},
            ]
        elif self.modality in ("US", "XA"):
            # Ultrasound & Angiography (8-bit calibrated presets designed to never blow out)
            self.presets = [
                {"name": "DEFAULT / NATIVE", "wc": 128.0, "ww": 256.0},
                {"name": "HIGH CONTRAST", "wc": 135.0, "ww": 170.0},
                {"name": "BRIGHT GAIN", "wc": 110.0, "ww": 220.0},
                {"name": "SHADOW DETAIL", "wc": 155.0, "ww": 210.0},
                {"name": "SMOOTH DYNAMIC", "wc": 128.0, "ww": 300.0},
            ]
        else:
            # MR / General: scale proportionally to actual pixel dynamic range
            mid = (self.pixel_min + self.pixel_max) / 2.0
            rng = self.pixel_range
            self.presets = [
                {"name": "NATIVE / DEFAULT", "wc": self.native_wc, "ww": self.native_ww},
                {"name": "FULL DYNAMIC", "wc": mid, "ww": rng},
                {"name": "HIGH CONTRAST", "wc": self.native_wc, "ww": max(self.native_ww * 0.6, 10.0)},
                {"name": "WIDE / SOFT", "wc": self.native_wc, "ww": self.native_ww * 1.8},
            ]

    @property
    def PRESETS(self):
        """Backward-compatibility alias."""
        return self.presets

    def _load_dicom_data(self, dicom_folder: str):
        """
        Loads actual clinical DICOM series (prioritizing genuine medical scans in assets/).
        Specifically supports multi-frame Ultrasound (0020.DCM with PALETTE COLOR LUT),
        Angiography (0003.DCM), MR (MRBRAIN.DCM), and multi-slice CT series.
        """
        from pydicom.pixel_data_handlers.util import apply_color_lut

        # Prioritize 0020.DCM (Echocardiogram Ultrasound) or files directly in assets/
        priority_files = ["0020.DCM", "0020.dcm", "0003.DCM", "0003.dcm", "MRBRAIN.DCM", "mrbrain.dcm"]
        chosen_path = None
        for pf in priority_files:
            candidate = os.path.join(dicom_folder, pf)
            if os.path.exists(candidate):
                chosen_path = candidate
                break

        if chosen_path and os.path.exists(chosen_path):
            try:
                ds = pydicom.dcmread(chosen_path)
                self.current_volume = ds
                self.datasets = [ds]

                # Check Photometric Interpretation for PALETTE COLOR
                photo = getattr(ds, "PhotometricInterpretation", "")
                if photo == "PALETTE COLOR":
                    rgb_lut = apply_color_lut(ds.pixel_array, ds)
                    # Convert uint16 to uint8 if needed
                    if rgb_lut.dtype == np.uint16:
                        rgb_8 = (rgb_lut >> 8).astype(np.uint8)
                    else:
                        rgb_8 = rgb_lut.astype(np.uint8)

                    # OpenCV displays in BGR
                    if len(rgb_8.shape) == 4:  # (frames, H, W, 3)
                        bgr_frames = [cv2.cvtColor(rgb_8[i], cv2.COLOR_RGB2BGR) for i in range(rgb_8.shape[0])]
                        self.pixel_data = np.stack(bgr_frames, axis=0).astype(np.float32)
                        self.total_slices = rgb_8.shape[0]
                    else:
                        bgr = cv2.cvtColor(rgb_8, cv2.COLOR_RGB2BGR)
                        self.pixel_data = bgr[np.newaxis, :, :].astype(np.float32)
                        self.total_slices = 1
                    print(f"ZeroTouch: Loaded authentic PALETTE COLOR medical DICOM '{os.path.basename(chosen_path)}' ({self.total_slices} frames).")
                    return
                else:
                    raw_pixels = ds.pixel_array.astype(np.float32)
                    if len(raw_pixels.shape) == 3:
                        self.pixel_data = raw_pixels
                        self.total_slices = raw_pixels.shape[0]
                    elif len(raw_pixels.shape) == 2:
                        self.pixel_data = raw_pixels[np.newaxis, :, :]
                        self.total_slices = 1
                    else:
                        self.pixel_data = raw_pixels
                        self.total_slices = 1
                    print(f"ZeroTouch: Loaded clinical DICOM '{os.path.basename(chosen_path)}' ({self.total_slices} slices).")
                    return
            except Exception as e:
                print(f"ZeroTouch: Failed loading priority DICOM {chosen_path}: {e}")

        # Fallback to scanning folder
        candidates = []
        if os.path.exists(dicom_folder):
            for file in sorted(os.listdir(dicom_folder)):
                if file.lower().endswith(".dcm"):
                    candidates.append(os.path.join(dicom_folder, file))

        if not candidates:
            # Check sample_dicom_files subfolder
            sample_subfolder = os.path.join(dicom_folder, "sample_dicom_files")
            if os.path.exists(sample_subfolder):
                for file in sorted(os.listdir(sample_subfolder)):
                    if file.lower().endswith(".dcm"):
                        candidates.append(os.path.join(sample_subfolder, file))

        if not candidates:
            print("ZeroTouch Warning: No DICOM files found. Generating in-memory test volume.")
            self.pixel_data = np.zeros((10, 512, 512), dtype=np.float32)
            for i in range(10):
                cv2.circle(self.pixel_data[i], (256, 256), 50 + i * 15, (i + 1) * 20, -1)
            self.total_slices = 10
            self.current_volume = None
            return

        # Check if multiple slice files exist in folder
        if len(candidates) > 1 and all(pydicom.dcmread(c).pixel_array.ndim == 2 for c in candidates[:3]):
            try:
                loaded = [pydicom.dcmread(p) for p in candidates]
                self.datasets = loaded
                self.current_volume = loaded[0]
                self.pixel_data = np.stack([ds.pixel_array.astype(np.float32) for ds in loaded], axis=0)
                self.total_slices = len(loaded)
                return
            except Exception as e:
                print(f"ZeroTouch: Fallback slice stack failed: {e}")

        # Fallback to first candidate
        chosen_path = candidates[0]
        try:
            self.current_volume = pydicom.dcmread(chosen_path)
            raw_pixels = self.current_volume.pixel_array.astype(np.float32)
            if len(raw_pixels.shape) == 3:
                self.pixel_data = raw_pixels
                self.total_slices = raw_pixels.shape[0]
            else:
                self.pixel_data = raw_pixels[np.newaxis, :, :]
                self.total_slices = 1
        except Exception as e:
            print(f"ZeroTouch: Error loading fallback DICOM {chosen_path}: {e}")
            self.pixel_data = np.zeros((10, 512, 512), dtype=np.float32)
            self.total_slices = 10
            self.current_volume = None

    # -----------------------------
    # Slice Navigation
    # -----------------------------
    def next_slice(self):
        if self.total_slices > 1:
            self.slice_index = (self.slice_index + 1) % self.total_slices

    def prev_slice(self):
        if self.total_slices > 1:
            self.slice_index = (self.slice_index - 1) % self.total_slices

    # -----------------------------
    # Continuous & Step Zoom
    # -----------------------------
    def adjust_zoom(self, delta_multiplier: float):
        scale_change = 1.0 + delta_multiplier
        self.target_zoom = np.clip(self.target_zoom * scale_change, self.min_zoom, self.max_zoom)

    def zoom_in(self):
        self.target_zoom = min(self.target_zoom * 1.15, self.max_zoom)

    def zoom_out(self):
        self.target_zoom = max(self.target_zoom * 0.85, self.min_zoom)

    # -----------------------------
    # Window Control (Brightness / Contrast)
    # -----------------------------
    def adjust_window_center(self, delta: float):
        """
        Adjusts window center (brightness).
        Scales delta dynamically relative to pixel dynamic range so adjustments feel
        responsive across 8-bit (0-255), 12-bit (0-2150), and 16-bit CT (-1000 to +3000).
        """
        # Base scale: 1 tick in 0-255 space is ~15 units (approx 6% of range)
        dynamic_factor = max(self.pixel_range / 300.0, 1.0)
        scaled_delta = delta * dynamic_factor
        self.target_window_center = np.clip(
            self.target_window_center + scaled_delta,
            self.pixel_min - self.pixel_range * 0.5,
            self.pixel_max + self.pixel_range * 0.5
        )

    def adjust_window_width(self, delta: float):
        dynamic_factor = max(self.pixel_range / 300.0, 1.0)
        scaled_delta = delta * dynamic_factor
        self.target_window_width = np.clip(
            self.target_window_width + scaled_delta,
            5.0,
            self.pixel_range * 3.0
        )

    def cycle_viewing_window(self, direction: int = 1) -> str:
        """Cycles clinical viewing window presets (direction=+1 for next, -1 for prev)."""
        self.preset_index = (self.preset_index + direction) % len(self.presets)
        preset = self.presets[self.preset_index]
        self.target_window_center = preset["wc"]
        self.target_window_width = preset["ww"]
        return preset["name"]

    def next_preset(self) -> str:
        return self.cycle_viewing_window(direction=1)

    def prev_preset(self) -> str:
        return self.cycle_viewing_window(direction=-1)

    # -----------------------------
    # Image Panning (ROI Movement)
    # -----------------------------
    def pan(self, dx: float, dy: float):
        max_pan = 250.0 * self.zoom_scale
        self.target_pan_x = np.clip(self.target_pan_x + dx, -max_pan, max_pan)
        self.target_pan_y = np.clip(self.target_pan_y + dy, -max_pan, max_pan)

    def reset_viewport(self):
        """Resets viewport back to native calibrated baseline."""
        self.target_zoom = 1.0
        self.target_pan_x = 0.0
        self.target_pan_y = 0.0
        self.slice_index = 0
        self.target_window_center = self.native_wc
        self.target_window_width = self.native_ww
        self.preset_index = 0

    # -----------------------------
    # Apply Smoothing
    # -----------------------------
    def apply_smoothing(self):
        self.window_center = (self.window_center * (1.0 - self.alpha) + self.target_window_center * self.alpha)
        self.window_width = (self.window_width * (1.0 - self.alpha) + self.target_window_width * self.alpha)
        self.zoom_scale = (self.zoom_scale * (1.0 - self.alpha) + self.target_zoom * self.alpha)
        # Higher alpha for pan ensures responsive, instant feedback without laggy drag feeling
        pan_alpha = 0.50
        self.pan_x = (self.pan_x * (1.0 - pan_alpha) + self.target_pan_x * pan_alpha)
        self.pan_y = (self.pan_y * (1.0 - pan_alpha) + self.target_pan_y * pan_alpha)

    # -----------------------------
    # Rendering
    # -----------------------------
    def get_current_frame(self, canvas_size: int = 600) -> np.ndarray:
        self.apply_smoothing()

        if len(self.pixel_data.shape) in (3, 4) and self.total_slices > 1:
            slice_img = self.pixel_data[self.slice_index]
        else:
            slice_img = self.pixel_data[0] if len(self.pixel_data.shape) in (3, 4) else self.pixel_data

        lower = self.window_center - self.window_width / 2.0
        upper = self.window_center + self.window_width / 2.0
        denom = max(upper - lower, 1e-4)

        norm_img = np.clip(slice_img, lower, upper)
        norm_img = ((norm_img - lower) / denom * 255.0).astype(np.uint8)

        # Determine slice dimensions (support 2D grayscale or 3D BGR)
        is_color = (len(norm_img.shape) == 3 and norm_img.shape[2] == 3)
        h, w = norm_img.shape[:2]
        new_w = max(int(w * self.zoom_scale), 1)
        new_h = max(int(h * self.zoom_scale), 1)

        interp = cv2.INTER_LINEAR if self.zoom_scale >= 1.0 else cv2.INTER_AREA
        resized = cv2.resize(norm_img, (new_w, new_h), interpolation=interp)

        if is_color:
            canvas = np.zeros((canvas_size, canvas_size, 3), dtype=np.uint8)
        else:
            canvas = np.zeros((canvas_size, canvas_size), dtype=np.uint8)

        # Center position adjusted by panning
        base_x = (canvas_size - new_w) // 2 + int(self.pan_x)
        base_y = (canvas_size - new_h) // 2 + int(self.pan_y)

        src_x1 = max(0, -base_x)
        src_y1 = max(0, -base_y)
        src_x2 = min(new_w, canvas_size - base_x)
        src_y2 = min(new_h, canvas_size - base_y)

        dst_x1 = max(0, base_x)
        dst_y1 = max(0, base_y)
        dst_x2 = dst_x1 + (src_x2 - src_x1)
        dst_y2 = dst_y1 + (src_y2 - src_y1)

        if dst_x2 > dst_x1 and dst_y2 > dst_y1 and src_x2 > src_x1 and src_y2 > src_y1:
            canvas[dst_y1:dst_y2, dst_x1:dst_x2] = resized[src_y1:src_y2, src_x1:src_x2]

        return canvas
