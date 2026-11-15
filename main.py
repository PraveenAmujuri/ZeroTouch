"""
ZeroTouch - Touchless Medical Imaging Interface
Two-Hand Matching Finger-Count Mode Selection & Directional Action Control.
"""

import cv2
import sys
import numpy as np

from core.config import config
from core.camera import ZeroTouchCamera
from core.gesture_engine import GestureEngine, OperationMode
from ui.dicom_viewer import DICOMViewer
from ui.renderer import UIRenderer


def main():
    print("=" * 75)
    print("   ZeroTouch: Touchless Operating Room Medical Imaging Interface")
    print("   Two-Hand Matching Finger-Count Mode Selection Upgrade")
    print("=" * 75)
    print("[1] Initializing camera & MediaPipe Two-Hand Tracker (Chest-level)...")
    try:
        camera = ZeroTouchCamera(config.camera)
    except Exception as e:
        print(f"Error opening camera: {e}")
        sys.exit(1)

    print("[2] Initializing Two-Hand Gesture Engine...")
    engine = GestureEngine(config.gestures, config.filter)

    print("[3] Loading DICOM Patient Volume...")
    try:
        viewer = DICOMViewer(dicom_folder="assets")
        print(f"    Loaded DICOM with {viewer.total_slices} slices.")
    except Exception as e:
        print(f"Warning loading assets: {e}")
        viewer = DICOMViewer(dicom_folder="assets/sample_dicom_files")

    renderer = UIRenderer(config.ui)

    print("[4] Two-Hand Finger-Count Mode Selection:")
    print("    - 1 + 1 fingers (Hold ~0.6s) -> SLICE_NAVIGATION")
    print("    - 2 + 2 fingers (Hold ~0.6s) -> ZOOM")
    print("    - 3 + 3 fingers (Hold ~0.6s) -> WINDOWING")
    print("    - 4 + 4 fingers (Hold ~0.6s) -> PANNING")
    print("    - (Mismatched counts e.g. 1+2 or 2+3 do NOT change mode)")
    print("[5] Directional Actions (in active mode):")
    print("    - In SLICE_NAV: HAND + FIST -> Prev Slice | FIST + HAND -> Next Slice")
    print("    - In ZOOM:      HAND + FIST -> Zoom In    | FIST + HAND -> Zoom Out")
    print("    - In WINDOWING: HAND + FIST -> Prev Preset | FIST + HAND -> Next Preset")
    print("    - In PANNING:   HAND + FIST -> Pan Left   | FIST + HAND -> Pan Right")
    print("    - HAND + HAND (Both Open, Hold ~0.45s) -> Cycle Viewing Window Preset")
    print("    - NEUTRAL / BACKGROUND -> Stops all actions cleanly without reverse commands")
    print("[6] Keyboard Shortcuts:")
    print("    - 'M' (Cycle Mode), 'W' (Window Preset), 'D' (Diagnostics HUD), 'R' (Reset), 'Q'/'ESC' (Quit)")
    print("=" * 75)

    last_action_tag = "READY"

    try:
        while True:
            # 1. Grab camera frame and tracked two-hand data
            cam_frame, tracked_hands = camera.process_frame()
            if cam_frame is None:
                print("End of camera stream or camera disconnected.")
                break

            # 2. Update Two-Hand Gesture Engine
            action = engine.update(tracked_hands)

            # 3. Dispatch Actions to DICOM Viewer
            if action:
                act_name, val = action
                if act_name == "MODE_CHANGED":
                    confirmation_msg = f"{val} MODE SELECTED"
                    renderer.trigger_banner(confirmation_msg, color=(0, 255, 180), frames=35)
                    last_action_tag = f"MODE: {val}"
                    print(f"[EVENT] >> {confirmation_msg}")

                elif act_name == "WINDOW_CHANGED":
                    preset_name = viewer.cycle_viewing_window()
                    renderer.trigger_banner(f"WINDOW: {preset_name}", color=(0, 230, 255), frames=30)
                    last_action_tag = f"PRESET: {preset_name}"
                    print(f"[EVENT] >> Changed Viewing Window Preset -> {preset_name}")

                elif act_name == "SLICE_NEXT":
                    viewer.next_slice()
                    renderer.trigger_banner(f"SLICE >> {viewer.slice_index+1}", color=(0, 230, 255), frames=15)
                    last_action_tag = f"SLICE {viewer.slice_index+1}/{viewer.total_slices}"

                elif act_name == "SLICE_PREV":
                    viewer.prev_slice()
                    renderer.trigger_banner(f"<< SLICE {viewer.slice_index+1}", color=(0, 230, 255), frames=15)
                    last_action_tag = f"SLICE {viewer.slice_index+1}/{viewer.total_slices}"

                elif act_name == "ZOOM":
                    viewer.adjust_zoom(val)
                    last_action_tag = f"ZOOM {viewer.zoom_scale:.2f}x"

                elif act_name == "WINDOW_CENTER":
                    viewer.adjust_window_center(val)
                    last_action_tag = f"WC {int(viewer.window_center)}"

                elif act_name == "NEXT_PRESET":
                    preset_name = viewer.next_preset()
                    renderer.trigger_banner(f"PRESET: {preset_name}", color=(0, 230, 255), frames=25)
                    last_action_tag = f"PRESET: {preset_name}"
                    print(f"[ACTION] >> Next Viewing Preset -> {preset_name}")

                elif act_name == "PREV_PRESET":
                    preset_name = viewer.prev_preset()
                    renderer.trigger_banner(f"PRESET: {preset_name}", color=(0, 230, 255), frames=25)
                    last_action_tag = f"PRESET: {preset_name}"
                    print(f"[ACTION] >> Prev Viewing Preset -> {preset_name}")

                elif act_name == "PAN":
                    dx, dy = val
                    viewer.pan(dx, dy)
                    last_action_tag = f"PAN ({int(viewer.pan_x)}, {int(viewer.pan_y)})"

                elif act_name == "ACTION_STOP":
                    last_action_tag = "STOPPED"

            # 4. Render DICOM frame
            dicom_frame = viewer.get_current_frame(canvas_size=600)

            # 5. Render Camera HUD and Overlays
            cam_resized = cv2.resize(cam_frame, (600, 600))
            cam_overlay = renderer.render_camera_overlay(
                frame=cam_resized,
                mode_str=engine.get_current_mode_name(),
                pose_str=engine.current_pose.name,
                left_posture=engine.left_hand_posture,
                right_posture=engine.right_hand_posture,
                left_count=engine.left_finger_count,
                right_count=engine.right_finger_count,
                interaction_state=engine.interaction_state.value,
                debug_info=engine.debug_info,
                fps=camera.fps
            )

            # 6. Render DICOM HUD and Overlays
            dicom_overlay = renderer.render_dicom_overlay(
                dicom_frame=dicom_frame,
                slice_idx=viewer.slice_index,
                total_slices=viewer.total_slices,
                zoom_scale=viewer.zoom_scale,
                window_center=viewer.window_center,
                window_width=viewer.window_width,
                pan_x=viewer.pan_x,
                pan_y=viewer.pan_y,
                preset_name=viewer.PRESETS[viewer.preset_index]["name"],
                last_action_str=last_action_tag
            )

            # 7. Horizontal split presentation
            combined = cv2.hconcat([cam_overlay, dicom_overlay])
            cv2.imshow("ZeroTouch: Operating Room Medical Viewer", combined)

            # 8. Keyboard Controls for Tuning and Accessibility
            key = cv2.waitKey(1) & 0xFF
            if key == 27 or key == ord('q'):
                break
            elif key == ord('m') or key == ord('M'):
                new_mode = engine.cycle_mode()
                renderer.trigger_banner(f"{new_mode} MODE SELECTED", color=(0, 255, 180), frames=25)
            elif key == ord('w') or key == ord('W'):
                p_name = viewer.cycle_viewing_window()
                renderer.trigger_banner(f"WINDOW: {p_name}", color=(0, 230, 255), frames=25)
            elif key == ord('d') or key == ord('D'):
                renderer.toggle_debug()
            elif key == ord('r') or key == ord('R'):
                viewer.reset_viewport()
                renderer.trigger_banner("VIEWPORT RESET", color=(255, 255, 0), frames=20)

    except KeyboardInterrupt:
        print("\nExiting ZeroTouch cleanly...")
    finally:
        camera.release()
        cv2.destroyAllWindows()
        print("ZeroTouch resources released.")


if __name__ == "__main__":
    main()
