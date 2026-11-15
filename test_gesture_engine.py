"""
ZeroTouch Comprehensive Two-Hand Verification Test Suite
Updated for Two-Hand Matching Finger-Count Mode Selection:
- 1 + 1 -> SLICE_NAVIGATION
- 2 + 2 -> ZOOM
- 3 + 3 -> WINDOWING
- 4 + 4 -> PANNING
- Mismatched counts (1+2, 2+3, 3+4, etc.) -> NO mode change
- Anti-repeat: holding matching pose changes mode only once
- Neutral requirement before rearming mode selection
- FIST + FIST removal from mode switching (now neutral stop)
- Action recognition in every mode (HAND + FIST, FIST + HAND)
- Safety: Neutral stop, Hand loss, Repositioning immunity
- DICOM Viewer functionality: Slice nav, Zoom, Windowing presets, Panning, Viewport reset
"""

import unittest
import numpy as np
import time
from typing import Tuple, List, Dict, Any

from core.landmarks import LandmarkProcessor
from core.gesture_engine import GestureEngine, OperationMode, TwoHandPose, InteractionState
from core.config import GestureThresholds, FilterConfig
from ui.dicom_viewer import DICOMViewer


class LandmarkBuilder:
    """Helper to synthesize valid 21-landmark hand poses for testing."""
    @staticmethod
    def create_hand(
        wrist=(0.5, 0.7),
        scale=0.15,
        fingers_extended=(True, True, True, True, True),
        angle_rad=0.0
    ) -> List[Tuple[float, float, float]]:
        lms = [[wrist[0], wrist[1], 0.0] for _ in range(21)]

        rot = np.array([
            [np.cos(angle_rad), -np.sin(angle_rad)],
            [np.sin(angle_rad),  np.cos(angle_rad)]
        ])

        mcp_offsets = {
            1: (-0.35, -0.30),
            2: (-0.45, -0.55),
            5: (-0.25, -0.80),
            9: (0.00,  -0.90),
            13: (0.22, -0.80),
            17: (0.38, -0.65),
        }

        for idx, (ox, oy) in mcp_offsets.items():
            pos = np.array([ox, oy]) * scale
            rpos = rot @ pos
            lms[idx] = [wrist[0] + rpos[0], wrist[1] + rpos[1], 0.0]

        finger_data = [
            (1, 8, 6, 7, 5, (-0.25, -1.55)),
            (2, 12, 10, 11, 9, (0.0, -1.65)),
            (3, 16, 14, 15, 13, (0.22, -1.55)),
            (4, 20, 18, 19, 17, (0.38, -1.40)),
        ]

        for f_idx, tip, pip, dip, mcp, ext_vec in finger_data:
            is_ext = fingers_extended[f_idx]
            pip_offset = rot @ (np.array(ext_vec) * 0.45 * scale)
            lms[pip] = [wrist[0] + pip_offset[0], wrist[1] + pip_offset[1], 0.0]

            dip_offset = rot @ (np.array(ext_vec) * 0.75 * scale)
            lms[dip] = [wrist[0] + dip_offset[0], wrist[1] + dip_offset[1], 0.0]

            if is_ext:
                tip_offset = rot @ (np.array(ext_vec) * scale)
                lms[tip] = [wrist[0] + tip_offset[0], wrist[1] + tip_offset[1], 0.0]
            else:
                curl_offset = rot @ (np.array(ext_vec) * 0.30 * scale)
                lms[tip] = [wrist[0] + curl_offset[0], wrist[1] + curl_offset[1], 0.0]

        thumb_ext = fingers_extended[0]
        ip_offset = rot @ (np.array([-0.65, -0.75]) * scale)
        lms[3] = [wrist[0] + ip_offset[0], wrist[1] + ip_offset[1], 0.0]

        if thumb_ext:
            tip_offset = rot @ (np.array([-0.90, -0.90]) * scale)
            lms[4] = [wrist[0] + tip_offset[0], wrist[1] + tip_offset[1], 0.0]
        else:
            tip_offset = rot @ (np.array([-0.10, -0.60]) * scale)
            lms[4] = [wrist[0] + tip_offset[0], wrist[1] + tip_offset[1], 0.0]

        return [tuple(pt) for pt in lms]

    @classmethod
    def create_hand_with_count(cls, count: int, wrist=(0.5, 0.7), scale=0.15, angle_rad=0.0):
        """
        Creates hand landmark with an exact number of extended fingers (1 to 5).
        Thumb is kept folded for 1..4 counts to prevent thumb/finger confusion:
        count=1: Index
        count=2: Index + Middle
        count=3: Index + Middle + Ring
        count=4: Index + Middle + Ring + Pinky
        count=5: All five
        count=0: Fist
        """
        if count == 0:
            fingers = (False, False, False, False, False)
        elif count == 1:
            fingers = (False, True, False, False, False)
        elif count == 2:
            fingers = (False, True, True, False, False)
        elif count == 3:
            fingers = (False, True, True, True, False)
        elif count == 4:
            fingers = (False, True, True, True, True)
        elif count == 5:
            fingers = (True, True, True, True, True)
        else:
            fingers = (False, False, False, False, False)

        return cls.create_hand(wrist=wrist, scale=scale, fingers_extended=fingers, angle_rad=angle_rad)

    @classmethod
    def create_two_hands_counts(cls, left_count: int, right_count: int) -> List[Dict[str, Any]]:
        """Creates paired two-hand tracking data with exact finger counts."""
        left_lms = cls.create_hand_with_count(left_count, wrist=(0.35, 0.65), scale=0.14)
        right_lms = cls.create_hand_with_count(right_count, wrist=(0.65, 0.65), scale=0.14)
        return [
            {'landmarks': left_lms, 'centroid_x': 0.35, 'centroid_y': 0.65, 'screen_side': 'LEFT'},
            {'landmarks': right_lms, 'centroid_x': 0.65, 'centroid_y': 0.65, 'screen_side': 'RIGHT'}
        ]

    @classmethod
    def create_two_hands(cls, left_extended=(True, True, True, True, True), right_extended=(True, True, True, True, True)) -> List[Dict[str, Any]]:
        left_lms = cls.create_hand(wrist=(0.35, 0.65), scale=0.14, fingers_extended=left_extended)
        right_lms = cls.create_hand(wrist=(0.65, 0.65), scale=0.14, fingers_extended=right_extended)
        return [
            {'landmarks': left_lms, 'centroid_x': 0.35, 'centroid_y': 0.65, 'screen_side': 'LEFT'},
            {'landmarks': right_lms, 'centroid_x': 0.65, 'centroid_y': 0.65, 'screen_side': 'RIGHT'}
        ]


