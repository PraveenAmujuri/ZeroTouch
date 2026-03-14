# ZeroTouch -- Touchless Medical Interface Prototype

![Python](https://img.shields.io/badge/Python-3.10-blue)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-green)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand%20Tracking-orange)

ZeroTouch is a computer vision--based touchless interface designed to
allow interaction with medical imaging systems without physical contact.
The system uses hand gesture recognition to control a DICOM image
viewer, enabling navigation and manipulation of medical scans in sterile
environments such as operating rooms.

The project demonstrates how computer vision and human-computer
interaction (HCI) can be combined to create intuitive and hygienic
medical interfaces.

------------------------------------------------------------------------

## Motivation

In operating rooms and sterile medical environments, doctors cannot
interact with keyboards or mice without breaking sterility. This project
explores a gesture-based interaction system where clinicians can control
medical images using simple hand movements detected by a webcam.

------------------------------------------------------------------------

## Key Features

### Touchless DICOM Viewer

-   Navigate medical image slices
-   Zoom in and out of scans
-   Adjust image brightness (window center)

### Real-Time Hand Tracking

-   Uses MediaPipe Hands to detect 21 hand landmarks
-   Works with a standard webcam

### Gesture Recognition Engine

Gestures are detected using: - Landmark movement vectors for swipe
detection - Euclidean distance between fingertips for pinch zoom -
Temporal filtering to reduce accidental triggers

### Lighting Robustness

Uses CLAHE (Contrast Limited Adaptive Histogram Equalization) to improve
detection under varying lighting conditions.

------------------------------------------------------------------------

## Tech Stack

Python\
OpenCV\
MediaPipe\
NumPy\
Tkinter\
pydicom

Domains: - Computer Vision - Human-Computer Interaction (HCI) - Medical
Imaging Interfaces

------------------------------------------------------------------------

## System Architecture

Webcam → MediaPipe Hand Detection → Landmark Extraction → Gesture Engine
→ DICOM Viewer Control

------------------------------------------------------------------------

## Supported Gestures

  Gesture                 Action
  ----------------------- -----------------------------
  Arm Gesture             Activate system interaction
  Index Finger Swipe      Navigate slices
  Pinch Open              Zoom In
  Pinch Close             Zoom Out
  Vertical Index Motion   Adjust brightness

------------------------------------------------------------------------

## Project Structure

```bash
ZeroTouch/
│
├── main.py
├── core/
│   ├── camera.py
│   └── gesture_engine.py
│
├── ui/
│   └── dicom_viewer.py
│
├── assets/
│   └── sample_dicom_files/
│
└── generate_sample_dicoms.py
```

------------------------------------------------------------------------

## Running the Project

### 1. Clone the repository

git clone https://github.com/PraveenAmujuri/ZeroTouch.git cd ZeroTouch

### 2. Install dependencies

pip install opencv-python mediapipe numpy pydicom

### 3. Generate sample DICOM data

python generate_sample_dicoms.py

### 4. Run the application

python main.py

------------------------------------------------------------------------

## Challenges & Limitations

Gesture recognition systems are sensitive to: - lighting conditions -
camera angle - hand occlusion

To mitigate this, the project uses gesture thresholds, temporal
filtering, and an interaction state machine.

This project is intended as a prototype demonstrating interaction design
rather than a production medical system.


