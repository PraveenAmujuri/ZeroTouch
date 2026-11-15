"""
ZeroTouch Landmark Processing and Feature Extraction Module
Provides OneEuroFilter smoothing and invariant anatomical posture classification (FIST vs OPEN HAND).
Supports single-hand and two-hand scenarios.
"""

import math
import numpy as np
from typing import List, Tuple, Optional, Dict, Any


class OneEuroFilter:
    """
    1€ Filter: Adaptive low-pass filter for noisy human tracking input.
    Provides low latency during fast motion and high jitter reduction at low speeds.
    Casiez et al., CHI 2012.
    """
    def __init__(self, t0: float, x0: np.ndarray, min_cutoff: float = 1.0, beta: float = 0.05, d_cutoff: float = 1.0):
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.x_prev = np.array(x0, dtype=np.float64)
        self.dx_prev = np.zeros_like(self.x_prev)
        self.t_prev = float(t0)

    def _smoothing_factor(self, dt: float, cutoff: np.ndarray) -> np.ndarray:
        r = 2.0 * math.pi * cutoff * dt
        return r / (r + 1.0)

    def __call__(self, t: float, x: np.ndarray) -> np.ndarray:
        dt = max(t - self.t_prev, 1e-4)
        self.t_prev = t

        d_x = (x - self.x_prev) / dt
        alpha_d = self._smoothing_factor(dt, np.full_like(d_x, self.d_cutoff))
        self.dx_prev = alpha_d * d_x + (1.0 - alpha_d) * self.dx_prev

        cutoff = self.min_cutoff + self.beta * np.abs(self.dx_prev)
        alpha = self._smoothing_factor(dt, cutoff)

        self.x_prev = alpha * x + (1.0 - alpha) * self.x_prev
        return self.x_prev.copy()