class TestZeroTouchFingerCountModeSelection(unittest.TestCase):

    def setUp(self):
        self.thresholds = GestureThresholds(
            mode_switch_hold_time=0.25,   # Fast for testing
            mode_switch_cooldown=0.35,
            window_change_hold_time=0.25,
            window_change_cooldown=0.35,
            slice_step_delay=0.12
        )
        self.engine = GestureEngine(thresholds=self.thresholds)

    def test_mode_selection_matching_counts(self):
        """Verifies 1+1 -> SLICE, 2+2 -> ZOOM, 3+3 -> WINDOWING, 4+4 -> PANNING."""
        expected_modes = [
            (1, OperationMode.SLICE_NAV),
            (2, OperationMode.ZOOM),
            (3, OperationMode.WINDOWING),
            (4, OperationMode.PANNING),
        ]

        for count, expected_mode in expected_modes:
            # First return to neutral to ensure rearmed state
            self.engine.update([])
            time.sleep(0.02)

            hands = LandmarkBuilder.create_two_hands_counts(count, count)
            # Send initial frames to start hold timer
            for _ in range(3):
                self.engine.update(hands)
                time.sleep(0.02)

            # Wait past hold time (0.25s)
            time.sleep(0.28)
            act = self.engine.update(hands)

            self.assertIsNotNone(act, f"Failed to select mode for {count}+{count}")
            self.assertEqual(act[0], "MODE_CHANGED")
            self.assertEqual(act[1], expected_mode.value)
            self.assertEqual(self.engine.current_mode, expected_mode)

    def test_mismatched_counts_do_not_select_mode(self):
        """Verifies different combinations (1+2, 2+3, 3+4, etc.) never change mode."""
        self.engine.set_mode(OperationMode.SLICE_NAV)
        mismatched_pairs = [(1, 2), (2, 1), (2, 3), (3, 2), (3, 4), (4, 1), (1, 3)]

        for l_cnt, r_cnt in mismatched_pairs:
            self.engine.update([])
            time.sleep(0.02)

            hands = LandmarkBuilder.create_two_hands_counts(l_cnt, r_cnt)
            for _ in range(4):
                act = self.engine.update(hands)
                self.assertNotEqual(act and act[0], "MODE_CHANGED")
                time.sleep(0.02)

            time.sleep(0.28)
            act = self.engine.update(hands)
            self.assertNotEqual(act and act[0], "MODE_CHANGED")
            self.assertEqual(self.engine.current_mode, OperationMode.SLICE_NAV)

    def test_anti_repeat_while_held_and_rearm_requirement(self):
        """Verifies mode selection triggers only ONCE when held, requiring neutral to rearm."""
        self.engine.set_mode(OperationMode.SLICE_NAV)
        hands_zoom = LandmarkBuilder.create_two_hands_counts(2, 2)

        # Hold 2+2 to switch to ZOOM
        for _ in range(3):
            self.engine.update(hands_zoom)
            time.sleep(0.02)
        time.sleep(0.28)
        act = self.engine.update(hands_zoom)
        self.assertIsNotNone(act)
        self.assertEqual(act[0], "MODE_CHANGED")
        self.assertEqual(self.engine.current_mode, OperationMode.ZOOM)

        # Continue holding 2+2 for another 0.4s: must NOT fire repeated mode change
        for _ in range(5):
            act_held = self.engine.update(hands_zoom)
            self.assertIsNone(act_held)
            time.sleep(0.03)

        # Switch directly to 3+3 WITHOUT returning to neutral: must NOT switch mode
        hands_win = LandmarkBuilder.create_two_hands_counts(3, 3)
        time.sleep(0.28)
        act_unrearmed = self.engine.update(hands_win)
        self.assertIsNone(act_unrearmed)
        self.assertEqual(self.engine.current_mode, OperationMode.ZOOM)

        # Return to neutral (relax hands / empty hands)
        self.engine.update([])
        time.sleep(0.05)

        # Now 3+3 works because system was rearmed
        for _ in range(3):
            self.engine.update(hands_win)
            time.sleep(0.02)
        time.sleep(0.28)
        act_rearmed = self.engine.update(hands_win)
        self.assertIsNotNone(act_rearmed)
        self.assertEqual(act_rearmed[0], "MODE_CHANGED")
        self.assertEqual(self.engine.current_mode, OperationMode.WINDOWING)

    def test_fist_fist_no_longer_switches_mode(self):
        """Verifies FIST + FIST is removed from mode selection and acts as safety rest/stop."""
        self.engine.set_mode(OperationMode.ZOOM)
        fist_fist = LandmarkBuilder.create_two_hands_counts(0, 0)

        for _ in range(5):
            self.engine.update(fist_fist)
            time.sleep(0.03)

        time.sleep(0.40)
        act = self.engine.update(fist_fist)
        # FIST+FIST must never fire MODE_CHANGED
        self.assertNotEqual(act and act[0], "MODE_CHANGED")
        self.assertEqual(self.engine.current_mode, OperationMode.ZOOM)

    def test_action_recognition_in_every_mode(self):
        """Verifies HAND+FIST and FIST+HAND execute correct directional actions in each mode."""
        modes_and_expected = [
            (OperationMode.SLICE_NAV, "SLICE_PREV", "SLICE_NEXT"),
            (OperationMode.ZOOM, "ZOOM", "ZOOM"),
            (OperationMode.WINDOWING, "PREV_PRESET", "NEXT_PRESET"),
            (OperationMode.PANNING, "PAN", "PAN")
        ]

        hand_fist = LandmarkBuilder.create_two_hands(left_extended=(True, True, True, True, True), right_extended=(False, False, False, False, False))
        fist_hand = LandmarkBuilder.create_two_hands(left_extended=(False, False, False, False, False), right_extended=(True, True, True, True, True))

        for mode, exp_dir_a, exp_dir_b in modes_and_expected:
            self.engine.set_mode(mode)
            self.engine.update([])

            # Direction A (HAND + FIST)
            act_a = None
            for _ in range(4):
                a = self.engine.update(hand_fist)
                if a and a[0] == exp_dir_a:
                    act_a = a
                time.sleep(0.02)
            self.assertIsNotNone(act_a, f"Failed Direction A in mode {mode.value}")

            # Return to neutral
            self.engine.update([])
            time.sleep(0.02)

            # Direction B (FIST + HAND)
            act_b = None
            for _ in range(4):
                b = self.engine.update(fist_hand)
                if b and b[0] == exp_dir_b:
                    act_b = b
                time.sleep(0.02)
            self.assertIsNotNone(act_b, f"Failed Direction B in mode {mode.value}")

    def test_mode_poses_never_execute_image_actions(self):
        """Verifies finger-count poses (1..4) never execute zoom, pan, slice, or window adjustments."""
        self.engine.set_mode(OperationMode.ZOOM)
        for count in [1, 2, 3, 4]:
            hands = LandmarkBuilder.create_two_hands_counts(count, count)
            for _ in range(3):
                act = self.engine.update(hands)
                if act:
                    self.assertIn(act[0], ["MODE_CHANGED", "ACTION_STOP"])
                    self.assertNotIn(act[0], ["ZOOM", "PAN", "SLICE_NEXT", "SLICE_PREV", "WINDOW_CENTER"])

    def test_safety_neutral_stop_and_hand_loss(self):
        """Verifies neutral pose or losing either hand immediately halts active action."""
        self.engine.set_mode(OperationMode.ZOOM)
        hand_fist = LandmarkBuilder.create_two_hands(left_extended=(True, True, True, True, True), right_extended=(False, False, False, False, False))

        # Engage action
        for _ in range(3):
            self.engine.update(hand_fist)
            time.sleep(0.02)
        self.assertTrue(self.engine.action_in_progress)

        # Transition to neutral -> halts action across multiple frames as smoothing settles
        neutral = LandmarkBuilder.create_two_hands_counts(0, 0)
        act_stop = None
        for _ in range(5):
            a = self.engine.update(neutral)
            if a and a[0] == "ACTION_STOP":
                act_stop = a
            time.sleep(0.02)

        self.assertIsNotNone(act_stop)
        self.assertEqual(act_stop[0], "ACTION_STOP")
        self.assertFalse(self.engine.action_in_progress)

        # Engage again
        for _ in range(3):
            self.engine.update(hand_fist)
            time.sleep(0.02)
        self.assertTrue(self.engine.action_in_progress)

        # Lose one hand (only 1 hand in tracked_hands list) -> halts action
        single_hand = [{'landmarks': LandmarkBuilder.create_hand(), 'centroid_x': 0.35, 'centroid_y': 0.65, 'screen_side': 'LEFT'}]
        act_loss = self.engine.update(single_hand)
        self.assertIsNotNone(act_loss)
        self.assertEqual(act_loss[0], "ACTION_STOP")
        self.assertFalse(self.engine.action_in_progress)

    def test_hand_hand_window_preset_selection(self):
        """Verifies HAND + HAND cycles window presets."""
        hand_hand = LandmarkBuilder.create_two_hands(left_extended=(True, True, True, True, True), right_extended=(True, True, True, True, True))
        self.engine.update([])
        time.sleep(0.02)

        for _ in range(3):
            self.engine.update(hand_hand)
            time.sleep(0.02)
        time.sleep(0.28)
        act = self.engine.update(hand_hand)
        self.assertIsNotNone(act)
        self.assertEqual(act[0], "WINDOW_CHANGED")


