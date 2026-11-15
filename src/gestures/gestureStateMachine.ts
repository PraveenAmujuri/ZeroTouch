/**
 * 0Touch Gesture Engine - State Machine & Event Dispatcher
 * Manages mode switching, stability confirmation, temporal hold timers,
 * repeat cadences, anti-repeat locks, and neutral rearming.
 * Direct port of GestureEngine in core/gesture_engine.py.
 */

import {
  OperationMode,
  InteractionState,
  TwoHandPose,
  GestureActionType,
  GestureActionEvent,
  GestureThresholds,
  FingerStates,
  GestureDebugInfo,
} from './types';
import { classifyTwoHandPose, FINGER_COUNT_TO_MODE } from './gestureClassifier';

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  modeSwitchHoldTime: 0.60,
  modeSwitchCooldown: 0.70,
  windowChangeHoldTime: 0.45,
  windowChangeCooldown: 0.60,
  actionDeadzone: 0.02,
  actionCooldown: 0.03,
  sliceStepDelay: 0.28,
  zoomSensitivity: 0.045,
  presetSwitchDelay: 0.50,
  panStepDistance: 25.0,
  panStepDelay: 0.28,
  panGestureHoldTime: 0.18,
  panSensitivity: 12.0,
  neutralReleaseDelay: 0.10,
  handLossTimeout: 0.40,
};

export class GestureStateMachine {
  public currentMode: OperationMode = OperationMode.SLICE_NAV;
  public interactionState: InteractionState = InteractionState.READY;
  public currentPose: TwoHandPose = TwoHandPose.BACKGROUND;

  private cfg: GestureThresholds;

  // Finger counts and postures
  public leftCount = 0;
  public rightCount = 0;
  public leftPosture = 'NONE';
  public rightPosture = 'NONE';

  // Mode Selection State
  private modeCandidateCount: number | null = null;
  private modeHoldStartTime: number | null = null;
  private modeSelectionExecuted = false; // Anti-repeat lock while held
  private selectionRearmed = true;        // Requires neutral return to rearm

  // Window Change State (HAND + HAND 5+5)
  private handHandStartTime: number | null = null;
  private lastWindowSwitchTime = 0.0;

  // Action State
  private actionInProgress = false;
  private activeActionName = 'NONE';
  private lastActionTickTime = 0.0;
  private sliceHoldStartTime: number | null = null;
  private presetHoldStartTime: number | null = null;

  // Step-based Directional Panning State
  private panStepCandidate: number | null = null;
  private panStepStartTime: number | null = null;
  private panStepLastTickTime = 0.0;
  private panStepRearmed = true;

  // Diagnostics
  public lastClassifiedGesture = 'BACKGROUND (Stop)';
  public holdProgressPercent = 0;

