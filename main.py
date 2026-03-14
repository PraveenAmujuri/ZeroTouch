import cv2
from core.camera import ZeroTouchCamera
from core.gesture_engine import GestureEngine
from ui.dicom_viewer import DICOMViewer

def main():
    camera = ZeroTouchCamera()
    engine = GestureEngine()
    viewer = DICOMViewer()
    last_gesture = "NONE"

    # Sensitivity for brightness only
    # Increasing this makes the brightness change faster with vertical hand movement
    BRIGHTNESS_SENSITIVITY = 250 

    while True:
        cam_frame, landmarks = camera.process_frame()
        if cam_frame is None:
            break

        gesture = engine.update(landmarks)
        if gesture:
            last_gesture = gesture

        if gesture:
            if gesture == "SWIPE RIGHT":
                viewer.next_slice()
                print(">>> NEXT SLICE")
            elif gesture == "SWIPE LEFT":
                viewer.prev_slice()
                print(">>> PREV SLICE")
            elif "ZOOM IN" in gesture:
                viewer.zoom_in()
                print(">>> ZOOM IN")
            elif "ZOOM OUT" in gesture:
                viewer.zoom_out()
                print(">>> ZOOM OUT")
            elif isinstance(gesture, tuple) and gesture[0] == "BRIGHTNESS":
                _, dy = gesture
                viewer.adjust_window_center(-dy * 200)  # Reduced sensitivity


        # Rendering
        dicom_frame = viewer.get_current_frame()
        cam_resized = cv2.resize(cam_frame, (600, 600))
        dicom_color = cv2.cvtColor(dicom_frame, cv2.COLOR_GRAY2BGR)

        # UI Overlay - System Status
        status_color = (0, 255, 0) if engine.state == "ARMED" else (0, 0, 255)
        cv2.putText(
            cam_resized,
            f"SYSTEM: {engine.state}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            status_color,
            2
        )
        cv2.putText(
        cam_resized,
        f"GESTURE: {last_gesture}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 0),
        2
        )
        # Displaying current Brightness (Window Center) for feedback
        cv2.putText(
            dicom_color,
            f"Slice: {viewer.slice_index+1}/{viewer.total_slices}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0,255,255),
            2
        )

        cv2.putText(
            dicom_color,
            f"Zoom: {viewer.zoom_scale:.2f}x",
            (20, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0,255,255),
            2
        )

        cv2.putText(
            dicom_color,
            f"Brightness: {int(viewer.window_center)}",
            (20, 120),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0,255,255),
            2
        )

        cv2.putText(
            dicom_color,
            f"Gesture: {last_gesture}",
            (20, 160),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0,255,255),
            2
        )

        # Combine camera view and DICOM viewer
        combined = cv2.hconcat([cam_resized, dicom_color])
        cv2.imshow("ZeroTouch Radiology: Brightness & Navigation Mode", combined)

        # Press ESC to exit
        if cv2.waitKey(1) & 0xFF == 27:
            break

    camera.release()

if __name__ == "__main__":
    main()