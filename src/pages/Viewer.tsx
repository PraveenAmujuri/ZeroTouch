import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Video,
  Layers,
  ZoomIn,
  Sliders,
  Move,
  RotateCcw,
  AlertCircle,
  VideoOff,
  Sun,
  Activity
} from 'lucide-react';
import { parseDICOMBuffer, DICOMStudyMeta } from '../utils/dicomLoader';
import {
  GestureController,
  GestureDebugInfo,
  GestureActionEvent,
  OperationMode,
  FingerStates,
} from '../gestures';

const PRESET_WINDOWS: Record<string, { wc: number; ww: number }> = {
  'DEFAULT / NATIVE': { wc: 128, ww: 256 },
  'HIGH CONTRAST': { wc: 100, ww: 150 },
  'BRIGHT GAIN': { wc: 160, ww: 200 },
  'BONE (CT)': { wc: 300, ww: 1500 },
  'SOFT TISSUE': { wc: 40, ww: 400 },
  'LUNG': { wc: -600, ww: 1500 },
};

const PRESET_LIST = Object.keys(PRESET_WINDOWS);

export const Viewer: React.FC = () => {
  // DICOM Study state
  const [studyMeta, setStudyMeta] = useState<DICOMStudyMeta | null>(null);
  const [currentFile, setCurrentFile] = useState<string>('0003.dcm');
  const [currentSlice, setCurrentSlice] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [windowCenter, setWindowCenter] = useState<number>(128);
  const [windowWidth, setWindowWidth] = useState<number>(256);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing viewer...');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Gesture Engine state
  const [isGestureEnabled, setIsGestureEnabled] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [gestureDebug, setGestureDebug] = useState<GestureDebugInfo | null>(null);
  const [leftHand, setLeftHand] = useState<FingerStates | null>(null);
  const [rightHand, setRightHand] = useState<FingerStates | null>(null);
  const [activeGestureMode, setActiveGestureMode] = useState<OperationMode>(OperationMode.SLICE_NAV);
  const [gestureFps, setGestureFps] = useState<number>(0);

  // DOM Refs
  const dicomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const gestureControllerRef = useRef<GestureController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mouse interaction state for manual viewport drag
  const isMouseDownRef = useRef<boolean>(false);
  const mouseStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Render Active Frame to Canvas
  const renderCurrentFrame = useCallback(() => {
    if (!studyMeta || !dicomCanvasRef.current) return;
    const frameIdx = Math.max(0, Math.min(studyMeta.frames.length - 1, currentSlice));
    const frame = studyMeta.frames[frameIdx];
    if (frame) {
      frame.renderToCanvas(dicomCanvasRef.current, windowCenter, windowWidth, isInverted);
    }
  }, [studyMeta, currentSlice, windowCenter, windowWidth, isInverted]);

  useEffect(() => {
    renderCurrentFrame();
  }, [renderCurrentFrame]);

  // 2. Load DICOM file from URL
  const loadDicomFromUrl = useCallback(async (url: string, displayName: string) => {
    try {
      setStatusMessage(`Loading ${displayName}...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch ${url}`);
      const arrayBuffer = await response.arrayBuffer();
      const meta = parseDICOMBuffer(arrayBuffer, displayName);

      setStudyMeta(meta);
      setCurrentFile(displayName);
      setCurrentSlice(0);
      setZoomLevel(1.0);
      setPanPos({ x: 0, y: 0 });
      setWindowCenter(meta.frames[0]?.windowCenter || 128);
      setWindowWidth(meta.frames[0]?.windowWidth || 256);
      setStatusMessage(`Loaded ${displayName} (${meta.numberOfFrames} frame${meta.numberOfFrames > 1 ? 's' : ''})`);
    } catch (err: any) {
      console.error('Failed to load DICOM:', err);
      setStatusMessage(`Error loading ${displayName}: ${err.message}`);
    }
  }, []);

  // Initial load: 0003.dcm
  useEffect(() => {
    loadDicomFromUrl('/0003.dcm', '0003.dcm');
  }, [loadDicomFromUrl]);

  // 3. User Upload Handler (Single or Multi-file series)
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      try {
        setStatusMessage(`Reading ${file.name}...`);
        const buffer = await file.arrayBuffer();
        const meta = parseDICOMBuffer(buffer, file.name);
        setStudyMeta(meta);
        setCurrentFile(file.name);
        setCurrentSlice(0);
        setZoomLevel(1.0);
        setPanPos({ x: 0, y: 0 });
        setWindowCenter(meta.frames[0]?.windowCenter || 128);
        setWindowWidth(meta.frames[0]?.windowWidth || 256);
        setStatusMessage(`Successfully loaded ${file.name} (${meta.numberOfFrames} frames)`);
      } catch (err: any) {
        console.error('Error parsing DICOM:', err);
        setStatusMessage(`Failed to parse ${file.name}: ${err.message}`);
      }
    } else {
      // Multiple files belonging to a slice series (e.g. CT/MR volume)
      try {
        setStatusMessage(`Reading series of ${files.length} DICOM slices...`);
        const parsedSlices = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const buf = await file.arrayBuffer();
          const meta = parseDICOMBuffer(buf, file.name);
          parsedSlices.push({
            name: file.name,
            frame: meta.frames[0],
            meta,
          });
        }

        // Sort by instanceNumber or name
        parsedSlices.sort((a, b) => a.meta.instanceNumber - b.meta.instanceNumber || a.name.localeCompare(b.name));

        const compositeMeta: DICOMStudyMeta = {
          patientName: parsedSlices[0].meta.patientName,
          patientId: parsedSlices[0].meta.patientId,
          modality: parsedSlices[0].meta.modality,
          studyDate: parsedSlices[0].meta.studyDate,
          seriesDescription: `Series (${files.length} slices)`,
          instanceNumber: 1,
          rows: parsedSlices[0].meta.rows,
          columns: parsedSlices[0].meta.columns,
          numberOfFrames: parsedSlices.length,
          frames: parsedSlices.map((s) => s.frame),
        };

        setStudyMeta(compositeMeta);
        setCurrentFile(`Series: ${files[0].name} + ${files.length - 1} slices`);
        setCurrentSlice(0);
        setZoomLevel(1.0);
        setPanPos({ x: 0, y: 0 });
        setWindowCenter(compositeMeta.frames[0]?.windowCenter || 128);
        setWindowWidth(compositeMeta.frames[0]?.windowWidth || 256);
        setStatusMessage(`Loaded slice series with ${parsedSlices.length} frames.`);
      } catch (err: any) {
        console.error('Error parsing slice series:', err);
        setStatusMessage(`Failed to load series: ${err.message}`);
      }
    }
  }, []);

  // 4. Connect Gesture Controller & Event Handlers
  const handleGestureAction = useCallback(
    (event: GestureActionEvent) => {

      switch (event.type) {
        case 'MODE_CHANGED':
          setActiveGestureMode(event.value);
          setStatusMessage(`Gesture: Switched to ${event.value} mode`);
          break;

        case 'SLICE_PREV':
          setCurrentSlice((prev) => Math.max(0, prev - 1));
          break;

        case 'SLICE_NEXT':
          if (studyMeta) {
            setCurrentSlice((prev) => Math.min(studyMeta.frames.length - 1, prev + 1));
          }
          break;

        case 'ZOOM':
          if (typeof event.value === 'number') {
            setZoomLevel((prev) => Math.max(0.4, Math.min(6.0, prev + event.value)));
          }
          break;

        case 'PAN':
          if (event.value && typeof event.value.dx === 'number') {
            setPanPos((prev) => ({
              x: prev.x + event.value.dx,
              y: prev.y + (event.value.dy || 0),
            }));
          }
          break;

        case 'WINDOW_CHANGED':
        case 'NEXT_PRESET': {
          setActivePresetIndex((prev) => {
            const nextIdx = (prev + 1) % PRESET_LIST.length;
            const presetName = PRESET_LIST[nextIdx];
            const p = PRESET_WINDOWS[presetName];
            setWindowCenter(p.wc);
            setWindowWidth(p.ww);
            setStatusMessage(`Preset: ${presetName}`);
            return nextIdx;
          });
          break;
        }

        case 'PREV_PRESET': {
          setActivePresetIndex((prev) => {
            const nextIdx = (prev - 1 + PRESET_LIST.length) % PRESET_LIST.length;
            const presetName = PRESET_LIST[nextIdx];
            const p = PRESET_WINDOWS[presetName];
            setWindowCenter(p.wc);
            setWindowWidth(p.ww);
            setStatusMessage(`Preset: ${presetName}`);
            return nextIdx;
          });
          break;
        }

        case 'ACTION_STOP':
          // Cleanly stopped
          break;

        default:
          break;
      }
    },
    [studyMeta]
  );

  // 5. Initialize Gesture Controller
  useEffect(() => {
    const controller = new GestureController();
    gestureControllerRef.current = controller;

    controller.onAction(handleGestureAction);

    controller.onDebug((info) => {
      setGestureDebug(info);
      setLeftHand(controller.leftHand);
      setRightHand(controller.rightHand);
      setActiveGestureMode(info.mode);
      setGestureFps(Math.round(controller.currentFps));
    });

    controller.initialize().catch((err) => {
      console.error('Failed to initialize gesture engine:', err);
      setCameraError('Failed to load MediaPipe Tasks Vision model');
    });

    return () => {
      controller.stop();
    };
  }, [handleGestureAction]);

  // Toggle Webcam Gesture Tracking
  const toggleGestureControl = async () => {
    if (!isGestureEnabled) {
      try {
        setCameraError(null);
        setIsGestureEnabled(true);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });

        // Use requestAnimationFrame / timeout to guarantee DOM video element is mounted and accessible
        setTimeout(async () => {
          if (webcamVideoRef.current && gestureControllerRef.current) {
            webcamVideoRef.current.srcObject = stream;
            await webcamVideoRef.current.play();
            gestureControllerRef.current.start(webcamVideoRef.current);
            setIsCameraReady(true);
            setStatusMessage('Gesture Engine ACTIVE • Ready for chest-level gestures');
          }
        }, 100);
      } catch (err: any) {
        console.error('Camera access error:', err);
        setCameraError('Webcam permission denied or camera not available');
        setIsGestureEnabled(false);
        setIsCameraReady(false);
      }
    } else {
      if (gestureControllerRef.current) {
        gestureControllerRef.current.stop();
      }
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const s = webcamVideoRef.current.srcObject as MediaStream;
        s.getTracks().forEach((t) => t.stop());
        webcamVideoRef.current.srcObject = null;
      }
      setIsCameraReady(false);
      setIsGestureEnabled(false);
      setStatusMessage('Gesture Engine Stopped');
    }
  };

  // Keyboard Navigation Fallback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentSlice((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (studyMeta) {
          setCurrentSlice((prev) => Math.min(studyMeta.frames.length - 1, prev + 1));
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoomLevel((prev) => Math.min(6.0, prev + 0.1));
      } else if (e.key === '-' || e.key === '_') {
        setZoomLevel((prev) => Math.max(0.4, prev - 0.1));
      } else if (e.key === 'r' || e.key === 'R') {
        setZoomLevel(1.0);
        setPanPos({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studyMeta]);

  // Mouse drag fallback for viewport panning
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDownRef.current = true;
    mouseStartRef.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    setPanPos({
      x: e.clientX - mouseStartRef.current.x,
      y: e.clientY - mouseStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  // Mouse wheel fallback for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel((prev) => Math.max(0.4, Math.min(6.0, prev + delta)));
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans select-none">
      {/* 1. TOP MEDICAL APP HEADER BAR */}
      <header className="h-16 bg-[#121217] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-20">
        {/* Left: Back to Home & Brand */}
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white px-3 py-1.5 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Website</span>
          </Link>

          <div className="h-5 w-px bg-zinc-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isGestureEnabled && isCameraReady ? 'bg-emerald-400 animate-pulse' : 'bg-orange-500'
              }`}
            />
            <span className="font-extrabold text-sm tracking-tight text-white uppercase font-pratico">
              0Touch <span className="text-orange-500">Workspace</span>
            </span>
            <span className="text-[10px] font-mono bg-zinc-800/80 text-zinc-400 px-2 py-0.5 border border-zinc-700 rounded">
              Browser DICOM
            </span>
          </div>
        </div>

        {/* Center: Active Gesture Mode Indicators */}
        <div className="hidden lg:flex items-center gap-2 font-mono text-xs">
          <span className="text-zinc-500 font-bold uppercase text-[10px] mr-1">Gesture Mode:</span>
          {[
            { id: OperationMode.SLICE_NAV, label: '1+1: SLICE', icon: <Layers className="w-3.5 h-3.5" /> },
            { id: OperationMode.ZOOM, label: '2+2: ZOOM', icon: <ZoomIn className="w-3.5 h-3.5" /> },
            { id: OperationMode.WINDOWING, label: '3+3: WINDOW', icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: OperationMode.PANNING, label: '4+4: PAN', icon: <Move className="w-3.5 h-3.5" /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveGestureMode(m.id);
                gestureControllerRef.current?.setMode(m.id);
              }}
              className={`px-2.5 py-1 flex items-center gap-1.5 border text-xs font-bold transition-all rounded ${
                activeGestureMode === m.id
                  ? 'bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/20'
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/60'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Gesture Toggle & Tester link */}
        <div className="flex items-center gap-3">
          <Link
            to="/gestures-test"
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-orange-400 hover:text-orange-300 px-3 py-1.5 rounded bg-orange-500/10 border border-orange-500/30"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Testbed</span>
          </Link>

          <button
            onClick={toggleGestureControl}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              isGestureEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {isGestureEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span>{isGestureEnabled ? 'Gestures Active' : 'Enable Gestures'}</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-HEADER METADATA STRIP */}
      <div className="bg-[#18181f] border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-zinc-500 mr-1.5">PATIENT:</span>
            <span className="text-white font-bold">{studyMeta?.patientName || 'ANONYMOUS'}</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1.5">MODALITY:</span>
            <span className="text-orange-400 font-bold">{studyMeta?.modality || 'OT'}</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1.5">STUDY:</span>
            <span className="text-zinc-300">{currentFile}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap text-zinc-400">
          <div>
            <span className="text-zinc-500 mr-1">SLICE:</span>
            <span className="text-white font-bold">
              {studyMeta ? `${currentSlice + 1} / ${studyMeta.numberOfFrames}` : '1 / 1'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1">ZOOM:</span>
            <span className="text-white">{zoomLevel.toFixed(2)}x</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1">WINDOW:</span>
            <span className="text-white">
              C:{Math.round(windowCenter)} W:{Math.round(windowWidth)}
            </span>
          </div>
          <div className="text-emerald-400 font-semibold">{statusMessage}</div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Sidebar: Controls & Sample Studies */}
        <aside className="w-full md:w-64 bg-[#121217] border-r border-white/10 p-4 flex flex-col gap-5 overflow-y-auto shrink-0">
          {/* Sample Studies Selector */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              Sample DICOM Studies
            </span>
            <div className="space-y-1.5">
              <button
                onClick={() => loadDicomFromUrl('/0003.dcm', '0003.dcm')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-all flex items-center justify-between border ${
                  currentFile.includes('0003')
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 font-bold'
                    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>0003.DCM (Angio 17f)</span>
                <span className="text-[10px] opacity-60">XA</span>
              </button>

              <button
                onClick={() => loadDicomFromUrl('/0020.DCM', '0020.DCM')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-all flex items-center justify-between border ${
                  currentFile.includes('0020')
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 font-bold'
                    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>0020.DCM (Echo Cine)</span>
                <span className="text-[10px] opacity-60">US</span>
              </button>

              <button
                onClick={() => loadDicomFromUrl('/MRBRAIN.DCM', 'MRBRAIN.DCM')}
                className={`w-full text-left px-3 py-2 rounded text-xs font-mono transition-all flex items-center justify-between border ${
                  currentFile.includes('MRBRAIN')
                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 font-bold'
                    : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>MRBRAIN.DCM</span>
                <span className="text-[10px] opacity-60">MR</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              Load Custom DICOM
            </span>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFile(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-lg border-2 border-dashed text-center cursor-pointer transition-all ${
                isDraggingFile
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-500'
              }`}
            >
              <Upload className="w-5 h-5 mx-auto text-zinc-400 mb-1" />
              <p className="text-xs text-zinc-300 font-semibold">Drop .DCM or Series</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Supports multi-slice sets</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".dcm,.dicom,application/dicom"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Presets & Contrast */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              Viewing Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_LIST.map((preset, idx) => (
                <button
                  key={preset}
                  onClick={() => {
                    setActivePresetIndex(idx);
                    const p = PRESET_WINDOWS[preset];
                    setWindowCenter(p.wc);
                    setWindowWidth(p.ww);
                  }}
                  className={`px-2 py-1.5 rounded text-[10px] font-mono transition-all text-left border ${
                    activePresetIndex === idx
                      ? 'bg-orange-500 text-white border-orange-400 font-bold'
                      : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60 hover:text-white'
                  }`}
                >
                  {preset.replace(' (CT)', '')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsInverted((prev) => !prev)}
              className={`w-full mt-2 px-3 py-1.5 rounded text-xs font-mono flex items-center justify-center gap-1.5 border transition-all ${
                isInverted
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Invert Grayscale ({isInverted ? 'ON' : 'OFF'})</span>
            </button>
          </div>

          {/* Reset Viewport */}
          <button
            onClick={() => {
              setZoomLevel(1.0);
              setPanPos({ x: 0, y: 0 });
            }}
            className="w-full px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono flex items-center justify-center gap-2 text-zinc-300 hover:text-white transition-all mt-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Viewport</span>
          </button>
        </aside>

        {/* Center: Viewport */}
        <main
          className="flex-1 bg-black relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* DICOM Render Canvas */}
          <canvas
            ref={dicomCanvasRef}
            style={{
              transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isMouseDownRef.current ? 'none' : 'transform 0.05s ease-out',
            }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />

          {/* Viewport Overlay HUD (Top-Left) */}
          <div className="absolute top-4 left-4 font-mono text-xs text-white/70 space-y-1 pointer-events-none bg-black/60 backdrop-blur-sm p-3 rounded-lg border border-white/10">
            <div>
              <span className="text-zinc-500">Slice: </span>
              <span className="text-orange-400 font-bold">
                {studyMeta ? `${currentSlice + 1} / ${studyMeta.numberOfFrames}` : '1 / 1'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Zoom: </span>
              <span>{zoomLevel.toFixed(2)}x</span>
            </div>
            <div>
              <span className="text-zinc-500">Pan: </span>
              <span>
                {Math.round(panPos.x)}, {Math.round(panPos.y)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Preset: </span>
              <span className="text-emerald-400">{PRESET_LIST[activePresetIndex]}</span>
            </div>
          </div>

          {/* Slice Timeline Navigation Slider (Bottom) */}
          {studyMeta && studyMeta.numberOfFrames > 1 && (
            <div className="absolute bottom-4 left-8 right-8 bg-black/70 backdrop-blur-md p-3 rounded-xl border border-white/15 flex items-center gap-4 z-10">
              <span className="text-xs font-mono text-zinc-400 shrink-0">Frame:</span>
              <input
                type="range"
                min={0}
                max={studyMeta.numberOfFrames - 1}
                value={currentSlice}
                onChange={(e) => setCurrentSlice(parseInt(e.target.value, 10))}
                className="flex-1 accent-orange-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-orange-400 shrink-0">
                {currentSlice + 1} / {studyMeta.numberOfFrames}
              </span>
            </div>
          )}
        </main>

        {/* Floating Webcam & Gesture HUD (Bottom-Right / PIP) */}
        {isGestureEnabled && (
          <div className="absolute top-4 right-4 z-30 w-72 bg-black/85 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-white">0Touch Gesture Stream</span>
              </div>
              <span className="text-zinc-400">{gestureFps} FPS</span>
            </div>

            {/* Hidden Video element running MediaPipe analysis */}
            <div className="relative aspect-video bg-zinc-900 overflow-hidden">
              <video
                ref={webcamVideoRef}
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />

              {/* Status pill on video */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-black/70 border border-white/10">
                <span className="text-orange-400 font-bold truncate">
                  {gestureDebug?.classifiedGesture || 'WAITING'}
                </span>
                <span className="text-zinc-400 shrink-0 ml-1">
                  {gestureDebug?.trackingStatus || 'SEARCH'}
                </span>
              </div>
            </div>

            {/* Gesture Telemetry Pill */}
            <div className="p-3 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] text-blue-400 block font-bold">LEFT HAND</span>
                  <span className="text-lg font-extrabold text-blue-400">
                    {leftHand?.extendedCount ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">{leftHand?.posture ?? 'NONE'}</span>
                </div>

                <div className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20">
                  <span className="text-[10px] text-orange-400 block font-bold">RIGHT HAND</span>
                  <span className="text-lg font-extrabold text-orange-400">
                    {rightHand?.extendedCount ?? 0}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">{rightHand?.posture ?? 'NONE'}</span>
                </div>
              </div>

              {/* Hold Progress Bar */}
              {gestureDebug?.holdProgressPercent !== undefined && gestureDebug.holdProgressPercent > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Confirmation Hold:</span>
                    <span className="text-orange-400">{gestureDebug.holdProgressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-75"
                      style={{ width: `${gestureDebug.holdProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {cameraError && (
          <div className="absolute bottom-4 left-4 z-40 p-3 rounded-lg bg-red-600/90 text-white text-xs flex items-center gap-2 font-mono shadow-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