class TestDICOMViewerFunctionality(unittest.TestCase):
    def test_viewer_full_capabilities(self):
        viewer = DICOMViewer(dicom_folder="assets")
        self.assertGreater(viewer.total_slices, 0)

        # 1. Slice navigation
        orig_slice = viewer.slice_index
        viewer.next_slice()
        self.assertEqual(viewer.slice_index, (orig_slice + 1) % viewer.total_slices)
        viewer.prev_slice()
        self.assertEqual(viewer.slice_index, orig_slice)

        # 2. Zoom & limits
        orig_zoom = viewer.target_zoom
        viewer.adjust_zoom(0.15)
        self.assertGreater(viewer.target_zoom, orig_zoom)
        viewer.adjust_zoom(-0.5)
        self.assertGreaterEqual(viewer.target_zoom, viewer.min_zoom)

        # 3. Windowing & Presets
        orig_wc = viewer.target_window_center
        viewer.adjust_window_center(30.0)
        self.assertGreater(viewer.target_window_center, orig_wc)

        preset_name = viewer.cycle_viewing_window()
        self.assertIn(preset_name, [p["name"] for p in viewer.presets])

        # 4. Panning
        viewer.pan(20.0, -15.0)
        self.assertEqual(viewer.target_pan_x, 20.0)
        self.assertEqual(viewer.target_pan_y, -15.0)

        # 5. Viewport Reset
        viewer.reset_viewport()
        self.assertEqual(viewer.target_zoom, 1.0)
        self.assertEqual(viewer.target_pan_x, 0.0)
        self.assertEqual(viewer.target_pan_y, 0.0)

        # 6. Render frame (supports both grayscale (600, 600) and color (600, 600, 3))
        frame = viewer.get_current_frame(canvas_size=600)
        self.assertIn(frame.shape, [(600, 600), (600, 600, 3)])


