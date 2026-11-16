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
  FileText,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  HelpCircle,
  X
} from 'lucide-react';
import { parseDICOMBuffer, DICOMStudyMeta } from '../utils/dicomLoader';
import { extractDicomFilesFromZip } from '../utils/zipLoader';
import { Logo } from '../components/Logo';
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
import { useIsMobile } from '../hooks/useIsMobile';
import { DesktopRequired } from '../components/DesktopRequired';

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
  const isMobile = useIsMobile(768);

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

  // Fullscreen & UI Layout
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Recent Studies Cache
  const [recentStudies, setRecentStudies] = useState<Omit<CachedDICOMStudy, 'buffer'>[]>([]);
  const [showRecentDrawer, setShowRecentDrawer] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Pixel Probe State
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; val: number; unit: string } | null>(null);

  // Cine Playback state
  const [isPlayingCine, setIsPlayingCine] = useState<boolean>(false);
  const [cineFps, setCineFps] = useState<number>(15);
  const cineIntervalRef = useRef<number | null>(null);

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
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const dicomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const gestureControllerRef = useRef<GestureController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mouse interaction state for manual viewport drag
  const isMouseDownRef = useRef<boolean>(false);
  const mouseStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fsActive);
      if (fsActive) {
        setIsSidebarCollapsed(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (viewerContainerRef.current) {
          await viewerContainerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  // Load Recent studies list from IndexedDB on mount
  useEffect(() => {
    getRecentStudies().then((list) => setRecentStudies(list));
  }, []);

  // Cine Playback loop
  useEffect(() => {
    if (isPlayingCine && studyMeta && studyMeta.numberOfFrames > 1) {
      const intervalMs = Math.round(1000 / cineFps);
      cineIntervalRef.current = window.setInterval(() => {
        setCurrentSlice((prev) => (prev + 1) % studyMeta.numberOfFrames);
      }, intervalMs);
    } else {
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
        cineIntervalRef.current = null;
      }
    }
    return () => {
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
      }
    };
  }, [isPlayingCine, cineFps, studyMeta]);

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
        // Multiple files belonging to a slice series
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
    if (isMobile) return;

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
  }, [handleGestureAction, isMobile]);

  // Stop camera and gestures immediately if resized to mobile
  useEffect(() => {
    if (isMobile) {
      if (gestureControllerRef.current) {
        gestureControllerRef.current.stop();
      }
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const stream = webcamVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        webcamVideoRef.current.srcObject = null;
      }
      setIsCameraReady(false);
      setIsGestureEnabled(false);
    }
  }, [isMobile]);

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
            setStatusMessage('Gesture Engine Ready • Chest-level gestures');
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

  // Prevent browser-level pinch-to-zoom on viewer (trackpad 2-finger zoom)
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        // Route trackpad pinch directly to DICOM zoom instead of browser page zoom
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setZoomLevel((prev) => Math.max(0.4, Math.min(6.0, prev + delta)));
      }
    };

    const container = viewerContainerRef.current;
    if (container) {
      container.addEventListener('wheel', preventBrowserZoom, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', preventBrowserZoom);
      }
    };
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlayingCine((prev) => !prev);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setIsPlayingCine(false);
        setCurrentSlice((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setIsPlayingCine(false);
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
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'i' || e.key === 'I') {
        setIsInverted((prev) => !prev);
      } else if (e.key === '1') {
        setActiveGestureMode(OperationMode.SLICE_NAV);
        gestureControllerRef.current?.setMode(OperationMode.SLICE_NAV);
      } else if (e.key === '2') {
        setActiveGestureMode(OperationMode.ZOOM);
        gestureControllerRef.current?.setMode(OperationMode.ZOOM);
      } else if (e.key === '3') {
        setActiveGestureMode(OperationMode.WINDOWING);
        gestureControllerRef.current?.setMode(OperationMode.WINDOWING);
      } else if (e.key === '4') {
        setActiveGestureMode(OperationMode.PANNING);
        gestureControllerRef.current?.setMode(OperationMode.PANNING);
      } else if (e.key === 'g' || e.key === 'G') {
        toggleGestureControl();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShowHelpModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowHelpModal(false);
        setShowRecentDrawer(false);
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
    if (isMouseDownRef.current) {
      setPanPos({
        x: e.clientX - mouseStartRef.current.x,
        y: e.clientY - mouseStartRef.current.y,
      });
    }

    // Inspect pixel value under cursor in image space
    if (studyMeta && dicomCanvasRef.current) {
      const rect = dicomCanvasRef.current.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        const frameIdx = Math.max(0, Math.min(studyMeta.frames.length - 1, currentSlice));
        const frame = studyMeta.frames[frameIdx];
        if (frame) {
          const normX = (e.clientX - rect.left) / rect.width;
          const normY = (e.clientY - rect.top) / rect.height;
          const pixelX = Math.floor(normX * frame.width);
          const pixelY = Math.floor(normY * frame.height);
          const pVal = frame.getPixelValue(pixelX, pixelY);
          if (pVal !== null) {
            const isCT = studyMeta.modality.toUpperCase() === 'CT';
            setHoveredPixel({
              x: pixelX,
              y: pixelY,
              val: Math.round(pVal.rescaled),
              unit: isCT ? 'HU' : 'Intensity',
            });
            return;
          }
        }
      }
    }
    setHoveredPixel(null);
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
    setHoveredPixel(null);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
  };

  // Mouse wheel: Navigate slices/frames by default (trackpad pinch with ctrlKey is captured by passive:false listener above)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    // Slide scroll: Navigate slices
    if (studyMeta && studyMeta.numberOfFrames > 1) {
      if (e.deltaY > 0) {
        // Scroll down -> Next slice
        setCurrentSlice((prev) => Math.min(studyMeta.numberOfFrames - 1, prev + 1));
      } else if (e.deltaY < 0) {
        // Scroll up -> Previous slice
        setCurrentSlice((prev) => Math.max(0, prev - 1));
      }
    }
  };

  // Mobile screen restriction: Render Desktop Experience Required screen
  if (isMobile) {
    return <DesktopRequired />;
  }

  return (
    <div
      ref={viewerContainerRef}
      className="h-screen max-h-screen bg-[#111114] text-[#ececed] flex flex-col font-sans select-none overflow-hidden"
    >
      {/* 1. TOP MEDICAL APP HEADER BAR */}
      <header className="h-16 bg-[#18181d] border-b border-[#27272a] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        {/* Left: Back to Home & Brand */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title="Return to Main Website"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9999a3] hover:text-[#27272a] px-3.5 py-1.5 rounded-full border border-[#27272a] bg-[#22222a] hover:bg-[#ffffff] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Main Website</span>
          </Link>

          <div className="h-5 w-px bg-[#27272a] hidden sm:block" />

          {/* Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 rounded-full border border-[#27272a] bg-[#22222a] hover:bg-[#27272a] text-[#9999a3] hover:text-white transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isGestureEnabled && isCameraReady ? 'bg-[#FF8066] animate-pulse shadow-[0_0_8px_#FF8066]' : 'bg-[#FF8066]/60'
              }`}
            />
            <div className="flex items-center gap-2 select-none">
              <Logo className="h-4 sm:h-5 w-auto text-white" />
              <span
                className="text-xs sm:text-sm tracking-tight text-[#74d2c2] font-black uppercase whitespace-nowrap"
                style={{ fontFamily: '"Pratico Variable", sans-serif' }}
              >
                WORKSPACE
              </span>
            </div>
          </div>
        </div>

        {/* Center: Gesture Mode Buttons (Sharp rectangular Loz card style with 3D drop shadow) */}
        <div className="hidden lg:flex items-center gap-3 font-mono text-xs">
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
              title={`Switch to ${m.id} Mode`}
              className={`px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all border-2 ${
                activeGestureMode === m.id
                  ? 'bg-[#FF8066] text-black border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                  : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Actions (Recent, Fullscreen, Gesture Toggle) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Recently Opened Drawer Toggle */}
          <button
            onClick={() => setShowRecentDrawer((prev) => !prev)}
            title="Browse Recently Opened DICOM Studies"
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border-2 transition-all ${
              showRecentDrawer
                ? 'bg-[#FF8066] text-black border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recent</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black text-white font-mono">
              {recentStudies.length}
            </span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            className={`p-1.5 border-2 transition-all ${
              isFullscreen
                ? 'bg-[#FF8066] text-black border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
            }`}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-black" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Keyboard Shortcuts Help Button */}
          <button
            onClick={() => setShowHelpModal((prev) => !prev)}
            title="Keyboard Shortcuts & Gestures Help (?)"
            className={`p-1.5 border-2 transition-all ${
              showHelpModal
                ? 'bg-[#FF8066] text-black border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Testbed Link */}
          <Link
            to="/gestures-test"
            title="Open Standalone Gesture Engine Testbed"
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 border-2 border-[#3f3f46] bg-[#27272a] text-zinc-300 hover:bg-[#3f3f46] hover:text-white transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-[#FF8066]" />
            <span>Testbed</span>
          </Link>

          {/* Enable Gestures Button (Loz Pill primary CTA) */}
          <button
            onClick={toggleGestureControl}
            title="Toggle Two-Hand Webcam Tracking"
            className={`flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all border-2 border-[#27272a] rounded-full ${
              isGestureEnabled
                ? 'bg-[#6f7bd4] text-white shadow-[3px_3px_#27272a]'
                : 'bg-[#ffa694] hover:bg-[#ffb5a6] text-[#27272a] shadow-[3px_3px_#27272a]'
            }`}
          >
            {isGestureEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isGestureEnabled ? 'Gestures Active' : 'Enable Gestures'}</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-HEADER METADATA STRIP */}
      <div className="bg-[#141418] border-b border-[#27272a]/80 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-[#6c6c75] mr-1">PATIENT:</span>
            <span className="text-white font-semibold">{studyMeta?.patientName || 'ANONYMOUS'}</span>
          </div>
          <div>
            <span className="text-[#6c6c75] mr-1">ID:</span>
            <span className="text-[#a1a1aa]">{studyMeta?.patientId || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[#6c6c75] mr-1">MODALITY:</span>
            <span className="text-[#FF8066] font-bold">{studyMeta?.modality || 'OT'}</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-[#6c6c75] mr-1">STUDY:</span>
            <span className="text-[#a1a1aa] truncate max-w-xs">{currentFile}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap text-[#a1a1aa]">
          <div>
            <span className="text-[#6c6c75] mr-1">FRAME:</span>
            <span className="text-white font-bold">
              {studyMeta ? `${currentSlice + 1} / ${studyMeta.numberOfFrames}` : '1 / 1'}
            </span>
          </div>
          <div>
            <span className="text-[#6c6c75] mr-1">ZOOM:</span>
            <span className="text-white">{zoomLevel.toFixed(2)}x</span>
          </div>
          <div>
            <span className="text-[#6c6c75] mr-1">WINDOW:</span>
            <span className="text-white">
              W:{Math.round(windowWidth)} L:{Math.round(windowCenter)}
            </span>
          </div>
          <div className="text-[#FF8066] font-medium hidden md:block">{statusMessage}</div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Collapsible Sidebar: Controls, Samples & Archive Support */}
        {!isSidebarCollapsed && (
          <aside className="w-full md:w-64 max-h-full bg-[#141418] border-r border-[#27272a] p-4 flex flex-col gap-4 overflow-y-auto shrink-0 transition-all custom-scrollbar">
            {/* Sample Studies Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#888894] font-bold block">
                Sample DICOM Studies
              </span>
              <div className="space-y-2">
                <button
                  onClick={() => loadDicomFromUrl('/0003.dcm', '0003.dcm')}
                  className={`w-full text-left p-3 border-2 text-xs font-mono transition-all flex items-center justify-between ${
                    currentFile.includes('0003')
                      ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                      : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div>
                    <span className="block font-bold text-sm uppercase">Angiography</span>
                    <span className="text-[11px] opacity-80">17ct Cine (0003.DCM)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-current">XA</span>
                </button>

                <button
                  onClick={() => loadDicomFromUrl('/0020.DCM', '0020.DCM')}
                  className={`w-full text-left p-3 border-2 text-xs font-mono transition-all flex items-center justify-between ${
                    currentFile.includes('0020')
                      ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                      : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div>
                    <span className="block font-bold text-sm uppercase">Ultrasound</span>
                    <span className="text-[11px] opacity-80">11ct Slices (0020.DCM)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-current">US</span>
                </button>

                <button
                  onClick={() => loadDicomFromUrl('/MRBRAIN.DCM', 'MRBRAIN.DCM')}
                  className={`w-full text-left p-3 border-2 text-xs font-mono transition-all flex items-center justify-between ${
                    currentFile.includes('MRBRAIN')
                      ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                      : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                  }`}
                >
                  <div>
                    <span className="block font-bold text-sm uppercase">Brain MRI</span>
                    <span className="text-[11px] opacity-80">3D Axial Series</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 border border-current">MR</span>
                </button>
              </div>
            </div>

            {/* Upload Dropzone */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#888894] font-bold block">
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
                className={`p-4 border-2 text-center cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                    : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <Upload className="w-4 h-4 text-current" />
                  <Archive className="w-4 h-4 text-current" />
                </div>
                <p className="text-xs font-bold uppercase">Drop .DCM, Series or .ZIP</p>
                <p className="text-[10px] opacity-75 font-medium mt-0.5">Instant browser extraction</p>
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

            {/* Viewing Presets */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#888894] font-bold block">
                Viewing Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_LIST.map((preset, idx) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setActivePresetIndex(idx);
                      const p = PRESET_WINDOWS[preset];
                      setWindowCenter(p.wc);
                      setWindowWidth(p.ww);
                    }}
                    className={`px-2.5 py-2 text-[10px] font-mono font-bold uppercase transition-all text-left border-2 ${
                      activePresetIndex === idx
                        ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                        : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                    }`}
                  >
                    {preset.replace(' (CT)', '')}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsInverted((prev) => !prev)}
                className={`w-full mt-2 p-2 text-xs font-mono font-bold uppercase flex items-center justify-center gap-2 border-2 transition-all ${
                  isInverted
                    ? 'bg-[#6f7bd4] text-white border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                    : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Invert Grayscale ({isInverted ? 'ON' : 'OFF'})</span>
              </button>
            </div>

            {/* Detailed Image Specs Card */}
            {studyMeta && (
              <div className="p-3 border-2 border-[#3f3f46] bg-[#27272a] text-zinc-200 space-y-1.5 text-[11px] font-mono">
                <span className="text-[10px] uppercase font-bold text-[#6f7bd4] block border-b border-[#3f3f46] pb-1">
                  DICOM Information
                </span>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Resolution:</span>
                  <span className="font-bold text-white">{studyMeta.columns} × {studyMeta.rows}</span>
                </div>
                {studyMeta.sliceThickness && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thickness:</span>
                    <span className="font-bold text-white">{studyMeta.sliceThickness} mm</span>
                  </div>
                )}
                {studyMeta.kvp && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Voltage:</span>
                    <span className="font-bold text-white">{studyMeta.kvp} kVp</span>
                  </div>
                )}
                {studyMeta.institutionName && (
                  <div className="truncate">
                    <span className="text-zinc-400">Site: </span>
                    <span className="font-bold text-white">{studyMeta.institutionName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reset Viewport (Loz button pill style) */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanPos({ x: 0, y: 0 });
              }}
              title="Reset Viewport Scale and Position (R)"
              className="w-full py-2.5 rounded-full border-2 border-[#27272a] bg-[#ffa694] hover:bg-[#ffb5a6] text-[#27272a] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[3px_3px_#27272a] mt-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Viewport</span>
            </button>
          </aside>
        )}

        {/* Center: Viewport */}
        <main
          className="flex-1 bg-[#09090b] relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
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
            className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl"
          />

          {/* Transparent DICOM Corner HUD Overlays (Clean, borderless, text-shadowed) */}
          {studyMeta && (
            <>
              {/* Top-Left Corner: Patient Demographics */}
              <div
                className="absolute top-4 left-4 font-mono text-xs text-white/90 space-y-0.5 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)' }}
              >
                <div className="font-bold text-[#FF8066] text-sm tracking-tight">{studyMeta.patientName}</div>
                <div className="text-[11px] text-white/70">{studyMeta.patientId}</div>
                {studyMeta.patientSex && <div className="text-[10px] text-white/50">Sex: {studyMeta.patientSex}</div>}
              </div>

              {/* Top-Right Corner: Study Date & Series */}
              <div
                className="absolute top-4 right-80 font-mono text-xs text-right text-white/90 space-y-0.5 pointer-events-none hidden xl:block"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)' }}
              >
                <div className="text-white/80">{studyMeta.studyDate}</div>
                <div className="text-[11px] text-white/60 truncate max-w-xs">{studyMeta.seriesDescription}</div>
                <div className="text-[11px] text-[#FF8066] font-bold">{studyMeta.modality}</div>
              </div>

              {/* Bottom-Left Corner: Slice Number & Location */}
              <div
                className="absolute bottom-16 left-4 font-mono text-xs text-white/90 space-y-0.5 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)' }}
              >
                <div>
                  <span className="text-white/50">Img: </span>
                  <span className="text-white font-bold">{currentSlice + 1} / {studyMeta.numberOfFrames}</span>
                </div>
                <div className="text-[11px] text-white/70">
                  Zoom: {zoomLevel.toFixed(2)}x
                </div>
                {hoveredPixel && (
                  <div className="text-[11px] text-[#FF8066] font-bold">
                    X: {hoveredPixel.x} Y: {hoveredPixel.y} | {hoveredPixel.val} {hoveredPixel.unit}
                  </div>
                )}
              </div>

              {/* Bottom-Right Corner: Window Level & Resolution */}
              <div
                className="absolute bottom-16 right-4 font-mono text-xs text-right text-white/90 space-y-0.5 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.8)' }}
              >
                <div>
                  <span className="text-white/50">W: </span>
                  <span className="text-white font-bold">{Math.round(windowWidth)}</span>
                  <span className="text-white/50 ml-2">L: </span>
                  <span className="text-white font-bold">{Math.round(windowCenter)}</span>
                </div>
                <div className="text-[11px] text-white/70">
                  {studyMeta.columns} × {studyMeta.rows}
                </div>
              </div>

              {/* Orientation Labels */}
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-white/50 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                A
              </div>
              <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-mono font-bold text-white/50 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                P
              </div>
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-white/50 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                R
              </div>
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-white/50 pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
              >
                L
              </div>
            </>
          )}

          {/* Slice Timeline Navigation & Cine Controls (Bottom) */}
          {studyMeta && studyMeta.numberOfFrames > 1 && (
            <div className="absolute bottom-4 left-6 right-6 max-w-4xl mx-auto bg-[#18181d]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#27272a] flex items-center gap-3 z-10 shadow-2xl">
              {/* Cine Play/Pause Toggle */}
              <button
                onClick={() => setIsPlayingCine((prev) => !prev)}
                title={isPlayingCine ? 'Pause Cine (Space)' : 'Play Cine Loop (Space)'}
                className="p-1.5 rounded-full bg-[#FF8066] text-black hover:bg-[#ff9680] transition-transform active:scale-95 shadow-[1.5px_1.5px_0px_#ffffff]"
              >
                {isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
              </button>

              {/* Step Previous */}
              <button
                onClick={() => {
                  setIsPlayingCine(false);
                  setCurrentSlice((prev) => (prev > 0 ? prev - 1 : studyMeta.numberOfFrames - 1));
                }}
                title="Previous Frame (Left Arrow)"
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              {/* Step Next */}
              <button
                onClick={() => {
                  setIsPlayingCine(false);
                  setCurrentSlice((prev) => (prev < studyMeta.numberOfFrames - 1 ? prev + 1 : 0));
                }}
                title="Next Frame (Right Arrow)"
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-mono text-zinc-400 shrink-0">Frame:</span>
              <input
                type="range"
                min={0}
                max={studyMeta.numberOfFrames - 1}
                value={currentSlice}
                onChange={(e) => {
                  setIsPlayingCine(false);
                  setCurrentSlice(parseInt(e.target.value, 10));
                }}
                className="flex-1 accent-[#FF8066] cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
              />
              <span className="text-xs font-mono font-bold text-[#FF8066] shrink-0">
                {currentSlice + 1} / {studyMeta.numberOfFrames}
              </span>

              {/* Cine Speed Selector */}
              <div className="hidden sm:flex items-center gap-1 border-l border-zinc-700 pl-3">
                {[10, 15, 24, 30].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setCineFps(fps)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                      cineFps === fps ? 'bg-[#6f7bd4] text-white font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {fps}fps
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Recently Opened Drawer Slideout */}
        {showRecentDrawer && (
          <div className="absolute inset-y-0 right-0 w-80 bg-[#141418]/95 backdrop-blur-xl border-l border-[#27272a] z-40 p-5 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#FF8066]" />
                <span
                  className="font-bold text-sm uppercase text-white"
                  style={{ fontFamily: '"Pratico Variable", sans-serif' }}
                >
                  Recently Opened Studies
                </span>
              </div>
              <button
                onClick={() => setShowRecentDrawer(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1">
              {recentStudies.length === 0 ? (
                <div className="text-center py-12 text-[#888894] text-xs font-mono">
                  No cached studies yet. Opened DICOMs will persist here automatically.
                </div>
              ) : (
                recentStudies.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadFromCache(s.id, s.fileName)}
                    className="p-2.5 rounded-xl bg-[#1e1e24] hover:bg-[#282832] border border-[#27272a] hover:border-[#FF8066]/60 cursor-pointer transition-all flex gap-3 items-center group"
                  >
                    {s.thumbnailDataUrl ? (
                      <img
                        src={s.thumbnailDataUrl}
                        alt="thumb"
                        className="w-12 h-12 rounded-lg object-cover bg-black shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 font-mono text-xs">
                      <div className="font-bold text-white truncate group-hover:text-[#FF8066] transition-colors">
                        {s.patientName}
                      </div>
                      <div className="text-[11px] text-[#a1a1aa] truncate">{s.fileName}</div>
                      <div className="flex items-center gap-2 text-[10px] text-[#888894] mt-0.5">
                        <span className="text-[#FF8066] font-bold">{s.modality}</span>
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
          <div className="absolute top-4 right-4 z-30 w-72 bg-[#18181d]/90 backdrop-blur-md rounded-2xl border border-[#27272a] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-[#22222a]/60 border-b border-[#27272a] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF8066] animate-pulse" />
                <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                  0Touch Gesture Stream
                </span>
              </div>
              <span className="text-[#a1a1aa]">{gestureFps} FPS</span>
            </div>

            {/* Video element running MediaPipe analysis */}
            <div className="relative aspect-video bg-black overflow-hidden">
              <video
                ref={webcamVideoRef}
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />

              {/* Status pill on video */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono px-2.5 py-1 rounded-full bg-black/80 border border-white/10 backdrop-blur-sm">
                <span className="text-[#FF8066] font-bold truncate">
                  {gestureDebug?.classifiedGesture || 'WAITING'}
                </span>
                <span className="text-white/60 shrink-0 ml-1">
                  {gestureDebug?.trackingStatus || 'SEARCH'}
                </span>
              </div>
            </div>

            {/* Gesture Telemetry Pill */}
            <div className="p-3 space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-1.5 rounded-xl bg-[#22222a] border border-[#27272a]">
                  <span className="text-[10px] text-sky-400 block font-bold">LEFT HAND</span>
                  <span className="text-lg font-extrabold text-sky-400">
                    {leftHand?.extendedCount ?? 0}
                  </span>
                  <span className="text-[10px] text-[#888894] block">{leftHand?.posture ?? 'NONE'}</span>
                </div>

                <div className="p-1.5 rounded-xl bg-[#22222a] border border-[#27272a]">
                  <span className="text-[10px] text-[#FF8066] block font-bold">RIGHT HAND</span>
                  <span className="text-lg font-extrabold text-[#FF8066]">
                    {rightHand?.extendedCount ?? 0}
                  </span>
                  <span className="text-[10px] text-[#888894] block">{rightHand?.posture ?? 'NONE'}</span>
                </div>
              </div>

              {/* Hold Progress Bar */}
              {gestureDebug?.holdProgressPercent !== undefined && gestureDebug.holdProgressPercent > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[#888894]">
                    <span>Confirmation Hold:</span>
                    <span className="text-[#FF8066] font-bold">{gestureDebug.holdProgressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF8066] transition-all duration-75"
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
          <div className="absolute bottom-4 left-4 z-40 p-3 rounded-xl bg-[#27272a] text-[#FF8066] border border-[#FF8066]/40 text-xs flex items-center gap-2 font-mono shadow-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Keyboard Shortcuts & Gestures Quick Help Modal */}
        {showHelpModal && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <div
              className="bg-[#18181b] border-2 border-[#27272a] shadow-[6px_6px_0px_#09090b] max-w-xl w-full p-6 text-zinc-200 font-mono space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b-2 border-[#27272a] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#FF8066] rounded-full" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    0Touch Control Quick Reference
                  </h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 hover:bg-[#27272a] text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Two Column Grid: Gestures & Keyboard */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Gestures Reference */}
                <div className="space-y-2 bg-[#222226] p-3 border border-[#27272a]">
                  <span className="font-bold text-[#FF8066] uppercase text-[11px] block border-b border-zinc-700 pb-1">
                    Touchless Gestures
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">1 + 1 Poses:</span>
                      <span className="font-bold text-white">Slice Nav Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">2 + 2 Poses:</span>
                      <span className="font-bold text-white">Zoom Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">3 + 3 Poses:</span>
                      <span className="font-bold text-white">Windowing Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">4 + 4 Poses:</span>
                      <span className="font-bold text-white">Panning Mode</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Open + Fist:</span>
                      <span className="font-bold text-white">Step A (Prev / In)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Fist + Open:</span>
                      <span className="font-bold text-white">Step B (Next / Out)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Fist + Fist:</span>
                      <span className="font-bold text-zinc-400">Safety Rest</span>
                    </div>
                  </div>
                </div>

                {/* Keyboard Shortcuts */}
                <div className="space-y-2 bg-[#222226] p-3 border border-[#27272a]">
                  <span className="font-bold text-[#FF8066] uppercase text-[11px] block border-b border-zinc-700 pb-1">
                    Keyboard Shortcuts
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">1</kbd> - <kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">4</kbd></span>
                      <span className="font-bold text-white">Switch Modes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">←</kbd> <kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">→</kbd></span>
                      <span className="font-bold text-white">Step Slices</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">Space</kbd></span>
                      <span className="font-bold text-white">Play / Pause Cine</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">+</kbd> / <kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">-</kbd></span>
                      <span className="font-bold text-white">Zoom In / Out</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">R</kbd></span>
                      <span className="font-bold text-white">Reset Viewport</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">F</kbd></span>
                      <span className="font-bold text-white">Fullscreen</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">I</kbd></span>
                      <span className="font-bold text-white">Invert Grayscale</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400"><kbd className="px-1 py-0.5 bg-[#27272a] border border-zinc-700 text-white">G</kbd></span>
                      <span className="font-bold text-white">Toggle Gestures</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 text-center pt-1 border-t border-[#27272a]">
                Press <kbd className="px-1.5 py-0.5 bg-[#27272a] border border-zinc-700 text-zinc-300">?</kbd> or <kbd className="px-1.5 py-0.5 bg-[#27272a] border border-zinc-700 text-zinc-300">Esc</kbd> anytime to close
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