class LandmarkProcessor:
    """
    Processes MediaPipe 21 hand landmarks:
    - 1€ filter smoothing per tracked hand
    - Anatomical hand scale (palm reference size: wrist to MCP bases)
    - Posture classification: OPEN_HAND vs CLOSED_FIST vs UNCERTAIN
    - Chest-level positional tracking
    """
    # MediaPipe Landmark IDs
    WRIST = 0
    THUMB_CMC = 1
    THUMB_MCP = 2
    THUMB_IP = 3
    THUMB_TIP = 4
    INDEX_MCP = 5
    INDEX_PIP = 6
    INDEX_DIP = 7
    INDEX_TIP = 8
    MIDDLE_MCP = 9
    MIDDLE_PIP = 10
    MIDDLE_DIP = 11
    MIDDLE_TIP = 12
    RING_MCP = 13
    RING_PIP = 14
    RING_DIP = 15
    RING_TIP = 16
    PINKY_MCP = 17
    PINKY_PIP = 18
    PINKY_DIP = 19
    PINKY_TIP = 20

    def __init__(self, min_cutoff: float = 1.2, beta: float = 0.5, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff
        # Separate filters for left and right hands (or hand index 0 and 1)
        self.filters_map: Dict[int, List[OneEuroFilter]] = {}
        self.last_timestamps: Dict[int, float] = {}

    def reset(self, hand_idx: Optional[int] = None):
        """Reset temporal filters upon hand tracking loss."""
        if hand_idx is None:
            self.filters_map.clear()
            self.last_timestamps.clear()
        else:
            self.filters_map.pop(hand_idx, None)
            self.last_timestamps.pop(hand_idx, None)

    def smooth_landmarks(self, landmarks: List[Tuple[float, float, float]], timestamp: float, hand_idx: int = 0) -> np.ndarray:
        """
        Applies OneEuroFilter to all 21 hand landmarks in 3D for a specific hand.
        """
        coords = np.array(landmarks, dtype=np.float64)

        if hand_idx not in self.filters_map or len(self.filters_map[hand_idx]) != 21:
            self.filters_map[hand_idx] = [
                OneEuroFilter(timestamp, coords[i], self.min_cutoff, self.beta, self.d_cutoff)
                for i in range(21)
            ]
            self.last_timestamps[hand_idx] = timestamp
            return coords

        smoothed = np.zeros_like(coords)
        for i in range(21):
            smoothed[i] = self.filters_map[hand_idx][i](timestamp, coords[i])
        self.last_timestamps[hand_idx] = timestamp
        return smoothed

    @staticmethod
    def get_palm_scale(landmarks: np.ndarray) -> float:
        """
        Calculates hand scale invariant to camera distance.
        Uses distance from Wrist (0) to Middle Finger MCP (9) and MCP span.
        """
        wrist = landmarks[0, :2]
        mid_mcp = landmarks[9, :2]
        idx_mcp = landmarks[5, :2]
        pinky_mcp = landmarks[17, :2]

        d_wrist_mid = float(np.linalg.norm(mid_mcp - wrist))
        d_mcp_span = float(np.linalg.norm(idx_mcp - pinky_mcp))

        scale = max(d_wrist_mid, d_mcp_span * 1.1)
        return max(scale, 0.03)

    @classmethod
    def get_finger_states(cls, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Calculates whether each finger is extended or folded using hand-relative geometry.
        Returns detailed finger states and posture classification ('HAND', 'FIST', 'NEUTRAL').
        """
        wrist = landmarks[cls.WRIST, :2]
        palm_scale = cls.get_palm_scale(landmarks)

        fingers = {}
        finger_indices = [
            ('index', cls.INDEX_MCP, cls.INDEX_PIP, cls.INDEX_DIP, cls.INDEX_TIP),
            ('middle', cls.MIDDLE_MCP, cls.MIDDLE_PIP, cls.MIDDLE_DIP, cls.MIDDLE_TIP),
            ('ring', cls.RING_MCP, cls.RING_PIP, cls.RING_DIP, cls.RING_TIP),
            ('pinky', cls.PINKY_MCP, cls.PINKY_PIP, cls.PINKY_DIP, cls.PINKY_TIP),
        ]

        for name, mcp_id, pip_id, dip_id, tip_id in finger_indices:
            tip = landmarks[tip_id, :2]
            pip = landmarks[pip_id, :2]
            mcp = landmarks[mcp_id, :2]

            d_wrist_tip = np.linalg.norm(tip - wrist)
            d_wrist_pip = np.linalg.norm(pip - wrist)
            d_mcp_tip = np.linalg.norm(tip - mcp)
            d_mcp_pip = np.linalg.norm(pip - mcp)

            is_extended = (d_wrist_tip > d_wrist_pip + 0.08 * palm_scale) and (d_mcp_tip > d_mcp_pip * 1.15)
            fingers[name] = bool(is_extended)

        # Thumb extension
        thumb_tip = landmarks[cls.THUMB_TIP, :2]
        thumb_ip = landmarks[cls.THUMB_IP, :2]
        pinky_mcp = landmarks[cls.PINKY_MCP, :2]
        index_mcp = landmarks[cls.INDEX_MCP, :2]

        d_thumb_pinky = np.linalg.norm(thumb_tip - pinky_mcp)
        d_thumb_ip_pinky = np.linalg.norm(thumb_ip - pinky_mcp)
        d_thumb_idx_mcp = np.linalg.norm(thumb_tip - index_mcp)

        thumb_extended = (d_thumb_pinky > d_thumb_ip_pinky + 0.08 * palm_scale) and (d_thumb_idx_mcp > 0.40 * palm_scale)
        fingers['thumb'] = bool(thumb_extended)

        states_list = [
            fingers['thumb'],
            fingers['index'],
            fingers['middle'],
            fingers['ring'],
            fingers['pinky']
        ]

        # Separate thumb from 4 fingers
        extended_count = sum(states_list)
        main_four_extended = sum(states_list[1:])  # Index, middle, ring, pinky

        # Posture Classification (Bockhacker et al. action gestures):
        # HAND = Open hand with all or most fingers outstretched (at least 3 main fingers or 4 total)
        # FIST = Closed fist (0 main fingers extended and at most 1 thumb touch)
        if main_four_extended >= 3 or extended_count >= 4:
            posture = "HAND"
        elif main_four_extended == 0 and extended_count <= 1:
            posture = "FIST"
        else:
            posture = "NEUTRAL"

        palm_center = np.mean([wrist, index_mcp, pinky_mcp], axis=0)

        return {
            'thumb': fingers['thumb'],
            'index': fingers['index'],
            'middle': fingers['middle'],
            'ring': fingers['ring'],
            'pinky': fingers['pinky'],
            'states': states_list,
            'extended_count': extended_count,
            'main_four_count': main_four_extended,
            'posture': posture,
            'palm_scale': float(palm_scale),
            'wrist': wrist,
            'palm_center': palm_center
        }
