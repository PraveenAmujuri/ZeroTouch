import cv2
import mediapipe as mp
import numpy as np

class ZeroTouchCamera:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp.solutions.drawing_utils

    def preprocess(self, frame):
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = self.clahe.apply(l)
        lab = cv2.merge((l, a, b))
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return None, None

        frame = cv2.flip(frame, 1)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)

        # If too dark → enhance
        if mean_brightness < 60:
            frame = self.preprocess(frame)

        # If too bright → mild normalization
        elif mean_brightness > 200:
            frame = cv2.convertScaleAbs(frame, alpha=0.9, beta=-10)


        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb)

        landmarks_data = None

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                self.mp_draw.draw_landmarks(
                    frame,
                    hand_landmarks,
                    self.mp_hands.HAND_CONNECTIONS
                )

                # Extract normalized landmark coordinates
                landmarks_data = [
                    (lm.x, lm.y, lm.z)
                    for lm in hand_landmarks.landmark
                ]

        return frame, landmarks_data


    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()