class TestTwoHandStepPanning(unittest.TestCase):
    """Verifies Step-based Directional Panning (1+1 Left, 2+2 Right, 3+3 Up, 4+4 Down)."""

    def setUp(self):
        self.thresholds = GestureThresholds(
            mode_switch_hold_time=0.25,
            mode_switch_cooldown=0.35,
            window_change_hold_time=0.25,
            window_change_cooldown=0.35,
            pan_step_distance=25.0,
            pan_step_delay=0.15,
            pan_gesture_hold_time=0.08
        )
        self.engine = GestureEngine(thresholds=self.thresholds)

    def test_panning_all_four_directions_and_hold_repeat(self):
        # 1. Switch to PANNING mode
        self.engine.set_mode(OperationMode.PANNING)
        self.assertEqual(self.engine.current_mode, OperationMode.PANNING)

        # 2. Test 1 + 1 -> Pan Left (-dx, 0)
        hands_1 = LandmarkBuilder.create_two_hands_counts(1, 1)
        self.engine.update([])  # ensure rearmed
        time.sleep(0.02)
        act_left = None
        for _ in range(5):
            res = self.engine.update(hands_1)
            if res and res[0] == "PAN":
                act_left = res
                break
            time.sleep(0.03)

        self.assertIsNotNone(act_left, "Failed to trigger PAN LEFT with 1+1")
        dx, dy = act_left[1]
        self.assertLess(dx, 0.0)
        self.assertEqual(dy, 0.0)

        # Hold repeat test: keep sending 1+1 and verify repeat after step delay
        time.sleep(0.18)
        act_left_repeat = self.engine.update(hands_1)
        self.assertIsNotNone(act_left_repeat, "Failed to repeat PAN LEFT when held")
        self.assertEqual(act_left_repeat[0], "PAN")

        # 3. Test 2 + 2 -> Pan Right (+dx, 0)
        self.engine.update([])  # neutral release
        time.sleep(0.02)
        hands_2 = LandmarkBuilder.create_two_hands_counts(2, 2)
        act_right = None
        for _ in range(5):
            res = self.engine.update(hands_2)
            if res and res[0] == "PAN":
                act_right = res
                break
            time.sleep(0.03)

        self.assertIsNotNone(act_right, "Failed to trigger PAN RIGHT with 2+2")
        dx, dy = act_right[1]
        self.assertGreater(dx, 0.0)
        self.assertEqual(dy, 0.0)

        # 4. Test 3 + 3 -> Pan Up (0, -dy)
        self.engine.update([])  # neutral release
        time.sleep(0.02)
        hands_3 = LandmarkBuilder.create_two_hands_counts(3, 3)
        act_up = None
        for _ in range(5):
            res = self.engine.update(hands_3)
            if res and res[0] == "PAN":
                act_up = res
                break
            time.sleep(0.03)

        self.assertIsNotNone(act_up, "Failed to trigger PAN UP with 3+3")
        dx, dy = act_up[1]
        self.assertEqual(dx, 0.0)
        self.assertLess(dy, 0.0)

        # 5. Test 4 + 4 -> Pan Down (0, +dy)
        self.engine.update([])  # neutral release
        time.sleep(0.02)
        hands_4 = LandmarkBuilder.create_two_hands_counts(4, 4)
        act_down = None
        for _ in range(5):
            res = self.engine.update(hands_4)
            if res and res[0] == "PAN":
                act_down = res
                break
            time.sleep(0.03)

        self.assertIsNotNone(act_down, "Failed to trigger PAN DOWN with 4+4")
        dx, dy = act_down[1]
        self.assertEqual(dx, 0.0)
        self.assertGreater(dy, 0.0)

        # 6. Neutral release immediately stops movement
        stop_act = self.engine.update([])
        self.assertIsNotNone(stop_act)
        self.assertEqual(stop_act[0], "ACTION_STOP")
        self.assertFalse(self.engine.action_in_progress)

        # 7. In SLICE_NAV mode, 1+1 does NOT pan (it selects or holds mode)
        self.engine.set_mode(OperationMode.SLICE_NAV)
        self.engine.update([])
        time.sleep(0.02)
        act_slice_mode = self.engine.update(hands_1)
        self.assertNotEqual(act_slice_mode and act_slice_mode[0], "PAN")


if __name__ == "__main__":
    unittest.main()
