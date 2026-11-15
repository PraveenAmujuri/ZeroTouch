/**
 * 0Touch Gesture Engine - Finger Detection & Anatomical Posture Classification
 * Exact reproduction of LandmarkProcessor.get_finger_states from core/landmarks.py
 */

import { Point3D, FingerStates, PostureType, ScreenSide } from './types';
import { LANDMARK_IDS, dist2D, getPalmScale } from './landmarkUtils';

export function detectFingerStates(
  landmarks: Point3D[],
  screenSide: ScreenSide,
  centroidX: number,
  centroidY: number
): FingerStates {
  const wrist = landmarks[LANDMARK_IDS.WRIST];
  const palmScale = getPalmScale(landmarks);

  const fingerIndices = [
    { name: 'index', mcp: LANDMARK_IDS.INDEX_MCP, pip: LANDMARK_IDS.INDEX_PIP, tip: LANDMARK_IDS.INDEX_TIP },
    { name: 'middle', mcp: LANDMARK_IDS.MIDDLE_MCP, pip: LANDMARK_IDS.MIDDLE_PIP, tip: LANDMARK_IDS.MIDDLE_TIP },
    { name: 'ring', mcp: LANDMARK_IDS.RING_MCP, pip: LANDMARK_IDS.RING_PIP, tip: LANDMARK_IDS.RING_TIP },
    { name: 'pinky', mcp: LANDMARK_IDS.PINKY_MCP, pip: LANDMARK_IDS.PINKY_PIP, tip: LANDMARK_IDS.PINKY_TIP },
  ] as const;

  const fourFingers = {
    index: false,
    middle: false,
    ring: false,
    pinky: false,
  };

  for (const f of fingerIndices) {
    const tip = landmarks[f.tip];
    const pip = landmarks[f.pip];
    const mcp = landmarks[f.mcp];

    const dWristTip = dist2D(tip, wrist);
    const dWristPip = dist2D(pip, wrist);
    const dMcpTip = dist2D(tip, mcp);
    const dMcpPip = dist2D(pip, mcp);

    // Python condition:
    // (d_wrist_tip > d_wrist_pip + 0.08 * palm_scale) and (d_mcp_tip > d_mcp_pip * 1.15)
    const isExtended = dWristTip > dWristPip + 0.08 * palmScale && dMcpTip > dMcpPip * 1.15;
    fourFingers[f.name] = isExtended;
  }

  // Thumb evaluation:
  const thumbTip = landmarks[LANDMARK_IDS.THUMB_TIP];
  const thumbIp = landmarks[LANDMARK_IDS.THUMB_IP];
  const pinkyMcp = landmarks[LANDMARK_IDS.PINKY_MCP];
  const indexMcp = landmarks[LANDMARK_IDS.INDEX_MCP];

  const dThumbPinky = dist2D(thumbTip, pinkyMcp);
  const dThumbIpPinky = dist2D(thumbIp, pinkyMcp);
  const dThumbIdxMcp = dist2D(thumbTip, indexMcp);

  // Python condition:
  // (d_thumb_pinky > d_thumb_ip_pinky + 0.08 * palm_scale) and (d_thumb_idx_mcp > 0.40 * palm_scale)
  const thumbExtended = dThumbPinky > dThumbIpPinky + 0.08 * palmScale && dThumbIdxMcp > 0.4 * palmScale;

  const statesList: [boolean, boolean, boolean, boolean, boolean] = [
    thumbExtended,
    fourFingers.index,
    fourFingers.middle,
    fourFingers.ring,
    fourFingers.pinky,
  ];

  const extendedCount = statesList.filter(Boolean).length;
  const mainFourCount = [fourFingers.index, fourFingers.middle, fourFingers.ring, fourFingers.pinky].filter(Boolean).length;

  // Posture Classification (Bockhacker et al.):
  // HAND = Open hand with all or most fingers outstretched (at least 3 main fingers or 4 total)
  // FIST = Closed fist (0 main fingers extended and at most 1 thumb touch)
  let posture: PostureType = 'NEUTRAL';
  if (mainFourCount >= 3 || extendedCount >= 4) {
    posture = 'HAND';
  } else if (mainFourCount === 0 && extendedCount <= 1) {
    posture = 'FIST';
  } else {
    posture = 'NEUTRAL';
  }

  const palmCenter = {
    x: (wrist.x + indexMcp.x + pinkyMcp.x) / 3,
    y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
  };

  return {
    thumb: thumbExtended,
    index: fourFingers.index,
    middle: fourFingers.middle,
    ring: fourFingers.ring,
    pinky: fourFingers.pinky,
    states: statesList,
    extendedCount,
    mainFourCount,
    posture,
    palmScale,
    wrist: { x: wrist.x, y: wrist.y },
    palmCenter,
    centroidX,
    centroidY,
    screenSide,
  };
}
