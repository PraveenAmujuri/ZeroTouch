/**
 * 0Touch Gesture Engine - High-level Gesture Controller
 * Connects HandTracker, LandmarkSmoother, FingerDetection, and GestureStateMachine into a single lifecycle.
 */

import { HandTracker } from './handTracker';
import { LandmarkSmoother } from './gestureSmoothing';
import { detectFingerStates } from './fingerDetection';
import { GestureStateMachine } from './gestureStateMachine';
import {
  TrackedHandRaw,
  FingerStates,
  GestureActionEvent,
  GestureDebugInfo,
  OperationMode,
  GestureThresholds,
  FilterConfig,
} from './types';

export class GestureController {
  private tracker: HandTracker;
  private smoother: LandmarkSmoother;
  private stateMachine: GestureStateMachine;

  private isRunning = false;
  private animationFrameId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  // Frame timing & FPS
  private prevFrameTime = 0;
  public currentFps = 0;
  public frameLatencyMs = 0;

  // Hand state snapshots
  public leftHand: FingerStates | null = null;
  public rightHand: FingerStates | null = null;
  public rawTrackedHands: TrackedHandRaw[] = [];

  // Listeners
  private onActionListener: ((event: GestureActionEvent) => void) | null = null;
  private onDebugListener: ((info: GestureDebugInfo) => void) | null = null;

  constructor(thresholds?: Partial<GestureThresholds>, filterConfig?: FilterConfig) {
    this.tracker = new HandTracker();
    this.smoother = new LandmarkSmoother(filterConfig);
    this.stateMachine = new GestureStateMachine(thresholds);
  }

  public async initialize(): Promise<void> {
    await this.tracker.initialize();
  }

  public onAction(callback: (event: GestureActionEvent) => void): void {
    this.onActionListener = callback;
  }

  public onDebug(callback: (info: GestureDebugInfo) => void): void {
    this.onDebugListener = callback;
  }

  public setMode(mode: OperationMode): void {
    this.stateMachine.setMode(mode);
  }

  public start(video: HTMLVideoElement): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.videoElement = video;
    this.prevFrameTime = performance.now();

    const loop = (timestamp: number) => {
      if (!this.isRunning) return;
      this.processFrame(timestamp);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.smoother.reset();
    const stopEvent = this.stateMachine.handleTrackingLoss();
    if (stopEvent && this.onActionListener) {
      this.onActionListener(stopEvent);
    }
  }

  public processFrame(timestampMs: number): GestureActionEvent | null {
    if (!this.videoElement || this.videoElement.readyState < 2) {
      return null;
    }

    const startPerf = performance.now();
    const dt = (timestampMs - this.prevFrameTime) / 1000;
    if (dt > 0) {
      this.currentFps = 0.9 * this.currentFps + 0.1 * (1.0 / dt);
    }
    this.prevFrameTime = timestampMs;

    const currentTimeSeconds = timestampMs / 1000;

    // Detect raw hand landmarks
    this.rawTrackedHands = this.tracker.detectVideo(this.videoElement, timestampMs);

    let actionEvent: GestureActionEvent | null = null;

    if (this.rawTrackedHands.length < 2) {
      this.smoother.reset();
      this.leftHand = null;
      this.rightHand = null;
      actionEvent = this.stateMachine.handleTrackingLoss();
      const status = this.rawTrackedHands.length === 1 ? 'PARTIAL' : 'LOST';
      const debug = this.stateMachine.getDebugInfo(status);
      if (this.onDebugListener) this.onDebugListener(debug);
      if (actionEvent && this.onActionListener) this.onActionListener(actionEvent);
      this.frameLatencyMs = performance.now() - startPerf;
      return actionEvent;
    }

    // Process both hands
    let leftHandData: FingerStates | null = null;
    let rightHandData: FingerStates | null = null;

    for (let i = 0; i < 2; i++) {
      const rawHand = this.rawTrackedHands[i];
      const smoothed = this.smoother.smoothLandmarks(rawHand.landmarks, currentTimeSeconds, i);
      const side = rawHand.screenSide || (rawHand.centroidX < 0.5 ? 'LEFT' : 'RIGHT');
      const fingerStates = detectFingerStates(smoothed, side, rawHand.centroidX, rawHand.centroidY);

      if (side === 'LEFT') {
        leftHandData = fingerStates;
      } else {
        rightHandData = fingerStates;
      }
    }

    // Fallbacks
    if (!leftHandData && rightHandData) leftHandData = rightHandData;
    if (!rightHandData && leftHandData) rightHandData = leftHandData;

    this.leftHand = leftHandData;
    this.rightHand = rightHandData;

    if (leftHandData && rightHandData) {
      actionEvent = this.stateMachine.update(leftHandData, rightHandData, currentTimeSeconds);
      const debug = this.stateMachine.getDebugInfo('CONNECTED');
      if (this.onDebugListener) this.onDebugListener(debug);
      if (actionEvent && this.onActionListener) this.onActionListener(actionEvent);
    }

    this.frameLatencyMs = performance.now() - startPerf;
    return actionEvent;
  }

  public getStateMachine(): GestureStateMachine {
    return this.stateMachine;
  }

  public getTracker(): HandTracker {
    return this.tracker;
  }
}
