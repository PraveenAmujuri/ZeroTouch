import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileCheck,
  Video,
  Layers,
  ZoomIn,
  ZoomOut,
  Sliders,
  Move,
  RotateCcw,
  Camera,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const Viewer: React.FC = () => {
  // DICOM Viewer State
  const [currentFile, setCurrentFile] = useState<string>('0003.dcm');
  const [patientName, setPatientName] = useState<string>('Rubo DEMO (Biplane Angio)');
  const [modality, setModality] = useState<string>('XA (Angiography)');
  const [totalSlices, setTotalSlices] = useState<number>(17);
  const [currentSlice, setCurrentSlice] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [currentPreset, setCurrentPreset] = useState<string>('NATIVE / DEFAULT');
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewSrc, setPreviewSrc] = useState<string>('/sample_angio.png');
  const [uploadStatus, setUploadStatus] = useState<string>('Ready • Loaded Sample 0003.dcm');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<string>('SLICE_NAV');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = ['NATIVE / DEFAULT', 'HIGH CONTRAST', 'BRIGHT GAIN', 'BONE', 'SOFT TISSUE', 'LUNG'];

  // Handle Loading sample file 0003.dcm
  const handleLoadSample0003 = () => {
    setCurrentFile('0003.dcm');
    setPatientName('Rubo DEMO (Clinical Biplane)');
    setModality('XA (Angiography Multi-frame)');
    setTotalSlices(17);
    setCurrentSlice(1);
    setZoomLevel(1.0);
    setCurrentPreset('NATIVE / DEFAULT');
    setPanPos({ x: 0, y: 0 });
    setPreviewSrc('/sample_angio.png');
    setUploadStatus('Loaded clinical sample 0003.dcm (17 frames)');
  };

  // Handle Loading sample file 0020.dcm (Echo ultrasound)
  const handleLoadSample0020 = () => {
    setCurrentFile('0020.DCM');
    setPatientName('Rubo DEMO (Echocardiogram)');
    setModality('US (Ultrasound Cine PALETTE COLOR)');
    setTotalSlices(11);
    setCurrentSlice(1);
    setZoomLevel(1.0);
    setCurrentPreset('DEFAULT / NATIVE');
    setPanPos({ x: 0, y: 0 });
    setPreviewSrc('/sample_echo.png');
    setUploadStatus('Loaded clinical sample 0020.DCM (11 frames)');
  };

  // Handle Loading sample MRBRAIN
  const handleLoadSampleMR = () => {
    setCurrentFile('MRBRAIN.DCM');
    setPatientName('MR/BRAIN/GRASE/1024');
    setModality('MR (Brain Axial Scan)');
    setTotalSlices(1);
    setCurrentSlice(1);
    setZoomLevel(1.0);
    setCurrentPreset('HIGH CONTRAST');
    setPanPos({ x: 0, y: 0 });
    setPreviewSrc('/sample_mrbrain.png');
    setUploadStatus('Loaded clinical sample MRBRAIN.DCM');
  };

  // Handle custom file upload or drop
  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.dcm') && !file.name.toLowerCase().endsWith('.dicom')) {
      setUploadStatus(`Warning: ${file.name} is not a standard .dcm extension, but loaded for staging.`);
    } else {
      setUploadStatus(`Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }
    setCurrentFile(file.name);
    setPatientName(`Custom Scan: ${file.name}`);
    setModality('User DICOM File');
    setTotalSlices(1);
    setCurrentSlice(1);
    setZoomLevel(1.0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-secondary-500">
      
      {/* 1. TOP MEDICAL APP HEADER BAR */}
      <header className="h-16 bg-zinc-900 border-b-2 border-zinc-800 px-4 sm:px-6 flex items-center justify-between z-20">
        
        {/* Left: Back to Marketing site & Workspace Name */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white px-3 py-1.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Website</span>
          </Link>

          <div className="h-5 w-px bg-zinc-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display font-black text-sm tracking-tight text-white uppercase">
              ZeroTouch <span className="text-secondary-400">Workspace</span>
            </span>
            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 border border-zinc-700 rounded">
              v2.4 OR-Ready
            </span>
          </div>
        </div>

        {/* Center: Active Gesture Mode Badges */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-xs">
          <span className="text-zinc-500 font-bold uppercase text-[10px] mr-1">Gesture Mode:</span>
          {[
            { id: 'SLICE_NAV', label: '1+1: SLICE', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: 'ZOOM', label: '2+2: ZOOM', icon: <ZoomIn className="w-3.5 h-3.5" /> },
            { id: 'WINDOWING', label: '3+3: WINDOW', icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: 'PANNING', label: '4+4: PAN', icon: <Move className="w-3.5 h-3.5" /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className={`px-2.5 py-1 flex items-center gap-1.5 border text-xs font-bold transition-all ${
                activeMode === m.id
                  ? 'bg-secondary-500 border-zinc-900 text-zinc-950 shadow-[2px_2px_0px_#fff]'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Camera / CV connection indicator */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/90 border border-zinc-700 rounded text-emerald-400">
            <Camera className="w-3.5 h-3.5" />
            <span className="font-bold hidden sm:inline">Camera: READY (30 FPS)</span>
          </div>
        </div>

      </header>


      {/* 2. MAIN WORKSPACE VIEWPORT GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* Left Side: Medical Controls, File Uploader & Sample Picker */}
        <div className="lg:col-span-3 bg-zinc-900/90 border-r-2 border-zinc-800 p-5 flex flex-col gap-5 overflow-y-auto">
          
          {/* DICOM File Upload & Drag-and-Drop Dropzone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>DICOM Ingestion</span>
              <span className="text-[10px] text-zinc-500 font-mono">.dcm / .dicom</span>
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-5 text-center cursor-pointer transition-colors flex flex-col items-center gap-2 ${
                isDragging
                  ? 'border-secondary-500 bg-secondary-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800'
              }`}
            >
              <Upload className="w-7 h-7 text-secondary-400 animate-pulse" />
              <div className="text-xs font-bold text-zinc-200">
                Drop DICOM scan here
              </div>
              <div className="text-[10px] text-zinc-500">
                or click to browse local files
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm,.dicom"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>

          {/* Sample Files Selector */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-tertiary-400" />
              <span>Bundled Clinical Scans</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleLoadSample0003}
                className={`p-3 text-left border text-xs font-mono transition-all flex flex-col gap-1 ${
                  currentFile === '0003.dcm'
                    ? 'bg-zinc-800 border-secondary-500 text-white shadow-sm'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-secondary-400">0003.dcm</span>
                  <span className="text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded text-white">XA Angio</span>
                </div>
                <div className="text-[11px] text-zinc-400">17 frames • 512×512 • 8-bit</div>
              </button>

              <button
                onClick={handleLoadSample0020}
                className={`p-3 text-left border text-xs font-mono transition-all flex flex-col gap-1 ${
                  currentFile === '0020.DCM'
                    ? 'bg-zinc-800 border-secondary-500 text-white shadow-sm'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-tertiary-400">0020.DCM</span>
                  <span className="text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded text-white">US Echo</span>
                </div>
                <div className="text-[11px] text-zinc-400">11 frames • 430×600 • Palette Color</div>
              </button>

              <button
                onClick={handleLoadSampleMR}
                className={`p-3 text-left border text-xs font-mono transition-all flex flex-col gap-1 ${
                  currentFile === 'MRBRAIN.DCM'
                    ? 'bg-zinc-800 border-secondary-500 text-white shadow-sm'
                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary-300">MRBRAIN.DCM</span>
                  <span className="text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded text-white">MR Brain</span>
                </div>
                <div className="text-[11px] text-zinc-400">1 slice • 512×512 • 12-bit uint16</div>
              </button>
            </div>
          </div>

          {/* Interactive Inspection Toolbars (Slice, Zoom, Windowing, Pan) */}
          <div className="flex flex-col gap-3 pt-2 border-t border-zinc-800">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Interactive Tools
            </span>

            {/* Slice Stepper */}
            <div className="bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-300">Slice Index:</span>
                <span className="font-mono text-secondary-400 font-bold">{currentSlice} / {totalSlices}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={currentSlice <= 1}
                  onClick={() => setCurrentSlice(prev => Math.max(1, prev - 1))}
                  className="flex-1 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-xs font-mono font-bold"
                >
                  ◀ Prev
                </button>
                <button
                  disabled={currentSlice >= totalSlices}
                  onClick={() => setCurrentSlice(prev => Math.min(totalSlices, prev + 1))}
                  className="flex-1 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-xs font-mono font-bold"
                >
                  Next ▶
                </button>
              </div>
            </div>

            {/* Zoom Stepper */}
            <div className="bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-300">Zoom Scale:</span>
                <span className="font-mono text-secondary-400 font-bold">{zoomLevel.toFixed(2)}x</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.4, Number((prev - 0.2).toFixed(2))))}
                  className="flex-1 py-1.5 bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center gap-1 text-xs font-mono font-bold"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span>Out</span>
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(3.5, Number((prev + 0.2).toFixed(2))))}
                  className="flex-1 py-1.5 bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center gap-1 text-xs font-mono font-bold"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>In</span>
                </button>
              </div>
            </div>

            {/* Windowing Presets */}
            <div className="bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-300">Window Preset:</span>
                <span className="font-mono text-tertiary-400 font-bold text-[11px] truncate">{currentPreset}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {presets.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPreset(p)}
                    className={`py-1 px-2 text-[10px] font-mono font-bold border truncate ${
                      currentPreset === p
                        ? 'bg-tertiary-400 text-zinc-950 border-white'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Panning 4-way step buttons */}
            <div className="bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-300">Step Panning:</span>
                <span className="font-mono text-zinc-400 text-[11px]">({panPos.x}, {panPos.y}) px</span>
              </div>
              <div className="grid grid-cols-3 gap-1 w-full max-w-[180px] mx-auto text-center font-mono text-xs">
                <div />
                <button
                  onClick={() => setPanPos(p => ({ ...p, y: p.y - 25 }))}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1.5 font-bold"
                >
                  ▲
                </button>
                <div />
                <button
                  onClick={() => setPanPos(p => ({ ...p, x: p.x - 25 }))}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1.5 font-bold"
                >
                  ◀
                </button>
                <button
                  onClick={() => setPanPos({ x: 0, y: 0 })}
                  className="bg-zinc-800 hover:bg-zinc-700 p-1.5 text-[10px] font-bold text-zinc-400"
                >
                  RST
                </button>
                <button
                  onClick={() => setPanPos(p => ({ ...p, x: p.x + 25 }))}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1.5 font-bold"
                >
                  ▶
                </button>
                <div />
                <button
                  onClick={() => setPanPos(p => ({ ...p, y: p.y + 25 }))}
                  className="bg-zinc-700 hover:bg-zinc-600 p-1.5 font-bold"
                >
                  ▼
                </button>
                <div />
              </div>
            </div>

            {/* Reset Viewport */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanPos({ x: 0, y: 0 });
                setCurrentPreset('NATIVE / DEFAULT');
                setCurrentSlice(1);
              }}
              className="py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-xs font-mono font-bold flex items-center justify-center gap-1.5 text-zinc-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Viewport</span>
            </button>
          </div>

        </div>


        {/* Central Viewport & Telemetry HUD */}
        <div className="lg:col-span-6 bg-black relative flex flex-col justify-between p-4 overflow-hidden border-b-2 lg:border-b-0 lg:border-r-2 border-zinc-800">
          
          {/* Top Viewport Telemetry Overlay Card */}
          <div className="z-10 bg-zinc-900/85 border border-zinc-700 p-3 rounded font-mono text-xs max-w-sm backdrop-blur-md">
            <div className="text-secondary-400 font-bold uppercase tracking-wider text-[11px] mb-1">
              PATIENT: {patientName}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-300 text-[11px]">
              <div>File: <span className="text-white font-bold">{currentFile}</span></div>
              <div>Modality: <span className="text-white font-bold">{modality.split(' ')[0]}</span></div>
              <div>Slice: <span className="text-white font-bold">{currentSlice} / {totalSlices}</span></div>
              <div>Zoom: <span className="text-white font-bold">{zoomLevel}x</span></div>
              <div>Preset: <span className="text-tertiary-400 font-bold">{currentPreset}</span></div>
              <div>Offset: <span className="text-white font-bold">({panPos.x}, {panPos.y})</span></div>
            </div>
          </div>

          {/* Central Medical Image Canvas Viewport */}
          <div className="absolute inset-0 flex items-center justify-center p-8 overflow-hidden pointer-events-none">
            <div
              style={{
                transform: `scale(${zoomLevel}) translate(${panPos.x}px, ${panPos.y}px)`,
                transition: 'transform 0.15s ease-out'
              }}
              className="relative max-w-full max-h-full flex items-center justify-center"
            >
              <img
                src={previewSrc}
                alt="DICOM Viewport Active Render"
                className="max-h-[520px] w-auto object-contain border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] filter contrast-125"
              />
            </div>
          </div>

          {/* Bottom Live Gesture Status Toast */}
          <div className="z-10 flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3 rounded text-xs font-mono backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300">
                Active Pose: <strong className="text-white">MATCHING COUNTS</strong> ({activeMode})
              </span>
            </div>
            <span className="text-[11px] text-tertiary-400 font-bold">
              Neutral Release Ready
            </span>
          </div>

        </div>


        {/* Right Side: Camera Mirror & Clinical Study Guidelines */}
        <div className="lg:col-span-3 bg-zinc-900/90 p-5 flex flex-col gap-5 overflow-y-auto">
          
          {/* Simulated Webcam Tracker Card */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-primary-400" />
                <span>Webcam Stream</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400">CONNECTED</span>
            </div>

            <div className="relative aspect-video bg-zinc-950 border-2 border-zinc-800 overflow-hidden rounded flex items-center justify-center">
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:20px_20px]" />
              
              {/* Silhouette hands simulation */}
              <div className="flex items-center justify-around w-full px-8 text-zinc-600 font-mono text-xs z-10">
                <div className="border border-zinc-700 bg-zinc-900/80 p-2 text-center rounded">
                  <div className="text-emerald-400 font-bold">LEFT HAND</div>
                  <div className="text-[10px]">Tracked (Chest)</div>
                </div>
                <div className="border border-zinc-700 bg-zinc-900/80 p-2 text-center rounded">
                  <div className="text-emerald-400 font-bold">RIGHT HAND</div>
                  <div className="text-[10px]">Tracked (Chest)</div>
                </div>
              </div>

              <div className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/70 text-zinc-400 px-1.5 py-0.5 rounded">
                640×480 • 1€ Filter Active
              </div>
            </div>
          </div>

          {/* Ingestion & Upload Status */}
          <div className="bg-zinc-800/60 border border-zinc-700 p-3 flex flex-col gap-1.5">
            <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Status Feed</span>
            </div>
            <div className="font-mono text-[11px] text-zinc-400 break-words">
              {uploadStatus}
            </div>
          </div>

          {/* Quick Gesture Guide Card */}
          <div className="bg-zinc-800/40 border border-zinc-700 p-4 flex flex-col gap-3">
            <div className="text-xs font-black uppercase tracking-wider text-secondary-400">
              OR Gesture Reference
            </div>

            <div className="flex flex-col gap-2 font-mono text-[11px] text-zinc-300">
              <div className="flex justify-between border-b border-zinc-700 pb-1">
                <span className="text-zinc-400">1 + 1 fingers:</span>
                <span className="font-bold text-white">Slice Navigation</span>
              </div>
              <div className="flex justify-between border-b border-zinc-700 pb-1">
                <span className="text-zinc-400">2 + 2 fingers:</span>
                <span className="font-bold text-white">Continuous Zoom</span>
              </div>
              <div className="flex justify-between border-b border-zinc-700 pb-1">
                <span className="text-zinc-400">3 + 3 fingers:</span>
                <span className="font-bold text-white">Windowing Presets</span>
              </div>
              <div className="flex justify-between border-b border-zinc-700 pb-1">
                <span className="text-zinc-400">4 + 4 fingers:</span>
                <span className="font-bold text-white">Step Panning</span>
              </div>
              <div className="flex justify-between pt-0.5 text-secondary-400">
                <span>Fist + Fist:</span>
                <span className="font-bold">Safety Rest Pause</span>
              </div>
            </div>
          </div>

          {/* Phase 2 Cornerstone Notice */}
          <div className="bg-primary-900/30 border border-primary-500/40 p-3 rounded text-[11px] text-zinc-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
            <span>
              Phase 1 Frontend Architecture complete. Cornerstone3D & client-side MediaPipe WASM hooks staged for Phase 2 integration.
            </span>
          </div>

        </div>

      </div>

    </div>
  );
};
