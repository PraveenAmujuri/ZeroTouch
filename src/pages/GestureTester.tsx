import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  GestureController,
  GestureDebugInfo,
  GestureActionEvent,
  OperationMode,
  FingerStates,
} from '../gestures';
import { useIsMobile } from '../hooks/useIsMobile';
import { DesktopRequired } from '../components/DesktopRequired';
import { LANDMARK_IDS } from '../gestures/landmarkUtils';
import {
  Camera,
  Layers,
  ZoomIn,
  Move,
  Activity,
  AlertCircle,
  Sliders,
  Play,
  Square,
} from 'lucide-react';

const CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [5, 9], [9, 13], [13, 17],
];

export const GestureTester: React.FC = () => {
  const isMobile = useIsMobile(768);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<GestureController | null>(null);

  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [debugInfo, setDebugInfo] = useState<GestureDebugInfo | null>(null);
  const [recentEvents, setRecentEvents] = useState<GestureActionEvent[]>([]);
  const [leftHandState, setLeftHandState] = useState<FingerStates | null>(null);
  const [rightHandState, setRightHandState] = useState<FingerStates | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  // Initialize GestureController
  useEffect(() => {
    if (isMobile) return;

    const controller = new GestureController();
    controllerRef.current = controller;

    controller.onAction((event) => {
      setRecentEvents((prev) => [event, ...prev.slice(0, 19)]);
    });

    controller.onDebug((info) => {
      setDebugInfo(info);
      setLeftHandState(controller.leftHand);
      setRightHandState(controller.rightHand);
      setFps(Math.round(controller.currentFps));
      setLatencyMs(Math.round(controller.frameLatencyMs));
    });

    const initEngine = async () => {
      try {
        setIsInitializing(true);
        setInitError(null);
        await controller.initialize();
        setIsInitializing(false);
      } catch (err: any) {
        console.error('Initialization error:', err);
        setInitError(err.message || 'Failed to load MediaPipe Tasks Vision model');
        setIsInitializing(false);
      }
    };

    initEngine();

    return () => {
      controller.stop();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isMobile]);

  // Teardown and stop webcam immediately if resized to mobile
  useEffect(() => {
    if (isMobile) {
      if (controllerRef.current) {
        controllerRef.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
    }
  }, [isMobile]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !controllerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      controllerRef.current.start(videoRef.current);
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Webcam access error:', err);
      setInitError('Could not access webcam. Please allow camera permissions.');
    }
  }, []);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.stop();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Render Hand Skeleton overlays on Canvas
  useEffect(() => {
    let animId: number;

    const renderOverlay = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const controller = controllerRef.current;

      if (canvas && video && controller && isStreaming) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const trackedHands = controller.rawTrackedHands;

          trackedHands.forEach((hand) => {
            const isLeft = hand.screenSide === 'LEFT' || (hand.centroidX < 0.5);
            const primaryColor = isLeft ? '#3b82f6' : '#f97316'; // Blue for Left, Orange for Right

            // Connections
            ctx.lineWidth = 3;
            ctx.strokeStyle = primaryColor;
            CONNECTIONS.forEach(([i, j]) => {
              const p1 = hand.landmarks[i];
              const p2 = hand.landmarks[j];
              if (p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                ctx.stroke();
              }
            });

            // Landmark points
            hand.landmarks.forEach((p, idx) => {
              const x = p.x * canvas.width;
              const y = p.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, idx === LANDMARK_IDS.WRIST ? 6 : 4, 0, 2 * Math.PI);
              ctx.fillStyle = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? '#ffffff' : primaryColor;
              ctx.fill();
            });

            // Centroid tag
            const cx = hand.centroidX * canvas.width;
            const cy = hand.centroidY * canvas.height;
            ctx.fillStyle = primaryColor;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`${hand.screenSide || (isLeft ? 'LEFT' : 'RIGHT')}`, cx - 20, cy - 15);
          });
        }
      }

      animId = requestAnimationFrame(renderOverlay);
    };

    animId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(animId);
  }, [isStreaming]);

  const modeIcons = {
    [OperationMode.SLICE_NAV]: <Layers className="w-5 h-5 text-sky-400" />,
    [OperationMode.ZOOM]: <ZoomIn className="w-5 h-5 text-emerald-400" />,
    [OperationMode.WINDOWING]: <Sliders className="w-5 h-5 text-amber-400" />,
    [OperationMode.PANNING]: <Move className="w-5 h-5 text-purple-400" />,
  };

  // Mobile screen restriction: Render Desktop Experience Required screen
  if (isMobile) {
    return <DesktopRequired />;
  }

  return (
    <div className="min-h-screen bg-[#0e0e12] text-white pt-24 pb-16 px-4 md:px-8 selection:bg-orange-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Live Engine
              </span>
              <span className="text-xs text-white/50 font-mono">Two-Hand Gesture System</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mt-1 font-pratico">
              0Touch Browser Gesture Testbed
            </h1>
            <p className="text-sm text-white/60">
              Direct MediaPipe Tasks Vision browser-native port with 1€ filter smoothing and matching finger-count selection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                disabled={isInitializing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#ffa694] hover:bg-white text-[#27272a] font-bold uppercase tracking-wider text-xs transition-all border-2 border-[#27272a] shadow-[3px_3px_#27272a] disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#6f7bd4] text-white font-bold uppercase tracking-wider text-xs transition-all border-2 border-[#27272a] shadow-[3px_3px_#27272a]"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {initError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-300">Model or Camera Error</p>
              <p className="text-red-200/80 mt-0.5">{initError}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Video + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Video Preview & Overlay (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
              {/* Webcam Video (Mirrored horizontally for natural interaction) */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${isStreaming ? 'block' : 'hidden'}`}
              />
              {/* Canvas Skeleton Overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />

              {!isStreaming && (
                <div className="flex flex-col items-center justify-center text-center p-8 text-white/40">
                  <Camera className="w-16 h-16 stroke-1 mb-3" />
                  <p className="text-base font-semibold text-white/70">Webcam Inactive</p>
                  <p className="text-xs max-w-sm mt-1 text-white/40">
                    Click "Start Camera" to initialize the browser-native two-hand tracking pipeline at chest level.
                  </p>
                </div>
              )}

              {/* Live Overlay HUD */}
              {isStreaming && (
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
                  {/* Tracking Status Pill */}
                  <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-2 text-xs font-mono">
                    <span
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        debugInfo?.trackingStatus === 'CONNECTED'
                          ? 'bg-emerald-400'
                          : debugInfo?.trackingStatus === 'PARTIAL'
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                      }`}
                    />
                    <span>{debugInfo?.trackingStatus || 'SEARCHING'}</span>
                    <span className="text-white/40">|</span>
                    <span>{fps} FPS</span>
                    <span className="text-white/40">|</span>
                    <span>{latencyMs}ms</span>
                  </div>

                  {/* Mode Badge */}
                  {debugInfo && (
                    <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-2 text-xs font-semibold">
                      {modeIcons[debugInfo.mode]}
                      <span>{debugInfo.mode}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Live Gesture Banner */}
              {isStreaming && debugInfo && (
                <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                  <div className="p-3 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-wider text-white/50">
                        Current Classified Gesture
                      </div>
                      <div className="text-sm font-bold text-orange-400 font-mono">
                        {debugInfo.classifiedGesture}
                      </div>
                    </div>

                    {/* Hold Progress Bar */}
                    {debugInfo.holdProgressPercent !== undefined && debugInfo.holdProgressPercent > 0 && (
                      <div className="w-32 text-right">
                        <div className="text-[10px] font-mono text-white/60 mb-1">
                          Hold: {debugInfo.holdProgressPercent}%
                        </div>
                        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all duration-75"
                            style={{ width: `${debugInfo.holdProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Mode Manual Overrides (Exact dark grey style with orange-white on select) */}
            <div className="p-4 bg-[#18181b] border-2 border-[#27272a] shadow-[4px_4px_#09090b] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-mono text-zinc-300 font-bold uppercase tracking-wider">
                Select Active Mode:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { mode: OperationMode.SLICE_NAV, label: '1+1 Slice Nav' },
                  { mode: OperationMode.ZOOM, label: '2+2 Zoom' },
                  { mode: OperationMode.WINDOWING, label: '3+3 Windowing' },
                  { mode: OperationMode.PANNING, label: '4+4 Panning' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => controllerRef.current?.setMode(item.mode)}
                    className={`px-3.5 py-2 text-xs font-bold uppercase border-2 transition-all ${
                      debugInfo?.mode === item.mode
                        ? 'bg-[#FF8066] text-black border-[#27272a] shadow-[2.5px_2.5px_0px_#ffffff]'
                        : 'bg-[#27272a] text-zinc-300 border-[#3f3f46] hover:bg-[#3f3f46] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: State Diagnostics & Two-Hand Telemetry (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Two-Hand Diagnostics Card */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Hand Card (Blue) */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-blue-400 font-bold">LEFT HAND</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                    {leftHandState ? leftHandState.posture : 'NONE'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-blue-400 font-mono">
                    {leftHandState ? leftHandState.extendedCount : 0}
                  </span>
                  <span className="text-xs text-white/50">fingers extended</span>
                </div>
                {/* Finger dots */}
                <div className="flex gap-1 pt-1">
                  {['T', 'I', 'M', 'R', 'P'].map((f, i) => (
                    <span
                      key={f}
                      className={`text-[10px] w-5 h-5 flex items-center justify-center rounded font-mono font-bold ${
                        leftHandState?.states[i]
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Hand Card (Orange) */}
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-orange-400 font-bold">RIGHT HAND</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono">
                    {rightHandState ? rightHandState.posture : 'NONE'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-orange-400 font-mono">
                    {rightHandState ? rightHandState.extendedCount : 0}
                  </span>
                  <span className="text-xs text-white/50">fingers extended</span>
                </div>
                {/* Finger dots */}
                <div className="flex gap-1 pt-1">
                  {['T', 'I', 'M', 'R', 'P'].map((f, i) => (
                    <span
                      key={f}
                      className={`text-[10px] w-5 h-5 flex items-center justify-center rounded font-mono font-bold ${
                        rightHandState?.states[i]
                          ? 'bg-orange-500 text-white'
                          : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Gesture Engine State Details */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-white/60">
                  Engine Telemetry
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  {debugInfo?.state || 'IDLE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-white/40 block">Detected Pose:</span>
                  <span className="text-white font-semibold">{debugInfo?.pose || 'NONE'}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Active Action:</span>
                  <span className="text-orange-400 font-semibold">{debugInfo?.activeAction || 'NONE'}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Palm Scale (L/R):</span>
                  <span className="text-white font-semibold">
                    {leftHandState?.palmScale.toFixed(2) || '0.00'} / {rightHandState?.palmScale.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Centroid X (L/R):</span>
                  <span className="text-white font-semibold">
                    {leftHandState?.centroidX.toFixed(2) || '0.00'} / {rightHandState?.centroidX.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Action Event Log */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-mono uppercase tracking-wider text-white/70">
                    Dispatched Action Stream
                  </span>
                </div>
                <button
                  onClick={() => setRecentEvents([])}
                  className="text-[10px] text-white/40 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="h-44 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                {recentEvents.length === 0 ? (
                  <p className="text-white/30 text-center py-8 italic text-xs">
                    No actions triggered yet. Present two hands in front of the camera.
                  </p>
                ) : (
                  recentEvents.map((evt, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-white/5 flex items-center justify-between border border-white/5"
                    >
                      <span className="text-orange-400 font-semibold">{evt.type}</span>
                      <span className="text-white/60">
                        {evt.value !== null ? JSON.stringify(evt.value) : 'null'}
                      </span>
                      <span className="text-[10px] text-white/30">
                        {new Date(evt.timestamp * 1000).toLocaleTimeString().slice(3)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documentation / Mapping Cheat Sheet */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-white/80">
            0Touch Interaction Reference & Gesture Truth Table
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <span className="text-sky-400 font-bold block">1 + 1 (Hold 0.6s)</span>
              <p className="text-white/80 font-semibold">SLICE_NAVIGATION</p>
              <p className="text-white/40 text-[11px]">HAND+FIST: Prev Slice</p>
              <p className="text-white/40 text-[11px]">FIST+HAND: Next Slice</p>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <span className="text-emerald-400 font-bold block">2 + 2 (Hold 0.6s)</span>
              <p className="text-white/80 font-semibold">ZOOM</p>
              <p className="text-white/40 text-[11px]">HAND+FIST: Zoom In</p>
              <p className="text-white/40 text-[11px]">FIST+HAND: Zoom Out</p>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <span className="text-amber-400 font-bold block">3 + 3 (Hold 0.6s)</span>
              <p className="text-white/80 font-semibold">WINDOWING</p>
              <p className="text-white/40 text-[11px]">HAND+FIST: Prev Preset</p>
              <p className="text-white/40 text-[11px]">FIST+HAND: Next Preset</p>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <span className="text-purple-400 font-bold block">4 + 4 (Hold 0.6s)</span>
              <p className="text-white/80 font-semibold">PANNING</p>
              <p className="text-white/40 text-[11px]">1+1: Left | 2+2: Right</p>
              <p className="text-white/40 text-[11px]">3+3: Up | 4+4: Down</p>
            </div>
          </div>
          <div className="text-[11px] text-white/50 flex flex-wrap gap-4 pt-2 border-t border-white/5">
            <span>• <strong>HAND + HAND (5+5, Hold 0.45s)</strong>: Cycles Calibrated Preset</span>
            <span>• <strong>FIST + FIST</strong>: Safety Rest / Clutch Stop</span>
            <span>• <strong>Neutral / Release</strong>: Immediate clean stop without unintended reverse commands</span>
          </div>
        </div>
      </div>
    </div>
  );
};
