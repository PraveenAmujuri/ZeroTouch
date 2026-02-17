import cv2
import numpy as np
import pydicom
import os


class DICOMViewer:
    def __init__(self, dicom_folder="assets"):
        self.datasets = []
        self.slice_index = 0

        # Zoom
        self.zoom_scale = 1.0
        self.target_zoom = 1.0

        # Load DICOM files
        for file in os.listdir(dicom_folder):
            if file.lower().endswith(".dcm"):
                path = os.path.join(dicom_folder, file)
                ds = pydicom.dcmread(path)
                self.datasets.append(ds)

        if not self.datasets:
            raise ValueError("No DICOM files found.")

        self.current_volume = self.datasets[0]
        self.pixel_data = self.current_volume.pixel_array.astype(np.float32)

        if len(self.pixel_data.shape) == 3:
            self.total_slices = self.pixel_data.shape[0]
        else:
            self.total_slices = 1

        # -----------------------------
        # Auto Window Initialization
        # -----------------------------
        min_val = np.min(self.pixel_data)
        max_val = np.max(self.pixel_data)

        self.window_center = (min_val + max_val) / 2
        self.window_width = max(max_val - min_val, 1)

        self.target_window_center = self.window_center
        self.target_window_width = self.window_width

        print("Initial WC:", self.window_center)
        print("Initial WW:", self.window_width)

        # Smoothing factor
        self.alpha = 0.15

    # -----------------------------
    # Slice Navigation
    # -----------------------------
    def next_slice(self):
        if self.total_slices > 1:
            self.slice_index = (self.slice_index + 1) % self.total_slices
            print("Slice:", self.slice_index)

    def prev_slice(self):
        if self.total_slices > 1:
            self.slice_index = (self.slice_index - 1) % self.total_slices
            print("Slice:", self.slice_index)

    # -----------------------------
    # Zoom
    # -----------------------------
    def zoom_in(self):
        self.target_zoom = min(self.target_zoom * 1.15, 4.0)

    def zoom_out(self):
        self.target_zoom = max(self.target_zoom * 0.85, 0.3)

    # -----------------------------
    # Window Control (Target Only)
    # -----------------------------
    def adjust_window_center(self, delta):
        self.target_window_center += delta

    def adjust_window_width(self, delta):
        self.target_window_width += delta
        self.target_window_width = np.clip(self.target_window_width, 10, 1000)

    # -----------------------------
    # Apply Smoothing
    # -----------------------------
    def apply_smoothing(self):
        self.window_center = (
            self.window_center * (1 - self.alpha)
            + self.target_window_center * self.alpha
        )

        self.window_width = (
            self.window_width * (1 - self.alpha)
            + self.target_window_width * self.alpha
        )

        self.zoom_scale = (
            self.zoom_scale * (1 - self.alpha)
            + self.target_zoom * self.alpha
        )

    # -----------------------------
    # Rendering
    # -----------------------------
    def get_current_frame(self):

        # Apply smoothing every frame
        self.apply_smoothing()

        image = self.pixel_data

        if len(image.shape) == 3:
            image = image[self.slice_index]

        image = image.astype(np.float32)

        lower = self.window_center - self.window_width / 2
        upper = self.window_center + self.window_width / 2

        image = np.clip(image, lower, upper)

        denom = max((upper - lower), 1e-5)

        image = (image - lower) / denom
        image = (image * 255).astype(np.uint8)

        # Zoom
        h, w = image.shape
        new_w = max(int(w * self.zoom_scale), 1)
        new_h = max(int(h * self.zoom_scale), 1)

        resized = cv2.resize(
            image,
            (new_w, new_h),
            interpolation=cv2.INTER_NEAREST
        )

        canvas_size = 600
        canvas = np.zeros((canvas_size, canvas_size), dtype=np.uint8)

        if new_w <= canvas_size and new_h <= canvas_size:
            x_offset = (canvas_size - new_w) // 2
            y_offset = (canvas_size - new_h) // 2
            canvas[y_offset:y_offset+new_h,
                   x_offset:x_offset+new_w] = resized
            return canvas

        start_x = max((new_w - canvas_size) // 2, 0)
        start_y = max((new_h - canvas_size) // 2, 0)

        cropped = resized[
            start_y:start_y+canvas_size,
            start_x:start_x+canvas_size
        ]

        return cropped
