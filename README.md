# 0Touch — Touchless Medical Imaging Interface

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Vite](https://img.shields.io/badge/Vite-6.0-purple)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-orange)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8)
![Python](https://img.shields.io/badge/Python-3.10%20(Prototype)-green)

0Touch is a zero-install, browser-native touchless medical imaging application engineered for sterile clinical environments such as operating rooms and radiological reading rooms. By coupling client-side computer vision with the **1€ adaptive low-pass filter** and a sterile two-hand state machine, clinicians can navigate and manipulate DICOM studies touchlessly using a standard webcam.

---

## Key Highlights

- **100% Client-Side Browser Execution**: Real-time hand tracking and DICOM parsing happen completely inside the browser using MediaPipe Tasks Vision and HTML5 Canvas. No video streams or protected medical images ever leave the user's device.
- **Sterile Two-Handed Interaction Pipeline**: Based on operating room human-computer interaction (HCI) research. Employs matching finger-count mode selection and complementary hand postures to eliminate accidental triggers.
- **1€ Adaptive Jitter Filtering**: Suppresses high-frequency sensor noise and micro-tremor when hands are resting ($f_{c,min} = 1.2\text{ Hz}$), while dynamically dropping latency to near zero during motion ($\beta = 0.50$, $f_{c,d} = 1.0\text{ Hz}$).
- **Temporal Anti-Repeat & Stability Control**: Enforces hold confirmation timers, discrete stepping cadences ($0.28\text{s}$), and mandatory neutral-state rearming to prevent runaway slice advancement.
- **Broad DICOM Modality Support**: Decodes multi-frame cine series and single slices supporting 8-bit/16-bit signed/unsigned grayscale (`MONOCHROME1`, `MONOCHROME2`) and RGB / Palette Color lookup tables (`PALETTE COLOR`).

---

## Supported Gesture Operating Modes

Modes are engaged by holding matching finger counts on both hands for **~0.60s** (requires return to neutral/fist rest to rearm):

| Mode | Trigger Pose | Hand + Fist (Dir A) | Fist + Hand (Dir B) | Continuous Hold Action |
| :--- | :--- | :--- | :--- | :--- |
| **Slice Navigation** | **1 + 1** (Index fingers) | Step Backward 1 Slice | Step Forward 1 Slice | Continuous repeat at $0.28\text{s}$ intervals |
| **Continuous Zoom** | **2 + 2** (Index & Middle) | Zoom In (Magnify) | Zoom Out (Demagnify) | Smooth scaling throttled at $0.03\text{s}$ (~33 FPS) |
| **Clinical Windowing** | **3 + 3** (Three fingers) | Previous Calibrated Preset | Next Calibrated Preset | Cycles presets (Abdomen, Bone, Lung, Brain) |
| **Step-Based Panning** | **4 + 4** (Four fingers) | Pan Left / Up | Pan Right / Down | Cardinal stepping (1+1 Left, 2+2 Right, 3+3 Up, 4+4 Down) |
| **Window Preset Quick-Cycle** | **5 + 5** (Both hands open) | Advance viewing preset | Advance viewing preset | Hold for $0.45\text{s}$ followed by $0.60\text{s}$ cooldown |
| **Safety Rest / Neutral** | **Fist + Fist** or Relaxed | Neutral clutch / Stop | Neutral clutch / Stop | Immediately stops active viewer actions |

---

## Technical Architecture

```text
Webcam Stream (getUserMedia @ 640x480, 30 FPS)
   │
   ▼
MediaPipe Tasks Vision (HandLandmarker Client Model)
   │ (Tracks 21 3D landmarks per hand)
   ▼
1€ Adaptive Low-Pass Filter
   │ (fc_min = 1.2 Hz, beta = 0.50, d_cutoff = 1.0 Hz)
   ▼
Anatomical Palm-Scale Normalization & Finger Extension Classifier
   │ (Invariance against camera distance: ||Wrist - Middle MCP||)
   ▼
Two-Hand State Machine & Temporal Filter
   │ (Mode hold: 0.60s, Repeat cadence: 0.28s, Neutral rearm)
   ▼
Action Dispatcher -> HTML5 Canvas DICOM Viewer Render Loop
   │ (dicom-parser volume decoder, windowing, pan, zoom, cine)
```

---

## Project Structure

```text
ZeroTouch/
├── src/
│   ├── components/       # Shared UI (Navbar, Footer, Logo, Animated FooterLogo)
│   ├── gestures/         # Core Browser-Native Gesture Engine
│   │   ├── fingerDetection.ts      # Anatomical finger states & posture classifiers
│   │   ├── gestureClassifier.ts    # Two-hand pose combination matcher
│   │   ├── gestureController.ts    # MediaPipe lifecycle & camera pipeline manager
│   │   ├── gestureSmoothing.ts     # 1€ adaptive filter (OneEuroFilter1D/3D)
│   │   ├── gestureStateMachine.ts  # Temporal hold timers, anti-repeat locks & cadences
│   │   ├── handTracker.ts          # MediaPipe Tasks Vision wrapper
│   │   └── types.ts                # Gesture engine TypeScript interfaces
│   ├── pages/            # Application views
│   │   ├── Home.tsx                # Hero banner & interactive product overview
│   │   ├── Features.tsx            # Interactive gesture gallery & control guide
│   │   ├── Docs.tsx                # Technical system documentation
│   │   ├── Viewer.tsx              # Full-featured touchless DICOM medical viewer
│   │   └── GestureTester.tsx       # Live diagnostic & calibration testing lab
│   └── utils/
│       ├── dicomLoader.ts          # dicom-parser decoder (Monochrome, Palette Color, Cine)
│       └── indexedDB.ts            # Local client study caching & persistence
├── core/                 # Reference Python Prototype Engine
│   ├── camera.py                   # OpenCV video capture
│   ├── config.py                   # Centralized thresholds & filter parameters
│   ├── gesture_engine.py           # Python two-hand state machine
│   └── landmarks.py                # Python 1€ filter & feature extractor
├── main.py               # Standalone Python desktop launcher with PyDICOM viewer
├── test_gesture_engine.py# Automated Python engine verification test suite (10 unit tests)
├── package.json
└── vite.config.ts
```

---

## Getting Started (Web Application)

### Prerequisites

- Modern browser with WebAssembly & WebRTC support (Google Chrome, Microsoft Edge, Opera, Brave).
- Standard integrated or USB webcam.

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/PraveenAmujuri/ZeroTouch.git
cd ZeroTouch

# 2. Install dependencies
npm install

# 3. Launch the Vite development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build

```bash
# Type-check and bundle for production deployment (Vercel, Netlify, etc.)
npm run build

# Preview the local production build
npm run preview
```

---

## Reference Python Desktop Prototype

The repository includes the original Python standalone prototype in `core/` and `main.py`, which informed the browser-native TypeScript engine:

```bash
# 1. Activate the verified virtual environment
.\zerotouch_env\Scripts\activate

# 2. Run the desktop prototype with PyDICOM viewer
python main.py

# 3. Run the automated 10-test verification suite
python test_gesture_engine.py
```

---

## License & Credits

- Inspired by surgical human-computer interaction research in touchless sterile imaging.
- 1€ Filter: Casiez, Roussel, & Vogel (CHI 2012).
- Hand Tracking: Google MediaPipe Tasks Vision.
