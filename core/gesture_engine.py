import numpy as np
from collections import deque

class GestureEngine:
    def __init__(self):
        self.prev_point = None
        self.swipe_threshold = 0.02
        self.buffer = deque(maxlen=5)  # temporal window

    def update(self, landmarks):
        if landmarks is None:
            self.prev_point = None
            self.buffer.clear()
            return None

        current_point = np.array(landmarks[8][:2])

        if self.prev_point is None:
            self.prev_point = current_point
            return None

        velocity = current_point - self.prev_point
        speed = np.linalg.norm(velocity)

        dx, dy = velocity
        self.prev_point = current_point

        detected = None

        if speed > self.swipe_threshold:
            if abs(dx) > abs(dy):
                if dx > 0:
                    detected = "SWIPE RIGHT"
                else:
                    detected = "SWIPE LEFT"

        # Add to temporal buffer
        self.buffer.append(detected)

        # Count consistent detections
        if self.buffer.count("SWIPE RIGHT") >= 3:
            self.buffer.clear()
            return "SWIPE RIGHT"

        if self.buffer.count("SWIPE LEFT") >= 3:
            self.buffer.clear()
            return "SWIPE LEFT"

        return None
