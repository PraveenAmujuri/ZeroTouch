"""
ZeroTouch Gesture Engine Module (Two-Hand Finger-Count Mode Selection & Action Execution)
Implements:
- Independent anatomical finger counting for Left and Right hands.
- Matching finger-count mode selection:
    1 + 1 -> SLICE_NAVIGATION
    2 + 2 -> ZOOM
    3 + 3 -> WINDOWING
    4 + 4 -> PANNING
    Mismatched counts (1+2, 2+3, etc.) -> NO mode selection.
- Clear interaction lifecycle:
    READY -> MODE SELECTION or ACTION -> RELEASE / NEUTRAL -> REPOSITION -> READY
- Hold confirmation (~0.6s) with anti-repeat: holding matching pose changes mode only once.
- Neutral pose requirement before rearming mode selection.
- FIST + FIST removed from mode selection (now purely safety / neutral stop).
- Preserves two-hand action gestures:
    HAND + FIST -> Direction A (Prev Slice / Zoom In / Brightness + / Pan Left)
    FIST + HAND -> Direction B (Next Slice / Zoom Out / Brightness - / Pan Right)
    HAND + HAND -> Active viewing window preset cycling (hold ~0.45s)
    BACKGROUND / NEUTRAL -> Stops all actions cleanly without reverse commands.
"""

import time
import math
from enum import Enum
from typing import Optional, Any, Dict, Tuple, List
import numpy as np

from core.config import GestureThresholds, FilterConfig, config
from core.landmarks import LandmarkProcessor


class OperationMode(Enum):
    SLICE_NAV = "SLICE_NAVIGATION"
    ZOOM = "ZOOM"
    WINDOWING = "WINDOWING"
    PANNING = "PANNING"


class InteractionState(Enum):
    READY = "READY"
    MODE_SELECTION = "MODE_SELECTION"
    ACTION = "ACTION"
    NEUTRAL = "NEUTRAL"


class TwoHandPose(Enum):
    BACKGROUND = "BACKGROUND"      # Neutral / Relaxed / Stop
    FIST_FIST = "FIST_FIST"        # Both hands closed (no longer switches mode)
    HAND_FIST = "HAND_FIST"        # Direction A
    FIST_HAND = "FIST_HAND"        # Direction B
    HAND_HAND = "HAND_HAND"        # Both open: Preset cycle
    MATCHING_COUNTS = "MATCHING_COUNTS" # Mode selection candidate


# Direct mapping: finger count per hand -> OperationMode
FINGER_COUNT_TO_MODE = {
    1: OperationMode.SLICE_NAV,
    2: OperationMode.ZOOM,
    3: OperationMode.WINDOWING,
    4: OperationMode.PANNING
}


