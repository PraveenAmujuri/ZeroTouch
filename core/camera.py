"""
ZeroTouch Camera Capture and Two-Hand Tracking Module
Captures webcam video, runs MediaPipe Hands with max_num_hands=2,
sorts hands consistently by screen position (Left Hand / Right Hand),
and renders visual skeleton connections.
"""

import cv2
import mediapipe as mp
import numpy as np
import time
from typing import Optional, Tuple, List, Dict, Any
from core.config import CameraConfig, config


class ZeroTouchCamera:
    """
    Two-Hand Camera acquisition and MediaPipe Hands tracking interface.
    Supports:
    - Tracking 2 hands simultaneously at chest level
    - Spatial classification: Left Hand (user's left) vs Right Hand (user's right)
    - Consistent mirrored coordinate system
    - Optional low-light enhancement
    """
    def __init__(self, camera_config: Optional[CameraConfig] = None):
        self.cfg = camera_config or config.camera
        self.cap = cv2.VideoCapture(self.cfg.device_index)

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.cfg.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.cfg.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.cfg.fps)

        self.clahe = cv2.createCLAHE(
            clipLimit=self.cfg.clahe_clip_limit,
            tileGridSize=self.cfg.clahe_tile_grid
        )

        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=self.cfg.max_num_hands,
            min_detection_confidence=self.cfg.min_detection_confidence,
            min_tracking_confidence=self.cfg.min_tracking_confidence
        )
        self.mp_draw = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

        self.prev_frame_time = time.time()
        self.fps = 0.0
        self.mean_brightness = 128.0
        self.clahe_applied = False

    def is_opened(self) -> bool:
        return self.cap.isOpened()

    def preprocess(self, frame: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = self.clahe.apply(l)
        lab = cv2.merge((l, a, b))
        return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    def process_frame(self) -> Tuple[Optional[np.ndarray], List[Dict[str, Any]]]:
        """
        Captures frame, flips horizontally for natural mirror interaction,
        tracks up to 2 hands, sorts them by screen x (left-to-right),
        and returns:
            (annotated_frame, tracked_hands_list)
        where each item in tracked_hands_list is:
            {
                'landmarks': [(x, y, z), ...],
                'centroid_x': float,
                'centroid_y': float,
                'screen_side': 'LEFT' or 'RIGHT'
            }
        """
        ret, frame = self.cap.read()
        if not ret or frame is None:
            return None, []

        current_time = time.time()
        dt = current_time - self.prev_frame_time
        if dt > 0:
            self.fps = 0.9 * self.fps + 0.1 * (1.0 / dt)
        self.prev_frame_time = current_time

        # Natural mirror flip
        if self.cfg.flip_horizontal:
            frame = cv2.flip(frame, 1)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        self.mean_brightness = float(np.mean(gray))

        self.clahe_applied = False
        if self.cfg.enable_clahe and self.mean_brightness < self.cfg.low_light_threshold:
            tracking_frame = self.preprocess(frame)
            self.clahe_applied = True
        else:
            tracking_frame = frame

        rgb = cv2.cvtColor(tracking_frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb)

        tracked_hands: List[Dict[str, Any]] = []

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Draw skeleton
                self.mp_draw.draw_landmarks(
                    frame,
                    hand_landmarks,
                    self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing_styles.get_default_hand_landmarks_style(),
                    self.mp_drawing_styles.get_default_hand_connections_style()
                )

                lms = [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark]
                cx = float(np.mean([pt[0] for pt in lms]))
                cy = float(np.mean([pt[1] for pt in lms]))

                tracked_hands.append({
                    'landmarks': lms,
                    'centroid_x': cx,
                    'centroid_y': cy
                })

            # Sort hands left-to-right based on screen x coordinate (mirrored view)
            # The hand with smaller centroid_x is on the screen LEFT (user's left)
            # The hand with larger centroid_x is on the screen RIGHT (user's right)
            tracked_hands.sort(key=lambda h: h['centroid_x'])
            if len(tracked_hands) == 1:
                # If only one hand is visible, assign by screen side
                side = 'LEFT' if tracked_hands[0]['centroid_x'] < 0.5 else 'RIGHT'
                tracked_hands[0]['screen_side'] = side
            elif len(tracked_hands) >= 2:
                tracked_hands[0]['screen_side'] = 'LEFT'
                tracked_hands[1]['screen_side'] = 'RIGHT'
                # Limit to 2 primary hands
                tracked_hands = tracked_hands[:2]

        return frame, tracked_hands

    def release(self):
        if self.cap.isOpened():
            self.cap.release()
        cv2.destroyAllWindows()
