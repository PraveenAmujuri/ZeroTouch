/**
 * 0Touch Gesture Engine - Type Definitions
 * Preserves exact enum names, parameters, and action tuples from the Python implementation.
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type ScreenSide = 'LEFT' | 'RIGHT';

export type PostureType = 'HAND' | 'FIST' | 'NEUTRAL' | 'NONE';

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
  states: [boolean, boolean, boolean, boolean, boolean];
  extendedCount: number;
  mainFourCount: number;
  posture: PostureType;
  palmScale: number;
  wrist: { x: number; y: number };
  palmCenter: { x: number; y: number };
  centroidX: number;
  centroidY: number;
  screenSide: ScreenSide;
}

export interface TrackedHandRaw {
  landmarks: Point3D[];
  centroidX: number;
  centroidY: number;
  screenSide?: ScreenSide;
}

export enum OperationMode {
  SLICE_NAV = 'SLICE_NAVIGATION',
  ZOOM = 'ZOOM',
  WINDOWING = 'WINDOWING',
  PANNING = 'PANNING',
}

export enum InteractionState {
  READY = 'READY',
  MODE_SELECTION = 'MODE_SELECTION',
  ACTION = 'ACTION',
  NEUTRAL = 'NEUTRAL',
}

export enum TwoHandPose {
  BACKGROUND = 'BACKGROUND',
  FIST_FIST = 'FIST_FIST',
  HAND_FIST = 'HAND_FIST',
  FIST_HAND = 'FIST_HAND',
  HAND_HAND = 'HAND_HAND',
  MATCHING_COUNTS = 'MATCHING_COUNTS',
}

export type GestureActionType =
  | 'MODE_CHANGED'
  | 'WINDOW_CHANGED'
  | 'SLICE_PREV'
  | 'SLICE_NEXT'
  | 'ZOOM'
  | 'WINDOW_CENTER'
  | 'NEXT_PRESET'
  | 'PREV_PRESET'
  | 'PAN'
  | 'ACTION_STOP';

export interface GestureActionEvent {
  type: GestureActionType;
  value: any;
  timestamp: number;
}

export interface GestureThresholds {
  // Mode selection & confirmation
  modeSwitchHoldTime: number;    // default: 0.60s
  modeSwitchCooldown: number;    // default: 0.70s
  windowChangeHoldTime: number;  // default: 0.45s (HAND + HAND 5+5 hold)
  windowChangeCooldown: number;  // default: 0.60s

  // Directional actions & sensitivities
  actionDeadzone: number;        // default: 0.02
  actionCooldown: number;        // default: 0.03s (cadence for continuous zoom/pan)
  sliceStepDelay: number;        // default: 0.28s
  zoomSensitivity: number;       // default: 0.045
  presetSwitchDelay: number;     // default: 0.50s

  // Panning configuration
  panStepDistance: number;       // default: 25.0 px
  panStepDelay: number;          // default: 0.28s (repeat interval when held)
  panGestureHoldTime: number;    // default: 0.18s (stability required before step)
  panSensitivity: number;        // default: 12.0

  // Neutral release
  neutralReleaseDelay: number;   // default: 0.10s
  handLossTimeout: number;       // default: 0.40s
}

export interface FilterConfig {
  minCutoff: number; // default: 1.2 Hz
  beta: number;      // default: 0.5
  dCutoff: number;   // default: 1.0 Hz
}

export interface GestureDebugInfo {
  handsCount: number;
  leftCount: number;
  rightCount: number;
  leftPosture: PostureType;
  rightPosture: PostureType;
  state: InteractionState;
  pose: TwoHandPose;
  mode: OperationMode;
  activeAction: string;
  trackingStatus: 'CONNECTED' | 'PARTIAL' | 'LOST';
  holdProgressPercent?: number;
  classifiedGesture: string;
}
