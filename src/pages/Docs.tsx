import React from 'react';
import { BookOpen, Terminal, ShieldCheck, FileText } from 'lucide-react';

export const Docs: React.FC = () => {
  return (
    <div className="w-full bg-[#f7f7f9] py-16 px-6 md:px-16 lg:px-28">
      <div className="max-w-5xl mx-auto flex flex-col gap-14">
        
        {/* Title */}
        <div className="flex flex-col gap-4 text-center items-center">
          <div className="bg-primary-500 border-2 border-zinc-900 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0px_#27272a]">
            0TOUCH TECHNICAL OVERVIEW
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-zinc-900 tracking-tight">
            System Architecture
          </h1>
          <p className="text-zinc-600 max-w-2xl text-base sm:text-lg">
            Technical documentation covering the browser-based architecture, gesture recognition pipeline, stabilization mechanisms and deployment of the 0Touch medical imaging interface.
          </p>
        </div>

        {/* Box 1: System Architecture */}
        <div className="bg-white border-4 border-zinc-800 p-8 shadow-[6px_6px_0px_#27272a] flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary-500">
            <BookOpen className="w-4 h-4" />
            <span>0TOUCH TECHNICAL OVERVIEW</span>
          </div>
          <h2 className="font-display font-black text-2xl text-zinc-900">
            System Architecture
          </h2>
          <div className="text-sm text-zinc-600 leading-relaxed space-y-3">
            <p>
              ZeroTouch operates an entirely client-side computer vision and interaction pipeline executed inside the browser without streaming video frames to an external server. The system translates live user movements into sterile viewport interactions through a six-stage dataflow:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-zinc-700">
              <li>
                <strong>Webcam Capture:</strong> Standard RGB video is captured via <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">getUserMedia</code> at 640×480 resolution (30 FPS) with horizontal mirroring for natural proprioceptive feedback.
              </li>
              <li>
                <strong>MediaPipe Hand Detection:</strong> Frames are processed by MediaPipe Tasks Vision (<code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">HandLandmarker</code>) to track up to two hands simultaneously, inferring 21 3D spatial landmarks ($X, Y, Z$) per hand.
              </li>
              <li>
                <strong>Landmark Normalization:</strong> Raw coordinates are calibrated against each hand's anatomical palm scale (the Euclidean distance between the wrist and the middle MCP joint). This creates scale-invariance, ensuring identical recognition regardless of distance from the camera.
              </li>
              <li>
                <strong>Finger Extension &amp; Posture Classification:</strong> Individual fingers (Thumb, Index, Middle, Ring, Pinky) are evaluated using relative fingertip-to-wrist and knuckle-to-wrist distance vectors. Hands are categorized into discrete anatomical postures (<code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">OPEN HAND</code>, <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">CLOSED FIST</code>, or finger count 1–4).
              </li>
              <li>
                <strong>Two-Hand State Machine:</strong> The controller evaluates bilateral configurations (e.g. matching finger counts for mode selection, or complementary <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">HAND+FIST</code> / <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">FIST+HAND</code> poses for directional actions) with temporal hold confirmation and anti-repeat locks.
              </li>
              <li>
                <strong>DICOM Viewer Integration:</strong> Confirmed gesture events emit strongly typed actions (<code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">SLICE_NEXT</code>, <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">ZOOM</code>, <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">PAN</code>, <code className="text-xs bg-zinc-100 px-1.5 py-0.5 border border-zinc-300 rounded font-mono">WINDOW_CHANGED</code>) directly into the viewer canvas render loop.
              </li>
            </ol>
          </div>
        </div>

        {/* Technical Architecture: Box 2 and Box 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Box 2: 1€ Adaptive Low-Pass Filter */}
          <div className="bg-primary-50 border-4 border-zinc-800 p-6 shadow-[5px_5px_0px_#27272a] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary-600 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>1€ Adaptive Low-Pass Filter</span>
            </div>
            <h3 className="font-bold text-lg text-zinc-900">Landmark Jitter Reduction</h3>
            <div className="text-xs text-zinc-600 leading-relaxed space-y-2">
              <p>
                Optical tracking via standard webcams inherently suffers from high-frequency coordinate noise (sensor pixel noise, lighting variations, and micro-tremor). Traditional static low-pass filters introduce sluggish phase lag during rapid hand movements, while unfiltered tracking triggers accidental posture switching.
              </p>
              <p>
                0Touch applies Casiez et al.'s <strong>1€ Filter</strong> across all 21 3D coordinates per hand before posture classification:
              </p>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-zinc-700">
                <li>
                  <strong>Min Cutoff (1.2 Hz):</strong> Baseline cutoff frequency when hands are stationary. Aggressively smooths resting landmark coordinates to eliminate visual jitter and twitching.
                </li>
                <li>
                  <strong>Speed Coefficient (Beta = 0.50):</strong> Dynamically scales the cutoff frequency as velocity increases. As the operator moves their hands or transitions postures, lag drops to near zero for instant tracking.
                </li>
                <li>
                  <strong>Derivative Cutoff (1.0 Hz):</strong> Low-pass filter for the estimated velocity signal, preventing sudden acceleration spikes from distorting dynamic cutoff calculations.
                </li>
              </ul>
            </div>
          </div>

          {/* Box 3: Gesture Confirmation & Temporal Control */}
          <div className="bg-secondary-400/10 border-4 border-zinc-800 p-6 shadow-[5px_5px_0px_#27272a] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-secondary-500 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Gesture Confirmation &amp; Temporal Control</span>
            </div>
            <h3 className="font-bold text-lg text-zinc-900">Temporal State Machine</h3>
            <div className="text-xs text-zinc-600 leading-relaxed space-y-2">
              <p>
                To avoid accidental triggers while a clinician positions their hands, 0Touch enforces temporal stability confirmation and clutch rearming:
              </p>
              <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-zinc-700">
                <li>
                  <strong>Mode Selection Hold (~0.60s):</strong> Matching finger counts (1+1 to 4+4) must remain steady for 600ms before switching modes. An anti-repeat latch fires exactly once per hold.
                </li>
                <li>
                  <strong>Neutral Rearming:</strong> Once a mode is selected, the operator must return to neutral (<code className="bg-zinc-100 px-1 py-0.5 border border-zinc-300 rounded">BACKGROUND</code> or <code className="bg-zinc-100 px-1 py-0.5 border border-zinc-300 rounded">FIST+FIST</code>) before another mode switch is permitted.
                </li>
                <li>
                  <strong>Window Preset Hold (~0.45s) &amp; Cooldown (0.60s):</strong> Both hands open (5+5) cycles window presets after 450ms, followed by a 600ms blackout cooldown.
                </li>
                <li>
                  <strong>Discrete vs. Continuous Cadence:</strong> Slices step incrementally at a <strong>0.28s</strong> repeat cadence; continuous zoom updates at a high-frequency <strong>0.03s</strong> (~33 FPS) throttle.
                </li>
                <li>
                  <strong>Tracking Loss Failsafe:</strong> If hand count drops below 2, active interactions halt immediately (<code className="bg-zinc-100 px-1 py-0.5 border border-zinc-300 rounded">ACTION_STOP</code>) and filter caches are cleared.
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Box 4: Browser Runtime & Deployment */}
        <div className="bg-zinc-900 text-white border-4 border-black p-8 shadow-[6px_6px_0px_#27272a] flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-tertiary-400">
            <FileText className="w-4 h-4" />
            <span>BROWSER-BASED APPLICATION</span>
          </div>
          <h2 className="font-display font-black text-xl text-white">
            Browser Runtime &amp; Deployment
          </h2>
          <div className="text-sm text-zinc-300 leading-relaxed space-y-3">
            <p>
              0Touch runs as a browser-native application built with React, TypeScript and Vite. Its gesture recognition pipeline uses MediaPipe Tasks Vision to process webcam input directly in the browser, without requiring a separate Python backend for gesture detection.
            </p>
            <p>
              Standard video frames are acquired via the browser's <code className="text-emerald-400 font-mono text-xs">navigator.mediaDevices.getUserMedia</code> API, routed to a hidden video element, and processed per animation frame. MediaPipe Tasks Vision extracts 21 3D hand landmarks on the client CPU/GPU. The landmark coordinates are smoothed in real time with the 1€ filter and mapped through the gesture state machine. Confirmed actions are dispatched directly into the DICOM viewer canvas via native HTML5 Canvas rendering and <code className="text-emerald-400 font-mono text-xs">dicom-parser</code> pixel decoders (supporting 8-bit/16-bit grayscale and color palette modalities).
            </p>
            <div className="pt-2 border-t border-zinc-800">
              <span className="block text-xs font-mono uppercase text-zinc-400 mb-2">Technical Details:</span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono text-zinc-300">
                <li>• <strong>Frontend:</strong> React + TypeScript</li>
                <li>• <strong>Development &amp; Build:</strong> Vite</li>
                <li>• <strong>Hand Tracking:</strong> MediaPipe Tasks Vision</li>
                <li>• <strong>Camera Access:</strong> Browser getUserMedia API</li>
                <li>• <strong>DICOM Parser:</strong> dicom-parser (HTML5 Canvas)</li>
                <li>• <strong>Deployment:</strong> Vercel</li>
              </ul>
            </div>
            <p className="text-xs text-zinc-400 pt-1">
              <em>Note:</em> The repository also contains an initial Python gesture engine in <code className="text-zinc-300 font-mono">core/</code> and <code className="text-zinc-300 font-mono">main.py</code>, which served as the reference research prototype that informed this modern, zero-install browser-native TypeScript deployment.
            </p>
          </div>
          <pre className="bg-black/60 border border-zinc-800 p-4 rounded text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{`# 1. Install dependencies
npm install

# 2. Start local Vite development server
npm run dev

# 3. Production build (TypeScript compilation & Vite bundle)
npm run build`}
          </pre>
        </div>

      </div>
    </div>
  );
};
