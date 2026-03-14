import numpy as np
from collections import deque
import time


class GestureEngine:

    def __init__(self):

        self.history = deque(maxlen=12)

        self.state = "IDLE"

        self.arm_start = None
        self.arm_time = 0.7

        self.swipe_threshold = 0.10
        self.vertical_threshold = 0.08

        self.last_pinch_dist = None

    # -------------------------
    # Finger Detection
    # -------------------------

    def get_finger_state(self, landmarks):

        tips = [8, 12, 16, 20]
        pips = [6, 10, 14, 18]

        fingers = []

        for tip, pip in zip(tips, pips):

            if landmarks[tip][1] < landmarks[pip][1]:
                fingers.append(1)
            else:
                fingers.append(0)

        return fingers

    # -------------------------
    # Update
    # -------------------------

    def update(self, landmarks):

        if landmarks is None:
            self.history.clear()
            self.last_pinch_dist = None
            return None

        fingers = self.get_finger_state(landmarks)

        index = np.array(landmarks[8][:2])
        thumb = np.array(landmarks[4][:2])

        pinch_dist = np.linalg.norm(index - thumb)

        self.history.append(index)

        if len(self.history) < 10:
            return None

        points = np.array(self.history)

        start = np.mean(points[:5], axis=0)
        end = np.mean(points[-5:], axis=0)

        diff = end - start
        dx, dy = diff

        # -------------------------
        # ARM SYSTEM (TWO FINGERS)
        # -------------------------

        if self.state == "IDLE":

            # index + middle finger open
            if fingers == [1,1,0,0]:

                if self.arm_start is None:
                    self.arm_start = time.time()

                elif time.time() - self.arm_start > self.arm_time:
                    self.state = "ARMED"
                    self.history.clear()
                    print("SYSTEM ARMED")

            else:
                self.arm_start = None

            return None

        # -------------------------
        # INDEX FINGER SWIPES
        # -------------------------

        if self.state == "ARMED" and fingers == [1,0,0,0]:

            if abs(dx) > self.swipe_threshold and abs(dx) > abs(dy):

                self.state = "IDLE"
                self.history.clear()

                if dx > 0:
                    print("NEXT SLICE")
                    return "SWIPE RIGHT"
                else:
                    print("PREV SLICE")
                    return "SWIPE LEFT"

            if abs(dy) > self.vertical_threshold and abs(dy) > abs(dx):

                self.state = "IDLE"
                self.history.clear()

                print("BRIGHTNESS CONTROL")
                return ("BRIGHTNESS", dy)

        # -------------------------
        # PINCH ZOOM
        # -------------------------

        if self.state == "ARMED":

            if self.last_pinch_dist is None:
                self.last_pinch_dist = pinch_dist
                return None

            change = pinch_dist - self.last_pinch_dist
            self.last_pinch_dist = pinch_dist

            PINCH_THRESHOLD = 0.015

            if abs(change) > PINCH_THRESHOLD:

                self.state = "IDLE"
                self.history.clear()

                if change > 0:
                    print("ZOOM IN")
                    return "ZOOM IN"
                else:
                    print("ZOOM OUT")
                    return "ZOOM OUT"

        return None