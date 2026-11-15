"""
ZeroTouch Interactive Live Two-Hand Diagnostic & Tuning Suite
Evaluates Two-Hand Finger-Count Mode Selection and Action Execution:
1. Live Camera Mode:
   - Real-time display of Left/Right finger counts & postures
   - Mode selection hold progress
   - Tracking stability
2. Synthetic Robustness Sweep:
   - Independent finger counting across scales (distances) & angles (tilts)
   - Matching count mode selection confirmation
"""

import sys
import time
import cv2
import numpy as np

from core.config import config
from core.camera import ZeroTouchCamera
from core.gesture_engine import GestureEngine, TwoHandPose, OperationMode
from core.landmarks import LandmarkProcessor
from test_gesture_engine import LandmarkBuilder


def run_synthetic_benchmark():
    print("=" * 70)
    print("ZeroTouch Two-Hand Matching Finger-Count Robustness Benchmark")
    print("=" * 70)

    scales = [0.09, 0.13, 0.17, 0.22]
    angles = [-0.30, -0.15, 0.0, 0.15, 0.30]

    processor = LandmarkProcessor()
    print(f"Testing Independent Finger Counting across {len(scales)} scales and {len(angles)} tilts...")

    test_counts = [1, 2, 3, 4]
    total_checks = 0
    passed_checks = 0

    for count in test_counts:
        passed = True
        for s in scales:
            for a in angles:
                hand_lms = LandmarkBuilder.create_hand_with_count(count, wrist=(0.5, 0.7), scale=s, angle_rad=a)
                feats = processor.get_finger_states(np.array(hand_lms))
                detected_cnt = feats['extended_count']
                total_checks += 1
                if detected_cnt == count:
                    passed_checks += 1
                else:
                    passed = False
                    print(f"  [MISMATCH] Count={count} at scale={s}, angle={a:.2f}: detected={detected_cnt}")

        status = "PASSED (100%)" if passed else "FAILED VARIANTS"
        print(f"  - Count {count} Fingers: {status}")

    acc = (passed_checks / total_checks) * 100.0
    print(f"\nOverall Synthetic Finger Counting Accuracy: {acc:.1f}% ({passed_checks}/{total_checks})")
    print("=" * 70)


def run_live_diagnostics():
    print("=" * 70)
    print("ZeroTouch Two-Hand Finger-Count Live Diagnostics Mode")
    print("=" * 70)
    print("Instructions:")
    print("  Hold BOTH hands at chest level in view of webcam:")
    print("    1 + 1 fingers -> SLICE_NAVIGATION (Hold ~0.6s)")
    print("    2 + 2 fingers -> ZOOM (Hold ~0.6s)")
    print("    3 + 3 fingers -> WINDOWING (Hold ~0.6s)")
    print("    4 + 4 fingers -> PANNING (Hold ~0.6s)")
    print("    HAND + FIST   -> Direction A (Prev / Zoom In / WC+ / Pan Left)")
    print("    FIST + HAND   -> Direction B (Next / Zoom Out / WC- / Pan Right)")
    print("    HAND + HAND   -> Cycle Viewing Window Preset (Hold ~0.45s)")
    print("    NEUTRAL       -> Stop / Clutch disengage")
    print("Controls:")
    print("  [M] Manually cycle operating mode")
    print("  [C] Toggle low-light CLAHE enhancement")
    print("  [Q/ESC] Quit")
    print("=" * 70)

    camera = ZeroTouchCamera()
    engine = GestureEngine()

    while True:
        frame, tracked_hands = camera.process_frame()
        if frame is None:
            break

        action = engine.update(tracked_hands)
        if action:
            print(f"[ACTION]: {action}")

        h, w = frame.shape[:2]
        # HUD overlays
        cv2.putText(frame, f"Mode: {engine.get_current_mode_name()} [{engine.interaction_state.value}]",
                    (20, 40), cv2.FONT_HERSHEY_DUPLEX, 0.75, (0, 255, 180), 2)
        cv2.putText(frame, f"Left: {engine.left_finger_count} Fg ({engine.left_hand_posture}) | Right: {engine.right_finger_count} Fg ({engine.right_hand_posture})",
                    (20, 78), cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 220, 0), 2)
        cv2.putText(frame, f"Pose: {engine.current_pose.name} | Gesture: {engine.last_classified_gesture}",
                    (20, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 2)

        cv2.imshow("ZeroTouch Live Finger-Count Diagnostics", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord('q'):
            break
        elif key == ord('m') or key == ord('M'):
            engine.cycle_mode()
        elif key == ord('c') or key == ord('C'):
            camera.cfg.enable_clahe = not camera.cfg.enable_clahe
            print(f"CLAHE toggled: {camera.cfg.enable_clahe}")

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        run_live_diagnostics()
    else:
        run_synthetic_benchmark()
