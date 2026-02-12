import cv2
from core.camera import ZeroTouchCamera
from core.gesture_engine import GestureEngine

def main():
    camera = ZeroTouchCamera()
    engine = GestureEngine()

    while True:
        frame, landmarks = camera.process_frame()

        if frame is None:
            break

        # Update gesture engine
        gesture = engine.update(landmarks)

        # If gesture detected, print and display
        if gesture:
            print("Gesture:", gesture)
            cv2.putText(
                frame,
                gesture,
                (50, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                3
            )

        cv2.imshow("ZeroTouch Vision Core", frame)

        # Press ESC to exit
        if cv2.waitKey(1) & 0xFF == 27:
            break

    camera.release()

if __name__ == "__main__":
    main()
