/**
 * 0Touch Gesture Engine - Node.js Verification Test Suite
 * Tests LandmarkUtils, FingerDetection, GestureClassifier, and GestureStateMachine.
 * Validates equivalence with Python test_gesture_engine.py.
 */

import {
  Point3D,
  OperationMode,
  InteractionState,
  TwoHandPose,
} from './types';
import { getPalmScale } from './landmarkUtils';
import { detectFingerStates } from './fingerDetection';
import { classifyTwoHandPose } from './gestureClassifier';
import { GestureStateMachine } from './gestureStateMachine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function createSyntheticHand(extendedFingers: [boolean, boolean, boolean, boolean, boolean]): Point3D[] {
  // 21 landmarks
  const lms: Point3D[] = [];
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  lms.push(wrist); // 0: WRIST

  // Thumb: 1: CMC, 2: MCP, 3: IP, 4: TIP
  const thumbExt = extendedFingers[0];
  lms.push({ x: 0.45, y: 0.75, z: 0 }); // 1
  lms.push({ x: 0.42, y: 0.70, z: 0 }); // 2: MCP
  lms.push({ x: 0.38, y: 0.65, z: 0 }); // 3: IP
  lms.push({ x: thumbExt ? 0.30 : 0.40, y: thumbExt ? 0.55 : 0.68, z: 0 }); // 4: TIP

  // Fingers: Index (5-8), Middle (9-12), Ring (13-16), Pinky (17-20)
  const fingerCols = [0.44, 0.48, 0.52, 0.56];
  for (let i = 0; i < 4; i++) {
    const isExt = extendedFingers[i + 1];
    const col = fingerCols[i];
    const mcpY = 0.65;
    const pipY = 0.58;
    const dipY = isExt ? 0.52 : 0.61;
    const tipY = isExt ? 0.45 : 0.63;

    lms.push({ x: col, y: mcpY, z: 0 }); // MCP
    lms.push({ x: col, y: pipY, z: 0 }); // PIP
    lms.push({ x: col, y: dipY, z: 0 }); // DIP
    lms.push({ x: col, y: tipY, z: 0 }); // TIP
  }

  return lms;
}