  constructor(thresholds?: Partial<GestureThresholds>) {
    this.cfg = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  public resetInteractions(): void {
    this.actionInProgress = false;
    this.activeActionName = 'NONE';
    this.sliceHoldStartTime = null;
    this.presetHoldStartTime = null;
    this.handHandStartTime = null;
    this.modeHoldStartTime = null;
    this.modeCandidateCount = null;
    this.panStepCandidate = null;
    this.panStepStartTime = null;
    this.panStepLastTickTime = 0.0;
    this.panStepRearmed = true;
    this.holdProgressPercent = 0;
  }

  public handleTrackingLoss(): GestureActionEvent | null {
    const hadAction = this.actionInProgress;
    this.resetInteractions();
    this.selectionRearmed = true;
    this.modeSelectionExecuted = false;
    this.interactionState = InteractionState.NEUTRAL;
    this.currentPose = TwoHandPose.BACKGROUND;
    this.leftCount = 0;
    this.rightCount = 0;
    this.leftPosture = 'NONE';
    this.rightPosture = 'NONE';
    this.lastClassifiedGesture = 'HAND LOSS (Stop)';
    this.holdProgressPercent = 0;

    if (hadAction) {
      return { type: 'ACTION_STOP', value: null, timestamp: performance.now() / 1000 };
    }
    return null;
  }

  public setMode(mode: OperationMode): void {
    this.currentMode = mode;
  }

  /**
   * Main state machine transition method.
   * Call once per frame when two hands are tracked.
   */
  public update(
    leftHand: FingerStates,
    rightHand: FingerStates,
    currentTimeSeconds: number
  ): GestureActionEvent | null {
    this.leftCount = leftHand.extendedCount;
    this.rightCount = rightHand.extendedCount;
    this.leftPosture = leftHand.posture;
    this.rightPosture = rightHand.posture;

    const classification = classifyTwoHandPose(leftHand, rightHand);
    const detectedPose = classification.detectedPose;
    this.currentPose = detectedPose;

    // 1. NEUTRAL / SAFETY REST (BACKGROUND or FIST_FIST)
    if (detectedPose === TwoHandPose.BACKGROUND || detectedPose === TwoHandPose.FIST_FIST) {
      // Rearm mode selection and directional panning when user releases into neutral
      this.selectionRearmed = true;
      this.modeSelectionExecuted = false;
      this.modeHoldStartTime = null;
      this.modeCandidateCount = null;
      this.panStepRearmed = true;
      this.panStepCandidate = null;
      this.panStepStartTime = null;
      this.holdProgressPercent = 0;

      const hadAction = this.actionInProgress;
      this.resetInteractions();
      this.interactionState = InteractionState.NEUTRAL;

      if (detectedPose === TwoHandPose.FIST_FIST) {
        this.lastClassifiedGesture = 'FIST+FIST (Safety Rest / No Action)';
      } else {
        this.lastClassifiedGesture = `NEUTRAL [${this.leftCount}+${this.rightCount}] (Stop)`;
      }

      if (hadAction) {
        return { type: 'ACTION_STOP', value: null, timestamp: currentTimeSeconds };
      }
      return null;
    }

    // 2. PANNING MODE: STEP-BASED DIRECTIONAL PANNING
    // When currentMode is PANNING:
    // 1+1: Left (-25px), 2+2: Right (+25px), 3+3: Up (-25px), 4+4: Down (+25px)
    if (this.currentMode === OperationMode.PANNING && detectedPose === TwoHandPose.MATCHING_COUNTS) {
      this.actionInProgress = true;
      this.interactionState = InteractionState.ACTION;

      const panStepMap: Record<number, { dx: number; dy: number; dir: string }> = {
        1: { dx: -this.cfg.panStepDistance, dy: 0, dir: 'LEFT' },
        2: { dx: this.cfg.panStepDistance, dy: 0, dir: 'RIGHT' },
        3: { dx: 0, dy: -this.cfg.panStepDistance, dir: 'UP' },
        4: { dx: 0, dy: this.cfg.panStepDistance, dir: 'DOWN' },
      };

      const stepConfig = panStepMap[this.leftCount];
      if (stepConfig) {
        this.activeActionName = `PAN_${stepConfig.dir}`;

        // Candidate stability check
        if (this.panStepCandidate !== this.leftCount) {
          this.panStepCandidate = this.leftCount;
          this.panStepStartTime = currentTimeSeconds;
          this.lastClassifiedGesture = `PAN ${stepConfig.dir}: DETECTING`;
          this.holdProgressPercent = 0;
          return null;
        }

        const elapsedPose = currentTimeSeconds - (this.panStepStartTime || currentTimeSeconds);
        const stabilityThreshold = this.cfg.panGestureHoldTime; // 0.18s

        if (elapsedPose < stabilityThreshold) {
          this.lastClassifiedGesture = `PAN ${stepConfig.dir}: CONFIRMING`;
          this.holdProgressPercent = Math.min(100, Math.round((elapsedPose / stabilityThreshold) * 100));
          return null;
        }

        this.holdProgressPercent = 100;
        const stepDelay = this.cfg.panStepDelay; // 0.28s

        // First step after rearm or elapsed cadence interval
        if (this.panStepRearmed || currentTimeSeconds - this.panStepLastTickTime >= stepDelay) {
          this.panStepRearmed = false;
          this.panStepLastTickTime = currentTimeSeconds;
          this.lastClassifiedGesture = `PAN ${stepConfig.dir}: STEP`;
          return {
            type: 'PAN',
            value: { dx: stepConfig.dx, dy: stepConfig.dy },
            timestamp: currentTimeSeconds,
          };
        } else {
          this.lastClassifiedGesture = `PAN ${stepConfig.dir}: HELD`;
          return null;
        }
      }
    }

    // 3. MODE SELECTION (Two-Hand Matching Finger Counts 1..4)
    // Active in other modes to switch modes
    if (detectedPose === TwoHandPose.MATCHING_COUNTS) {
      const targetMode = FINGER_COUNT_TO_MODE[this.leftCount];
      const hadAction = this.actionInProgress;
      this.actionInProgress = false;
      this.activeActionName = 'NONE';
      this.handHandStartTime = null;
      this.interactionState = InteractionState.MODE_SELECTION;

      // Anti-repeat lock: already executed for this continuous hold
      if (this.modeSelectionExecuted) {
        this.lastClassifiedGesture = `${this.leftCount}+${this.rightCount} (Held: ${this.currentMode})`;
        this.holdProgressPercent = 100;
        if (hadAction) {
          return { type: 'ACTION_STOP', value: null, timestamp: currentTimeSeconds };
        }
        return null;
      }

      // Must be rearmed from neutral
      if (!this.selectionRearmed) {
        this.lastClassifiedGesture = 'RELEASE TO REARM';
        this.holdProgressPercent = 0;
        if (hadAction) {
          return { type: 'ACTION_STOP', value: null, timestamp: currentTimeSeconds };
        }
        return null;
      }

      // Candidate stability check
      if (this.modeCandidateCount !== this.leftCount) {
        this.modeCandidateCount = this.leftCount;
        this.modeHoldStartTime = currentTimeSeconds;
        this.lastClassifiedGesture = `DETECTING ${this.leftCount}+${this.rightCount} -> ${targetMode}`;
        this.holdProgressPercent = 0;
        if (hadAction) {
          return { type: 'ACTION_STOP', value: null, timestamp: currentTimeSeconds };
        }
        return null;
      } else {
        const elapsed = currentTimeSeconds - (this.modeHoldStartTime || currentTimeSeconds);
        if (elapsed >= this.cfg.modeSwitchHoldTime) {
          // Confirmed! (0.60s hold)
          this.setMode(targetMode);
          this.modeSelectionExecuted = true;
          this.selectionRearmed = false;
          this.modeHoldStartTime = null;
          this.lastClassifiedGesture = `SELECTED: ${targetMode}`;
          this.holdProgressPercent = 100;
          return { type: 'MODE_CHANGED', value: targetMode, timestamp: currentTimeSeconds };
        } else {
          const pct = Math.min(99, Math.round((elapsed / this.cfg.modeSwitchHoldTime) * 100));
          this.holdProgressPercent = pct;
          this.lastClassifiedGesture = `HOLDING ${this.leftCount}+${this.rightCount} (${pct}%)`;
          if (hadAction) {
            return { type: 'ACTION_STOP', value: null, timestamp: currentTimeSeconds };
          }
          return null;
        }
      }
    }

    // Reset mode hold timer if pose shifted
    this.modeHoldStartTime = null;
    this.modeCandidateCount = null;

    // 4. ACTIVE VIEWING WINDOW PRESETS (HAND + HAND, exact 5+5)
    // Hold 0.45s, cooldown 0.60s
    if (detectedPose === TwoHandPose.HAND_HAND) {
      this.actionInProgress = false;
      this.activeActionName = 'NONE';
      this.interactionState = InteractionState.ACTION;

      if (currentTimeSeconds - this.lastWindowSwitchTime < this.cfg.windowChangeCooldown) {
        this.lastClassifiedGesture = 'WINDOW COOLDOWN';
        this.holdProgressPercent = 0;
        return null;
      }

      if (this.handHandStartTime === null) {
        this.handHandStartTime = currentTimeSeconds;
        this.lastClassifiedGesture = 'HAND+HAND (Hold for Preset)';
        this.holdProgressPercent = 0;
        return null;
      } else {
        const elapsed = currentTimeSeconds - this.handHandStartTime;
        if (elapsed >= this.cfg.windowChangeHoldTime) {
          this.handHandStartTime = null;
          this.lastWindowSwitchTime = currentTimeSeconds;
          this.lastClassifiedGesture = 'WINDOW PRESET CHANGED';
          this.holdProgressPercent = 100;
          return { type: 'WINDOW_CHANGED', value: null, timestamp: currentTimeSeconds };
        } else {
          const pct = Math.min(99, Math.round((elapsed / this.cfg.windowChangeHoldTime) * 100));
          this.holdProgressPercent = pct;
          this.lastClassifiedGesture = `SWITCHING WINDOW (${pct}%)`;
          return null;
        }
      }
    }

    this.handHandStartTime = null;

    // 5. DIRECTIONAL ACTIONS (HAND+FIST or FIST+HAND)
    if (detectedPose === TwoHandPose.HAND_FIST || detectedPose === TwoHandPose.FIST_HAND) {
      const isDirA = detectedPose === TwoHandPose.HAND_FIST;
      this.actionInProgress = true;
      this.interactionState = InteractionState.ACTION;
      this.holdProgressPercent = 0;

      // --- MODE: SLICE NAVIGATION ---
      if (this.currentMode === OperationMode.SLICE_NAV) {
        const actionType: GestureActionType = isDirA ? 'SLICE_PREV' : 'SLICE_NEXT';
        this.activeActionName = actionType;

        if (this.sliceHoldStartTime === null) {
          this.sliceHoldStartTime = currentTimeSeconds;
          this.lastClassifiedGesture = `${detectedPose}: ${actionType}`;
          return { type: actionType, value: null, timestamp: currentTimeSeconds };
        } else {
          if (currentTimeSeconds - this.sliceHoldStartTime >= this.cfg.sliceStepDelay) {
            this.sliceHoldStartTime = currentTimeSeconds;
            this.lastClassifiedGesture = `${detectedPose}: ${actionType}`;
            return { type: actionType, value: null, timestamp: currentTimeSeconds };
          }
        }
        return null;
      }

      // --- MODE: ZOOM ---
      else if (this.currentMode === OperationMode.ZOOM) {
        this.activeActionName = isDirA ? 'ZOOM_IN' : 'ZOOM_OUT';
        if (currentTimeSeconds - this.lastActionTickTime >= this.cfg.actionCooldown) {
          this.lastActionTickTime = currentTimeSeconds;
          const zoomDelta = isDirA ? this.cfg.zoomSensitivity : -this.cfg.zoomSensitivity;
          this.lastClassifiedGesture = `${detectedPose}: ${isDirA ? 'ZOOM IN' : 'ZOOM OUT'}`;
          return { type: 'ZOOM', value: zoomDelta, timestamp: currentTimeSeconds };
        }
        return null;
      }

      // --- MODE: WINDOWING (Preset step prev / next) ---
      else if (this.currentMode === OperationMode.WINDOWING) {
        const actionType: GestureActionType = isDirA ? 'PREV_PRESET' : 'NEXT_PRESET';
        this.activeActionName = actionType;

        if (this.presetHoldStartTime === null) {
          this.presetHoldStartTime = currentTimeSeconds;
          this.lastClassifiedGesture = `${detectedPose}: ${actionType}`;
          return { type: actionType, value: null, timestamp: currentTimeSeconds };
        } else {
          if (currentTimeSeconds - this.presetHoldStartTime >= this.cfg.presetSwitchDelay) {
            this.presetHoldStartTime = currentTimeSeconds;
            this.lastClassifiedGesture = `${detectedPose}: ${actionType}`;
            return { type: actionType, value: null, timestamp: currentTimeSeconds };
          }
        }
        return null;
      }

      // --- MODE: PANNING ---
      else if (this.currentMode === OperationMode.PANNING) {
        this.activeActionName = isDirA ? 'PAN_LEFT' : 'PAN_RIGHT';
        if (currentTimeSeconds - this.lastActionTickTime >= this.cfg.actionCooldown) {
          this.lastActionTickTime = currentTimeSeconds;
          const panDx = isDirA ? -this.cfg.panSensitivity : this.cfg.panSensitivity;
          this.lastClassifiedGesture = `${detectedPose}: ${isDirA ? 'PAN LEFT' : 'PAN RIGHT'}`;
          return { type: 'PAN', value: { dx: panDx, dy: 0 }, timestamp: currentTimeSeconds };
        }
        return null;
      }
    }

    return null;
  }

  public getDebugInfo(trackingStatus: 'CONNECTED' | 'PARTIAL' | 'LOST'): GestureDebugInfo {
    return {
      handsCount: trackingStatus === 'CONNECTED' ? 2 : trackingStatus === 'PARTIAL' ? 1 : 0,
      leftCount: this.leftCount,
      rightCount: this.rightCount,
      leftPosture: this.leftPosture as any,
      rightPosture: this.rightPosture as any,
      state: this.interactionState,
      pose: this.currentPose,
      mode: this.currentMode,
      activeAction: this.activeActionName,
      trackingStatus,
      holdProgressPercent: this.holdProgressPercent,
      classifiedGesture: this.lastClassifiedGesture,
    };
  }
}
