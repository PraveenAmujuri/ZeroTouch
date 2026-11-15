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
  Activity,
  Archive,
  History,
  FileText
} from 'lucide-react';
import { parseDICOMBuffer, DICOMStudyMeta } from '../utils/dicomLoader';
import { extractDicomFilesFromZip } from '../utils/zipLoader';
import {
  saveStudyToCache,
  getRecentStudies,
  getCachedStudyBuffer,
  CachedDICOMStudy,
} from '../utils/dicomCache';
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

  // Recent Studies Cache
  const [recentStudies, setRecentStudies] = useState<Omit<CachedDICOMStudy, 'buffer'>[]>([]);
  const [showRecentDrawer, setShowRecentDrawer] = useState<boolean>(false);

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

  // Load Recent studies list from IndexedDB on mount
  useEffect(() => {
    getRecentStudies().then((list) => setRecentStudies(list));
  }, []);

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

  // Helper: Cache a study in IndexedDB with thumbnail
  const cacheCurrentStudy = useCallback((meta: DICOMStudyMeta, buffer: ArrayBuffer, name: string) => {
    try {
      // Create thumbnail from first frame
      const thumbCanvas = document.createElement('canvas');
      meta.frames[0]?.renderToCanvas(thumbCanvas, meta.frames[0].windowCenter, meta.frames[0].windowWidth);
      const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);

      const studyItem: CachedDICOMStudy = {
        id: `${meta.patientId}_${name}_${buffer.byteLength}`,
        fileName: name,
        patientName: meta.patientName,
        patientId: meta.patientId,
        modality: meta.modality,
        studyDate: meta.studyDate,
        seriesDescription: meta.seriesDescription,
        numberOfFrames: meta.numberOfFrames,
        thumbnailDataUrl,
        timestamp: Date.now(),
        buffer,
      };

      saveStudyToCache(studyItem).then(() => {
        getRecentStudies().then((list) => setRecentStudies(list));
      });
    } catch (e) {
      console.warn('Caching study error:', e);
    }
  }, []);

  // 2. Load DICOM file from URL
  const loadDicomFromUrl = useCallback(
    async (url: string, displayName: string) => {
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

        cacheCurrentStudy(meta, arrayBuffer, displayName);
      } catch (err: any) {
        console.error('Failed to load DICOM:', err);
        setStatusMessage(`Error loading ${displayName}: ${err.message}`);
      }
    },
    [cacheCurrentStudy]
  );

  // Initial load: 0003.dcm
  useEffect(() => {
    loadDicomFromUrl('/0003.dcm', '0003.dcm');
  }, [loadDicomFromUrl]);

  // Load from Recent Cached Study
  const loadFromCache = async (cachedId: string, fileName: string) => {
    try {
      setStatusMessage(`Restoring ${fileName} from cache...`);
      const buffer = await getCachedStudyBuffer(cachedId);
      if (!buffer) throw new Error('Cached study data unavailable');
      const meta = parseDICOMBuffer(buffer, fileName);
      setStudyMeta(meta);
      setCurrentFile(fileName);
      setCurrentSlice(0);
      setZoomLevel(1.0);
      setPanPos({ x: 0, y: 0 });
      setWindowCenter(meta.frames[0]?.windowCenter || 128);
      setWindowWidth(meta.frames[0]?.windowWidth || 256);
      setStatusMessage(`Restored ${fileName} from browser cache.`);
      setShowRecentDrawer(false);
    } catch (err: any) {
      console.error('Cache load error:', err);
      setStatusMessage(`Failed to restore ${fileName}: ${err.message}`);
    }
  };

  // 3. User Upload Handler (Single .dcm, Multiple .dcm series, or .zip archive)
  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Handle .ZIP file
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        const zipFile = files[0];
        try {
          setStatusMessage(`Extracting ZIP archive: ${zipFile.name}...`);
          const zipBuffer = await zipFile.arrayBuffer();
          const extractedDicom = await extractDicomFilesFromZip(zipBuffer);

          if (extractedDicom.length === 0) {
            throw new Error('No valid DICOM (.dcm) files found inside the ZIP archive');
          }

          setStatusMessage(`Processing ${extractedDicom.length} DICOM files from ZIP...`);

          if (extractedDicom.length === 1) {
            const meta = parseDICOMBuffer(extractedDicom[0].buffer, extractedDicom[0].name);
            setStudyMeta(meta);
            setCurrentFile(extractedDicom[0].name);
            setCurrentSlice(0);
            setZoomLevel(1.0);
            setPanPos({ x: 0, y: 0 });
            setWindowCenter(meta.frames[0]?.windowCenter || 128);
            setWindowWidth(meta.frames[0]?.windowWidth || 256);
            setStatusMessage(`Loaded ${extractedDicom[0].name} from ZIP (${meta.numberOfFrames} frames)`);
            cacheCurrentStudy(meta, extractedDicom[0].buffer, extractedDicom[0].name);
          } else {
            // Multi-slice series in ZIP
            const parsedSlices = [];
            for (const item of extractedDicom) {
              const meta = parseDICOMBuffer(item.buffer, item.name);
              parsedSlices.push({
                name: item.name,
                frame: meta.frames[0],
                meta,
              });
            }

            parsedSlices.sort(
              (a, b) => a.meta.instanceNumber - b.meta.instanceNumber || a.name.localeCompare(b.name)
            );

            const compositeMeta: DICOMStudyMeta = {
              patientName: parsedSlices[0].meta.patientName,
              patientId: parsedSlices[0].meta.patientId,
              patientBirthDate: parsedSlices[0].meta.patientBirthDate,
              patientSex: parsedSlices[0].meta.patientSex,
              modality: parsedSlices[0].meta.modality,
              studyDate: parsedSlices[0].meta.studyDate,
              studyTime: parsedSlices[0].meta.studyTime,
              seriesDescription: `${zipFile.name} (${parsedSlices.length} slices)`,
              studyDescription: parsedSlices[0].meta.studyDescription,
              institutionName: parsedSlices[0].meta.institutionName,
              manufacturer: parsedSlices[0].meta.manufacturer,
              kvp: parsedSlices[0].meta.kvp,
              sliceThickness: parsedSlices[0].meta.sliceThickness,
              pixelSpacing: parsedSlices[0].meta.pixelSpacing,
              instanceNumber: 1,
              rows: parsedSlices[0].meta.rows,
              columns: parsedSlices[0].meta.columns,
              numberOfFrames: parsedSlices.length,
              frames: parsedSlices.map((s) => s.frame),
            };

            setStudyMeta(compositeMeta);
            setCurrentFile(zipFile.name);
            setCurrentSlice(0);
            setZoomLevel(1.0);
            setPanPos({ x: 0, y: 0 });
            setWindowCenter(compositeMeta.frames[0]?.windowCenter || 128);
            setWindowWidth(compositeMeta.frames[0]?.windowWidth || 256);
            setStatusMessage(`Extracted & loaded ZIP series with ${parsedSlices.length} slices.`);
            cacheCurrentStudy(compositeMeta, extractedDicom[0].buffer, zipFile.name);
          }
        } catch (err: any) {
          console.error('ZIP extraction error:', err);
          setStatusMessage(`ZIP error: ${err.message}`);
        }
        return;
      }

      // Handle Single .dcm file
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
          cacheCurrentStudy(meta, buffer, file.name);
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

          parsedSlices.sort(
            (a, b) => a.meta.instanceNumber - b.meta.instanceNumber || a.name.localeCompare(b.name)
          );

          const compositeMeta: DICOMStudyMeta = {
            patientName: parsedSlices[0].meta.patientName,
            patientId: parsedSlices[0].meta.patientId,
            patientBirthDate: parsedSlices[0].meta.patientBirthDate,
            patientSex: parsedSlices[0].meta.patientSex,
            modality: parsedSlices[0].meta.modality,
            studyDate: parsedSlices[0].meta.studyDate,
            studyTime: parsedSlices[0].meta.studyTime,
            seriesDescription: `Series (${files.length} slices)`,
            studyDescription: parsedSlices[0].meta.studyDescription,
            institutionName: parsedSlices[0].meta.institutionName,
            manufacturer: parsedSlices[0].meta.manufacturer,
            kvp: parsedSlices[0].meta.kvp,
            sliceThickness: parsedSlices[0].meta.sliceThickness,
            pixelSpacing: parsedSlices[0].meta.pixelSpacing,
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
    },
    [cacheCurrentStudy]
  );

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
              Clinical DICOM
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
          {/* Recently Opened Drawer Toggle */}
          <button
            onClick={() => setShowRecentDrawer((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-all ${
              showRecentDrawer
                ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Recent ({recentStudies.length})</span>
          </button>

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

      {/* 2. SUB-HEADER METADATA STRIP (Full Clinical Values) */}
      <div className="bg-[#18181f] border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-zinc-500 mr-1.5">PATIENT:</span>
            <span className="text-white font-bold">{studyMeta?.patientName || 'ANONYMOUS'}</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1.5">ID:</span>
            <span className="text-zinc-300">{studyMeta?.patientId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1.5">MODALITY:</span>
            <span className="text-orange-400 font-bold">{studyMeta?.modality || 'OT'}</span>
          </div>
          <div>
            <span className="text-zinc-500 mr-1.5">STUDY:</span>
            <span className="text-zinc-300">{currentFile}</span>
          </div>
          {studyMeta?.studyDate && (
            <div>
              <span className="text-zinc-500 mr-1.5">DATE:</span>
              <span className="text-zinc-400">{studyMeta.studyDate}</span>
            </div>
          )}
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
              W:{Math.round(windowWidth)} L:{Math.round(windowCenter)}
            </span>
          </div>
          <div className="text-emerald-400 font-semibold">{statusMessage}</div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Sidebar: Controls, Samples & Archive Support */}
        <aside className="w-full md:w-64 bg-[#121217] border-r border-white/10 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
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

          {/* Upload Dropzone (Supports .DCM, Folder, and .ZIP) */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
              Load DICOM / ZIP Archive
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
              <div className="flex items-center justify-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-orange-400" />
                <Archive className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-300 font-semibold">Drop .DCM, Series or .ZIP</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Auto-extracts archives</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".dcm,.dicom,.zip,application/zip,application/dicom"
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

          {/* Detailed Image Specs Card */}
          {studyMeta && (
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5 text-[11px] font-mono text-zinc-400">
              <span className="text-[10px] uppercase font-bold text-white/70 block border-b border-white/5 pb-1">
                DICOM Specs
              </span>
              <div className="flex justify-between">
                <span>Matrix:</span>
                <span className="text-white">{studyMeta.columns} × {studyMeta.rows}</span>
              </div>
              {studyMeta.sliceThickness && (
                <div className="flex justify-between">
                  <span>Thickness:</span>
                  <span className="text-white">{studyMeta.sliceThickness} mm</span>
                </div>
              )}
              {studyMeta.kvp && (
                <div className="flex justify-between">
                  <span>KVP:</span>
                  <span className="text-white">{studyMeta.kvp} kV</span>
                </div>
              )}
              {studyMeta.institutionName && (
                <div className="truncate">
                  <span className="text-zinc-500">Inst: </span>
                  <span className="text-white">{studyMeta.institutionName}</span>
                </div>
              )}
            </div>
          )}

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

          {/* Clinical Corner HUD Overlays (Inspired by Professional PACS / Saga) */}
          {studyMeta && (
            <>
              {/* Top-Left Corner: Patient Demographics */}
              <div className="absolute top-4 left-4 font-mono text-xs text-white/80 space-y-0.5 pointer-events-none bg-black/40 backdrop-blur-sm p-2.5 rounded border border-white/10">
                <div className="font-bold text-orange-400">{studyMeta.patientName}</div>
                <div className="text-[11px] text-zinc-400">{studyMeta.patientId}</div>
                {studyMeta.patientSex && <div className="text-[10px] text-zinc-500">Sex: {studyMeta.patientSex}</div>}
              </div>

              {/* Top-Right Corner: Study Date & Series */}
              <div className="absolute top-4 right-80 font-mono text-xs text-right text-white/80 space-y-0.5 pointer-events-none bg-black/40 backdrop-blur-sm p-2.5 rounded border border-white/10 hidden xl:block">
                <div className="text-zinc-300">{studyMeta.studyDate}</div>
                <div className="text-[11px] text-zinc-400 truncate max-w-xs">{studyMeta.seriesDescription}</div>
                <div className="text-[10px] text-orange-400 font-bold">{studyMeta.modality}</div>
              </div>

              {/* Bottom-Left Corner: Slice Number & Location */}
              <div className="absolute bottom-16 left-4 font-mono text-xs text-white/80 space-y-0.5 pointer-events-none bg-black/40 backdrop-blur-sm p-2.5 rounded border border-white/10">
                <div>
                  <span className="text-zinc-500">Img: </span>
                  <span className="text-white font-bold">{currentSlice + 1} / {studyMeta.numberOfFrames}</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  Zoom: {zoomLevel.toFixed(2)}x
                </div>
              </div>

              {/* Bottom-Right Corner: Window Level & Resolution */}
              <div className="absolute bottom-16 right-4 font-mono text-xs text-right text-white/80 space-y-0.5 pointer-events-none bg-black/40 backdrop-blur-sm p-2.5 rounded border border-white/10">
                <div>
                  <span className="text-zinc-500">W: </span>
                  <span className="text-white font-bold">{Math.round(windowWidth)}</span>
                  <span className="text-zinc-500 ml-2">L: </span>
                  <span className="text-white font-bold">{Math.round(windowCenter)}</span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  {studyMeta.columns} × {studyMeta.rows}
                </div>
              </div>

              {/* Orientation Labels */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-white/40 pointer-events-none">A</div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-white/40 pointer-events-none">P</div>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-white/40 pointer-events-none">R</div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-white/40 pointer-events-none">L</div>
            </>
          )}

          {/* Slice Timeline Navigation Slider (Bottom) */}
          {studyMeta && studyMeta.numberOfFrames > 1 && (
            <div className="absolute bottom-4 left-8 right-8 bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 flex items-center gap-4 z-10">
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

        {/* Recently Opened Drawer Slideout */}
        {showRecentDrawer && (
          <div className="absolute inset-y-0 right-0 w-80 bg-[#121217]/95 backdrop-blur-xl border-l border-white/10 z-40 p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-sm font-pratico">Recently Opened Studies</span>
              </div>
              <button
                onClick={() => setShowRecentDrawer(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1">
              {recentStudies.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                  No cached studies yet. Opened DICOMs will persist here automatically.
                </div>
              ) : (
                recentStudies.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadFromCache(s.id, s.fileName)}
                    className="p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/50 hover:border-orange-500/50 cursor-pointer transition-all flex gap-3 items-center group"
                  >
                    {s.thumbnailDataUrl ? (
                      <img
                        src={s.thumbnailDataUrl}
                        alt="thumb"
                        className="w-12 h-12 rounded object-cover bg-black shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 font-mono text-xs">
                      <div className="font-bold text-white truncate group-hover:text-orange-400 transition-colors">
                        {s.patientName}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">{s.fileName}</div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                        <span className="text-orange-400 font-bold">{s.modality}</span>
                        <span>•</span>
                        <span>{s.numberOfFrames} f</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Floating Webcam & Gesture HUD (Top-Right / PIP) */}
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

            {/* Video element running MediaPipe analysis */}
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
