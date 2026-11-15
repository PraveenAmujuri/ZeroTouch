/**
 * 0Touch Gesture Engine - Gesture Classifier
 * Evaluates the two-hand pose category and strict priority hierarchy.
 * Matches core/gesture_engine.py logic.
 */

import { FingerStates, TwoHandPose, OperationMode } from './types';

export const FINGER_COUNT_TO_MODE: Record<number, OperationMode> = {
  1: OperationMode.SLICE_NAV,
  2: OperationMode.ZOOM,
  3: OperationMode.WINDOWING,
  4: OperationMode.PANNING,
};

export interface PoseClassificationResult {
  detectedPose: TwoHandPose;
  leftCount: number;
  rightCount: number;
  isMatchingCount: boolean;
  matchingCountValue?: number;
}

/**
 * Classifies two tracked hands into an unambiguous TwoHandPose.
 * Priority hierarchy:
 * 1. Action gestures: HAND_FIST, FIST_HAND, HAND_HAND (exact 5+5)
 * 2. Matching finger counts: 1+1, 2+2, 3+3, 4+4
 * 3. FIST_FIST (safety rest stop)
 * 4. BACKGROUND / NEUTRAL
 */
export function classifyTwoHandPose(
  leftHand: FingerStates,
  rightHand: FingerStates
): PoseClassificationResult {
  const leftCount = leftHand.extendedCount;
  const rightCount = rightHand.extendedCount;
  const leftPosture = leftHand.posture;
  const rightPosture = rightHand.posture;

  // Matching finger count candidate: Both hands have the exact same count in [1, 2, 3, 4]
  const isMatchingCount = leftCount === rightCount && leftCount >= 1 && leftCount <= 4;

  // Action Poses (Bockhacker et al.):
  const isHandFist = leftPosture === 'HAND' && rightPosture === 'FIST';
  const isFistHand = leftPosture === 'FIST' && rightPosture === 'HAND';

  // REQUIREMENT 2: HAND + HAND preset cycle gesture requires EXACTLY 5 extended fingers on each hand (5+5),
  // strictly distinct from 4+4 PANNING or looser open hands.
  const isHandHand = leftPosture === 'HAND' && rightPosture === 'HAND' && leftCount === 5 && rightCount === 5;

  const isFistFist = leftPosture === 'FIST' && rightPosture === 'FIST';

  let detectedPose: TwoHandPose;

  if (isHandFist) {
    detectedPose = TwoHandPose.HAND_FIST;
  } else if (isFistHand) {
    detectedPose = TwoHandPose.FIST_HAND;
  } else if (isHandHand) {
    detectedPose = TwoHandPose.HAND_HAND;
  } else if (isMatchingCount) {
    detectedPose = TwoHandPose.MATCHING_COUNTS;
  } else if (isFistFist) {
    detectedPose = TwoHandPose.FIST_FIST;
  } else {
    detectedPose = TwoHandPose.BACKGROUND;
  }

  return {
    detectedPose,
    leftCount,
    rightCount,
    isMatchingCount,
    matchingCountValue: isMatchingCount ? leftCount : undefined,
  };
}