class GestureEngine:
    """
    Two-Hand Operating Room Gesture Engine with Matching Finger-Count Mode Selection.
    """

    OPERATING_MODES = [
        OperationMode.SLICE_NAV,
        OperationMode.ZOOM,
        OperationMode.WINDOWING,
        OperationMode.PANNING
    ]

    def __init__(self, thresholds: Optional[GestureThresholds] = None, filter_cfg: Optional[FilterConfig] = None):
        self.cfg = thresholds or config.gestures
        fcfg = filter_cfg or config.filter

        self.processor = LandmarkProcessor(
            min_cutoff=fcfg.min_cutoff,
            beta=fcfg.beta,
            d_cutoff=fcfg.d_cutoff
        )

        # Operating Mode (Default: Slice Navigation)
        self.mode_index = 0
        self.current_mode = self.OPERATING_MODES[self.mode_index]

        # Interaction Lifecycle State
        self.interaction_state = InteractionState.READY
        self.current_pose = TwoHandPose.BACKGROUND

        # Finger count tracking
        self.left_finger_count: int = 0
        self.right_finger_count: int = 0
        self.left_hand_posture: str = "NONE"
        self.right_hand_posture: str = "NONE"

        # Mode Selection Temporal Hold & Rearm state
        self.mode_candidate_count: Optional[int] = None
        self.mode_hold_start_time: Optional[float] = None
        self.mode_selection_executed: bool = False  # Anti-repeat lock while held
        self.selection_rearmed: bool = True         # Requires neutral return to rearm

        # Window change hold state (HAND + HAND)
        self.hand_hand_start_time: Optional[float] = None
        self.last_window_switch_time: float = 0.0

        # Action execution tracking
        self.action_in_progress: bool = False
        self.active_action_name: str = "NONE"
        self.last_action_tick_time: float = 0.0
        self.slice_hold_start_time: Optional[float] = None
        self.preset_hold_start_time: Optional[float] = None

        # Step-based Directional Panning state (in PANNING mode: 1+1=Left, 2+2=Right, 3+3=Up, 4+4=Down)
        self.pan_step_candidate: Optional[int] = None
        self.pan_step_start_time: Optional[float] = None
        self.pan_step_last_tick_time: float = 0.0
        self.pan_step_rearmed: bool = True

        # Diagnostic message
        self.last_classified_gesture: str = "BACKGROUND (Stop)"
        self.debug_info: Dict[str, Any] = {}

    def get_current_mode_name(self) -> str:
        return self.current_mode.value

    def cycle_mode(self, direction: int = 1) -> str:
        """Cycles operating mode via keyboard shortcut."""
        self.mode_index = (self.mode_index + direction) % len(self.OPERATING_MODES)
        self.current_mode = self.OPERATING_MODES[self.mode_index]
        return self.current_mode.value

    def set_mode(self, mode: OperationMode):
        self.current_mode = mode
        self.mode_index = self.OPERATING_MODES.index(mode)

    def reset_interactions(self):
        """Cleans up in-flight actions upon neutral posture or tracking loss."""
        self.action_in_progress = False
        self.active_action_name = "NONE"
        self.slice_hold_start_time = None
        self.preset_hold_start_time = None
        self.hand_hand_start_time = None
        self.mode_hold_start_time = None
        self.mode_candidate_count = None
        self.pan_step_candidate = None
        self.pan_step_start_time = None
        self.pan_step_last_tick_time = 0.0
        self.pan_step_rearmed = True

    def update(self, tracked_hands: List[Dict[str, Any]]) -> Optional[Tuple[str, Any]]:
        """
        Process two-hand tracking data for current frame.

        Returns:
            Tuple of (ActionName, Value) or None:
            - ("MODE_CHANGED", mode_name_str)
            - ("WINDOW_CHANGED", None)
            - ("SLICE_PREV", None)
            - ("SLICE_NEXT", None)
            - ("ZOOM", float_delta)
            - ("WINDOW_CENTER", float_delta)
            - ("PAN", (dx, dy))
            - ("ACTION_STOP", None)
        """
        current_time = time.time()

        # Safety Check: If both hands are not tracked, immediately disengage all actions
        if not tracked_hands or len(tracked_hands) < 2:
            had_action = self.action_in_progress
            self.processor.reset()
            self.reset_interactions()
            self.selection_rearmed = True
            self.mode_selection_executed = False
            self.interaction_state = InteractionState.NEUTRAL
            self.current_pose = TwoHandPose.BACKGROUND
            self.left_finger_count = 0
            self.right_finger_count = 0
            self.left_hand_posture = "NONE"
            self.right_hand_posture = "NONE"
            self.last_classified_gesture = "HAND LOSS (Stop)" if not tracked_hands else "WAITING FOR 2 HANDS"
            self.debug_info = {
                "hands_count": len(tracked_hands) if tracked_hands else 0,
                "left_count": 0,
                "right_count": 0,
                "left_posture": "NONE",
                "right_posture": "NONE",
                "state": self.interaction_state.value,
                "pose": TwoHandPose.BACKGROUND.value,
                "mode": self.current_mode.value,
                "active_action": "NONE",
                "tracking_status": "LOST" if not tracked_hands else "PARTIAL"
            }
            if had_action:
                return ("ACTION_STOP", None)
            return None

        # Both hands are confidently tracked
        left_hand_data = None
        right_hand_data = None

        for idx, h in enumerate(tracked_hands[:2]):
            smoothed_lms = self.processor.smooth_landmarks(h['landmarks'], current_time, hand_idx=idx)
            feats = self.processor.get_finger_states(smoothed_lms)
            feats['centroid_x'] = h['centroid_x']
            feats['centroid_y'] = h['centroid_y']

            if h['screen_side'] == 'LEFT':
                left_hand_data = feats
            else:
                right_hand_data = feats

        # Fallback if both sorted to same side
        if left_hand_data is None and right_hand_data is not None:
            left_hand_data = right_hand_data
        elif right_hand_data is None and left_hand_data is not None:
            right_hand_data = left_hand_data

        left_posture = left_hand_data['posture']
        right_posture = right_hand_data['posture']
        left_count = left_hand_data['extended_count']
        right_count = right_hand_data['extended_count']

        self.left_hand_posture = left_posture
        self.right_hand_posture = right_posture
        self.left_finger_count = left_count
        self.right_finger_count = right_count

        # =============================================================
        # 1. EVALUATE POSE CATEGORY (Strict Separation)
        # =============================================================
        # Mode Selection Candidate:
        # Both hands must independently have the SAME count in [1, 2, 3, 4].
        # Cannot be an action pose (HAND+FIST, FIST+HAND).
        is_matching_count = (
            left_count == right_count and
            left_count in FINGER_COUNT_TO_MODE
        )

        # Action Poses (Bockhacker et al.):
        is_hand_fist = (left_posture == "HAND" and right_posture == "FIST")
        is_fist_hand = (left_posture == "FIST" and right_posture == "HAND")
        # HAND_HAND is specifically full open hands (5+5 extended), distinct from 4+4 PANNING
        is_hand_hand = (left_posture == "HAND" and right_posture == "HAND" and left_count == 5 and right_count == 5)
        is_fist_fist = (left_posture == "FIST" and right_posture == "FIST")

        # Determine pose with explicit priority:
        # Priority 1: Action gestures (HAND+FIST, FIST+HAND, HAND+HAND)
        # Priority 2: Matching finger-count mode selection (1+1, 2+2, 3+3, 4+4)
        # Priority 3: FIST+FIST (Safety stop)
        # Priority 4: Background/Neutral
        if is_hand_fist:
            detected_pose = TwoHandPose.HAND_FIST
        elif is_fist_hand:
            detected_pose = TwoHandPose.FIST_HAND
        elif is_hand_hand:
            detected_pose = TwoHandPose.HAND_HAND
        elif is_matching_count:
            detected_pose = TwoHandPose.MATCHING_COUNTS
        elif is_fist_fist:
            detected_pose = TwoHandPose.FIST_FIST
        else:
            detected_pose = TwoHandPose.BACKGROUND

        self.current_pose = detected_pose

        # Standard Neutral / Safety Rest / Clutch Handling
        if detected_pose in (TwoHandPose.BACKGROUND, TwoHandPose.FIST_FIST):
            # Rearm mode selection and directional panning when user releases into neutral
            self.selection_rearmed = True
            self.mode_selection_executed = False
            self.mode_hold_start_time = None
            self.mode_candidate_count = None
            self.pan_step_rearmed = True
            self.pan_step_candidate = None
            self.pan_step_start_time = None

            had_action = self.action_in_progress
            self.reset_interactions()
            self.interaction_state = InteractionState.NEUTRAL

            if detected_pose == TwoHandPose.FIST_FIST:
                self.last_classified_gesture = "FIST+FIST (Safety Rest / No Action)"
            else:
                self.last_classified_gesture = f"NEUTRAL [{left_count}+{right_count}] (Stop)"

            self.debug_info = self._build_debug_info("CONNECTED")
            if had_action:
                return ("ACTION_STOP", None)
            return None

        # =============================================================
        # 3. PANNING MODE: STEP-BASED DIRECTIONAL PANNING
        # When current_mode is PANNING:
        # 1 + 1 fingers: Pan Left
        # 2 + 2 fingers: Pan Right
        # 3 + 3 fingers: Pan Up
        # 4 + 4 fingers: Pan Down
        # Debounced, stability-checked, and controlled repeat when held.
        # =============================================================
        if self.current_mode == OperationMode.PANNING and detected_pose == TwoHandPose.MATCHING_COUNTS:
            self.action_in_progress = True
            self.interaction_state = InteractionState.ACTION

            pan_step_map = {
                1: (-getattr(self.cfg, "pan_step_distance", 25.0), 0.0, "LEFT"),
                2: (getattr(self.cfg, "pan_step_distance", 25.0), 0.0, "RIGHT"),
                3: (0.0, -getattr(self.cfg, "pan_step_distance", 25.0), "UP"),
                4: (0.0, getattr(self.cfg, "pan_step_distance", 25.0), "DOWN"),
            }

            if left_count in pan_step_map:
                dx, dy, dir_name = pan_step_map[left_count]
                self.active_action_name = f"PAN_{dir_name}"

                # Check candidate stability across consecutive frames
                if self.pan_step_candidate != left_count:
                    self.pan_step_candidate = left_count
                    self.pan_step_start_time = current_time
                    self.last_classified_gesture = f"PAN {dir_name}: DETECTING"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return None

                elapsed_pose = current_time - (self.pan_step_start_time or current_time)
                stability_threshold = getattr(self.cfg, "pan_gesture_hold_time", 0.18)

                if elapsed_pose < stability_threshold:
                    self.last_classified_gesture = f"PAN {dir_name}: CONFIRMING"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return None

                # Stability confirmed: evaluate cadence / repeat
                step_delay = getattr(self.cfg, "pan_step_delay", 0.28)

                # First step after rearm or elapsed step delay when held
                if self.pan_step_rearmed or (current_time - self.pan_step_last_tick_time >= step_delay):
                    self.pan_step_rearmed = False
                    self.pan_step_last_tick_time = current_time
                    self.last_classified_gesture = f"PAN {dir_name}: STEP"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return ("PAN", (dx, dy))
                else:
                    self.last_classified_gesture = f"PAN {dir_name}: HELD"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return None

        # =============================================================
        # 4. MODE SELECTION (Two-Hand Matching Finger Counts 1..4)
        # Active in other modes to switch modes
        # =============================================================
        if detected_pose == TwoHandPose.MATCHING_COUNTS:
            target_mode = FINGER_COUNT_TO_MODE[left_count]

            had_action = self.action_in_progress
            self.action_in_progress = False
            self.active_action_name = "NONE"
            self.hand_hand_start_time = None
            self.interaction_state = InteractionState.MODE_SELECTION

            # If already executed for this continuous hold, wait for neutral release
            if self.mode_selection_executed:
                self.last_classified_gesture = f"{left_count}+{right_count} (Held: {self.current_mode.value})"
                self.debug_info = self._build_debug_info("CONNECTED")
                if had_action:
                    return ("ACTION_STOP", None)
                return None

            # Only process if rearmed from previous neutral
            if not self.selection_rearmed:
                self.last_classified_gesture = "RELEASE TO REARM"
                self.debug_info = self._build_debug_info("CONNECTED")
                if had_action:
                    return ("ACTION_STOP", None)
                return None

            # Check candidate stability across frames
            if self.mode_candidate_count != left_count:
                self.mode_candidate_count = left_count
                self.mode_hold_start_time = current_time
                self.last_classified_gesture = f"DETECTING {left_count}+{right_count} -> {target_mode.value}"
                self.debug_info = self._build_debug_info("CONNECTED")
                if had_action:
                    return ("ACTION_STOP", None)
                return None
            else:
                elapsed = current_time - (self.mode_hold_start_time or current_time)
                if elapsed >= self.cfg.mode_switch_hold_time:
                    # Successfully confirmed matching pose!
                    self.set_mode(target_mode)
                    self.mode_selection_executed = True
                    self.selection_rearmed = False
                    self.mode_hold_start_time = None
                    self.last_classified_gesture = f"SELECTED: {target_mode.value}"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return ("MODE_CHANGED", target_mode.value)
                else:
                    pct = int((elapsed / self.cfg.mode_switch_hold_time) * 100)
                    self.last_classified_gesture = f"HOLDING {left_count}+{right_count} ({pct}%)"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    if had_action:
                        return ("ACTION_STOP", None)
                    return None

        # Reset mode hold timer if pose shifted away from matching
        self.mode_hold_start_time = None
        self.mode_candidate_count = None

        # =============================================================
        # 4. ACTIVE VIEWING WINDOW PRESETS (HAND + HAND)
        # Both hands fully open, held ~0.45s
        # =============================================================
        if detected_pose == TwoHandPose.HAND_HAND:
            self.action_in_progress = False
            self.active_action_name = "NONE"
            self.interaction_state = InteractionState.ACTION

            if current_time - self.last_window_switch_time < self.cfg.window_change_cooldown:
                self.last_classified_gesture = "WINDOW COOLDOWN"
                self.debug_info = self._build_debug_info("CONNECTED")
                return None

            if self.hand_hand_start_time is None:
                self.hand_hand_start_time = current_time
                self.last_classified_gesture = "HAND+HAND (Hold for Preset)"
                self.debug_info = self._build_debug_info("CONNECTED")
                return None
            else:
                elapsed = current_time - self.hand_hand_start_time
                if elapsed >= self.cfg.window_change_hold_time:
                    self.hand_hand_start_time = None
                    self.last_window_switch_time = current_time
                    self.last_classified_gesture = "WINDOW PRESET CHANGED"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return ("WINDOW_CHANGED", None)
                else:
                    pct = int((elapsed / self.cfg.window_change_hold_time) * 100)
                    self.last_classified_gesture = f"SWITCHING WINDOW ({pct}%)"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return None

        self.hand_hand_start_time = None

        # =============================================================
        # 5. DIRECTIONAL ACTIONS (HAND+FIST or FIST+HAND)
        # =============================================================
        if detected_pose in (TwoHandPose.HAND_FIST, TwoHandPose.FIST_HAND):
            is_dir_a = (detected_pose == TwoHandPose.HAND_FIST)
            self.action_in_progress = True
            self.interaction_state = InteractionState.ACTION

            # --- MODE: SLICE NAVIGATION ---
            if self.current_mode == OperationMode.SLICE_NAV:
                self.active_action_name = "SLICE_PREV" if is_dir_a else "SLICE_NEXT"
                if self.slice_hold_start_time is None:
                    self.slice_hold_start_time = current_time
                    action_tag = "SLICE_PREV" if is_dir_a else "SLICE_NEXT"
                    self.last_classified_gesture = f"{detected_pose.name}: {action_tag}"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return (action_tag, None)
                else:
                    if current_time - self.slice_hold_start_time >= self.cfg.slice_step_delay:
                        self.slice_hold_start_time = current_time
                        action_tag = "SLICE_PREV" if is_dir_a else "SLICE_NEXT"
                        self.last_classified_gesture = f"{detected_pose.name}: {action_tag}"
                        self.debug_info = self._build_debug_info("CONNECTED")
                        return (action_tag, None)
                self.debug_info = self._build_debug_info("CONNECTED")
                return None

            # --- MODE: ZOOM ---
            elif self.current_mode == OperationMode.ZOOM:
                self.active_action_name = "ZOOM_IN" if is_dir_a else "ZOOM_OUT"
                if current_time - self.last_action_tick_time >= self.cfg.action_cooldown:
                    self.last_action_tick_time = current_time
                    zoom_delta = self.cfg.zoom_sensitivity if is_dir_a else -self.cfg.zoom_sensitivity
                    direction = "ZOOM IN" if is_dir_a else "ZOOM OUT"
                    self.last_classified_gesture = f"{detected_pose.name}: {direction}"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return ("ZOOM", zoom_delta)
                self.debug_info = self._build_debug_info("CONNECTED")
                return None

            # --- MODE: WINDOWING (Preset Switching: Prev / Next Calibrated Preset) ---
            elif self.current_mode == OperationMode.WINDOWING:
                self.active_action_name = "PREV_PRESET" if is_dir_a else "NEXT_PRESET"
                if self.preset_hold_start_time is None:
                    self.preset_hold_start_time = current_time
                    action_tag = "PREV_PRESET" if is_dir_a else "NEXT_PRESET"
                    self.last_classified_gesture = f"{detected_pose.name}: {action_tag}"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return (action_tag, None)
                else:
                    if current_time - self.preset_hold_start_time >= self.cfg.preset_switch_delay:
                        self.preset_hold_start_time = current_time
                        action_tag = "PREV_PRESET" if is_dir_a else "NEXT_PRESET"
                        self.last_classified_gesture = f"{detected_pose.name}: {action_tag}"
                        self.debug_info = self._build_debug_info("CONNECTED")
                        return (action_tag, None)
                self.debug_info = self._build_debug_info("CONNECTED")
                return None

            # --- MODE: PANNING ---
            elif self.current_mode == OperationMode.PANNING:
                self.active_action_name = "PAN_LEFT" if is_dir_a else "PAN_RIGHT"
                if current_time - self.last_action_tick_time >= self.cfg.action_cooldown:
                    self.last_action_tick_time = current_time
                    pan_dx = -self.cfg.pan_sensitivity if is_dir_a else self.cfg.pan_sensitivity
                    direction = "PAN LEFT" if is_dir_a else "PAN RIGHT"
                    self.last_classified_gesture = f"{detected_pose.name}: {direction}"
                    self.debug_info = self._build_debug_info("CONNECTED")
                    return ("PAN", (pan_dx, 0.0))
                self.debug_info = self._build_debug_info("CONNECTED")
                return None

        self.debug_info = self._build_debug_info("CONNECTED")
        return None

    def _build_debug_info(self, tracking_status: str) -> Dict[str, Any]:
        return {
            "hands_count": 2 if tracking_status == "CONNECTED" else 0,
            "left_count": self.left_finger_count,
            "right_count": self.right_finger_count,
            "left_posture": self.left_hand_posture,
            "right_posture": self.right_hand_posture,
            "state": self.interaction_state.value,
            "pose": self.current_pose.value,
            "mode": self.current_mode.value,
            "active_action": self.active_action_name,
            "tracking_status": tracking_status
        }