function runTests() {
  console.log('--- RUNNING 0TOUCH TYPESCRIPT GESTURE ENGINE TESTS ---');

  // Test 1: Palm Scale Calculation
  {
    const lms = createSyntheticHand([false, true, false, false, false]);
    const scale = getPalmScale(lms);
    assert(scale > 0.05, `Palm scale should be realistic, got ${scale}`);
    console.log('✓ Test 1: Palm scale calculation passed.');
  }

  // Test 2: Finger Detection (Open Hand vs Fist vs Individual counts)
  {
    // Full Open Hand (5 fingers)
    const openLms = createSyntheticHand([true, true, true, true, true]);
    const openHand = detectFingerStates(openLms, 'LEFT', 0.3, 0.5);
    assert(openHand.extendedCount === 5, `Expected 5 extended fingers, got ${openHand.extendedCount}`);
    assert(openHand.posture === 'HAND', `Expected HAND posture, got ${openHand.posture}`);

    // Closed Fist (0 fingers)
    const fistLms = createSyntheticHand([false, false, false, false, false]);
    const fistHand = detectFingerStates(fistLms, 'RIGHT', 0.7, 0.5);
    assert(fistHand.extendedCount === 0, `Expected 0 extended fingers, got ${fistHand.extendedCount}`);
    assert(fistHand.posture === 'FIST', `Expected FIST posture, got ${fistHand.posture}`);

    // 1 Finger (Index only)
    const oneLms = createSyntheticHand([false, true, false, false, false]);
    const oneHand = detectFingerStates(oneLms, 'LEFT', 0.3, 0.5);
    assert(oneHand.extendedCount === 1, `Expected 1 extended finger, got ${oneHand.extendedCount}`);
    assert(oneHand.posture === 'NEUTRAL', `Single finger should be NEUTRAL posture, got ${oneHand.posture}`);

    console.log('✓ Test 2: Finger detection and posture classification passed.');
  }

  // Test 3: Pose Classification & Priority Hierarchy
  {
    const openHand = detectFingerStates(createSyntheticHand([true, true, true, true, true]), 'LEFT', 0.3, 0.5);
    const fistHand = detectFingerStates(createSyntheticHand([false, false, false, false, false]), 'RIGHT', 0.7, 0.5);

    // HAND_FIST (Direction A)
    const p1 = classifyTwoHandPose(openHand, fistHand);
    assert(p1.detectedPose === TwoHandPose.HAND_FIST, `Expected HAND_FIST, got ${p1.detectedPose}`);

    // FIST_HAND (Direction B)
    const p2 = classifyTwoHandPose(fistHand, openHand);
    assert(p2.detectedPose === TwoHandPose.FIST_HAND, `Expected FIST_HAND, got ${p2.detectedPose}`);

    // HAND_HAND (Exact 5+5)
    const openRight = detectFingerStates(createSyntheticHand([true, true, true, true, true]), 'RIGHT', 0.7, 0.5);
    const p3 = classifyTwoHandPose(openHand, openRight);
    assert(p3.detectedPose === TwoHandPose.HAND_HAND, `Expected HAND_HAND, got ${p3.detectedPose}`);

    // FIST_FIST (Safety Rest)
    const fistLeft = detectFingerStates(createSyntheticHand([false, false, false, false, false]), 'LEFT', 0.3, 0.5);
    const p4 = classifyTwoHandPose(fistLeft, fistHand);
    assert(p4.detectedPose === TwoHandPose.FIST_FIST, `Expected FIST_FIST, got ${p4.detectedPose}`);

    // Matching Counts: 2+2
    const twoLeft = detectFingerStates(createSyntheticHand([false, true, true, false, false]), 'LEFT', 0.3, 0.5);
    const twoRight = detectFingerStates(createSyntheticHand([false, true, true, false, false]), 'RIGHT', 0.7, 0.5);
    const p5 = classifyTwoHandPose(twoLeft, twoRight);
    assert(p5.detectedPose === TwoHandPose.MATCHING_COUNTS, `Expected MATCHING_COUNTS, got ${p5.detectedPose}`);
    assert(p5.matchingCountValue === 2, `Expected count value 2, got ${p5.matchingCountValue}`);

    // Mismatched Counts: 1+2 -> BACKGROUND
    const oneLeft = detectFingerStates(createSyntheticHand([false, true, false, false, false]), 'LEFT', 0.3, 0.5);
    const p6 = classifyTwoHandPose(oneLeft, twoRight);
    assert(p6.detectedPose === TwoHandPose.BACKGROUND, `Mismatched 1+2 should be BACKGROUND, got ${p6.detectedPose}`);

    console.log('✓ Test 3: Pose classification & priority hierarchy passed.');
  }

  // Test 4: State Machine - Mode Switching & Anti-Repeat Lock
  {
    const sm = new GestureStateMachine();
    assert(sm.currentMode === OperationMode.SLICE_NAV, 'Default mode must be SLICE_NAVIGATION');

    const twoLeft = detectFingerStates(createSyntheticHand([false, true, true, false, false]), 'LEFT', 0.3, 0.5);
    const twoRight = detectFingerStates(createSyntheticHand([false, true, true, false, false]), 'RIGHT', 0.7, 0.5);

    // Frame 1: Initial hold starts (t = 1.0s)
    let act = sm.update(twoLeft, twoRight, 1.0);
    assert(act === null, 'Should not switch immediately on frame 1');
    assert(sm.interactionState === InteractionState.MODE_SELECTION, 'Should be in MODE_SELECTION state');

    // Frame 2: Hold halfway (t = 1.3s, 0.3s elapsed)
    act = sm.update(twoLeft, twoRight, 1.3);
    assert(act === null, 'Should still be confirming at 0.3s');

    // Frame 3: Hold completes (t = 1.65s, 0.65s elapsed > 0.60s hold time)
    act = sm.update(twoLeft, twoRight, 1.65);
    assert(act !== null && act.type === 'MODE_CHANGED' && act.value === OperationMode.ZOOM, 'Should confirm ZOOM mode at 0.6s');
    assert(sm.currentMode === OperationMode.ZOOM, 'Current mode must now be ZOOM');

    // Frame 4: Continued hold (Anti-repeat lock check at t = 2.0s)
    act = sm.update(twoLeft, twoRight, 2.0);
    assert(act === null, 'Anti-repeat lock must prevent multiple mode switches while held');

    // Frame 5: Release to neutral (t = 2.5s)
    const neutralLeft = detectFingerStates(createSyntheticHand([false, false, false, false, false]), 'LEFT', 0.3, 0.5);
    act = sm.update(neutralLeft, twoRight, 2.5); // Mismatched 0+2 = BACKGROUND
    assert(sm.interactionState === InteractionState.NEUTRAL, 'Should enter NEUTRAL state on release');

    console.log('✓ Test 4: Mode selection hold and anti-repeat lock passed.');
  }

  // Test 5: Panning Mode Directional Step Navigation
  {
    const sm = new GestureStateMachine();
    sm.setMode(OperationMode.PANNING);

    // 1+1: Pan Left
    const oneLeft = detectFingerStates(createSyntheticHand([false, true, false, false, false]), 'LEFT', 0.3, 0.5);
    const oneRight = detectFingerStates(createSyntheticHand([false, true, false, false, false]), 'RIGHT', 0.7, 0.5);

    // Initial detection (t = 1.0s)
    let act = sm.update(oneLeft, oneRight, 1.0);
    assert(act === null, 'Should detect candidate first');

    // Stability confirmed (> 0.18s hold time: t = 1.25s)
    act = sm.update(oneLeft, oneRight, 1.25);
    assert(Boolean(act && act.type === 'PAN'), 'Should trigger PAN action');
    assert(Boolean(act && act.value.dx === -25.0 && act.value.dy === 0), `Expected dx=-25, got ${JSON.stringify(act?.value)}`);

    // Held cadence delay (t = 1.35s, only 0.10s elapsed < 0.28s)
    act = sm.update(oneLeft, oneRight, 1.35);
    assert(act === null, 'Should wait for step delay cadence');

    // Next step repeats at t = 1.55s (> 0.28s elapsed)
    act = sm.update(oneLeft, oneRight, 1.55);
    assert(Boolean(act && act.type === 'PAN' && act.value.dx === -25.0), 'Should repeat pan step');

    console.log('✓ Test 5: Step-based directional panning passed.');
  }

  // Test 6: Directional Actions & Immediate Stop on Hand Loss
  {
    const sm = new GestureStateMachine();
    sm.setMode(OperationMode.SLICE_NAV);

    const openHand = detectFingerStates(createSyntheticHand([true, true, true, true, true]), 'LEFT', 0.3, 0.5);
    const fistHand = detectFingerStates(createSyntheticHand([false, false, false, false, false]), 'RIGHT', 0.7, 0.5);

    // HAND + FIST in SLICE_NAV = SLICE_PREV
    let act = sm.update(openHand, fistHand, 1.0);
    assert(act !== null && act.type === 'SLICE_PREV', `Expected SLICE_PREV, got ${act?.type}`);

    // Tracking loss occurs
    const stopAct = sm.handleTrackingLoss();
    assert(stopAct !== null && stopAct.type === 'ACTION_STOP', 'Tracking loss must dispatch ACTION_STOP immediately');
    assert(sm.interactionState === InteractionState.NEUTRAL, 'Interaction state must reset to NEUTRAL');

    console.log('✓ Test 6: Directional actions and immediate stop on tracking loss passed.');
  }

  console.log('======================================================');
  console.log('ALL 6 TYPESCRIPT GESTURE ENGINE TEST SUITES PASSED! ✓');
  console.log('======================================================');
}

runTests();
