import cv2
import os

class ImageViewer:
    def __init__(self, image_folder="assets"):
        self.images = []
        self.index = 0
        self.zoom_scale = 1.0

        if os.path.exists(image_folder):
            for file in os.listdir(image_folder):
                if file.lower().endswith((".png", ".jpg", ".jpeg")):
                    self.images.append(
                        cv2.imread(os.path.join(image_folder, file))
                    )

        if not self.images:
            raise ValueError("No images found in assets folder")

    def next_image(self):
        self.index = (self.index + 1) % len(self.images)
        print("Switched to image index:", self.index)

    def prev_image(self):
        self.index = (self.index - 1) % len(self.images)
        print("Switched to image index:", self.index)

    def zoom_in(self):
        self.zoom_scale *= 1.1
        print("Zoom scale:", self.zoom_scale)

    def zoom_out(self):
        self.zoom_scale *= 0.9
        print("Zoom scale:", self.zoom_scale)


    def get_current_frame(self):
        image = self.images[self.index]
        h, w = image.shape[:2]

        resized = cv2.resize(
            image,
            (int(w * self.zoom_scale), int(h * self.zoom_scale))
        )

        return resized
