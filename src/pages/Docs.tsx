import React from 'react';
import { BookOpen, ExternalLink, Terminal, ShieldCheck, FileText } from 'lucide-react';

export const Docs: React.FC = () => {
  return (
    <div className="w-full bg-[#f7f7f9] py-16 px-6 md:px-16 lg:px-28">
      <div className="max-w-5xl mx-auto flex flex-col gap-14">
        
        {/* Title */}
        <div className="flex flex-col gap-4 text-center items-center">
          <div className="bg-primary-500 border-2 border-zinc-900 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-[2px_2px_0px_#27272a]">
            Clinical Reference & Architecture
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-zinc-900 tracking-tight">
            System Documentation
          </h1>
          <p className="text-zinc-600 max-w-xl text-base sm:text-lg">
            Engineering reference, research citation, and setup guide for the ZeroTouch medical gesture interface.
          </p>
        </div>

        {/* Paper Citation Block */}
        <div className="bg-white border-4 border-zinc-800 p-8 shadow-[6px_6px_0px_#27272a] flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary-500">
            <BookOpen className="w-4 h-4" />
            <span>Underlying Clinical Study</span>
          </div>
          <h2 className="font-display font-black text-2xl text-zinc-900">
            "Evaluating Usability of a Touchless Image Viewer in the Operating Room" (2020)
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Authored by Bockhacker et al., published in <em>International Journal of Computer Assisted Radiology and Surgery (IJCARS)</em>. Evaluated 5 fundamental two-hand interaction combinations in sterile surgical environments.
          </p>
          <a
            href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6989265/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-zinc-900 hover:text-secondary-500 underline underline-offset-4"
          >
            <span>Read Original PMC Article</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Technical Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-primary-50 border-4 border-zinc-800 p-6 shadow-[5px_5px_0px_#27272a] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary-600 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>1€ Adaptive Low-Pass Filter</span>
            </div>
            <h3 className="font-bold text-lg text-zinc-900">Landmark Jitter Reduction</h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              Min Cutoff: 1.2 Hz (smooth at rest)<br/>
              Beta: 0.50 (responsive in motion)<br/>
              Eliminates camera pixel noise without noticeable lag.
            </p>
          </div>

          <div className="bg-secondary-400/10 border-4 border-zinc-800 p-6 shadow-[5px_5px_0px_#27272a] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-secondary-500 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Safety Hysteresis</span>
            </div>
            <h3 className="font-bold text-lg text-zinc-900">Temporal Anti-Repeat Lock</h3>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              Hold Confirmation: ~0.60s<br/>
              Rearm Requirement: Neutral pose transition<br/>
              Anti-Repeat Lock: Single trigger per hold.
            </p>
          </div>

        </div>

        {/* Local Run Guide */}
        <div className="bg-zinc-900 text-white border-4 border-black p-8 shadow-[6px_6px_0px_#27272a] flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-tertiary-400">
            <FileText className="w-4 h-4" />
            <span>Python Gesture Engine Standalone Execution</span>
          </div>
          <h3 className="font-display font-bold text-xl">Running the Computer Vision Prototype</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">
            The core computer vision engine is written in Python using OpenCV and MediaPipe Hands:
          </p>
          <pre className="bg-black/60 border border-zinc-800 p-4 rounded text-xs font-mono text-emerald-400 overflow-x-auto">
{`# 1. Activate environment
.\\zerotouch_env\\Scripts\\activate

# 2. Run gesture engine with live medical viewer
python main.py

# 3. Run automated verification suite (10 unit tests)
python test_gesture_engine.py`}
          </pre>
        </div>

      </div>
    </div>
  );
};
