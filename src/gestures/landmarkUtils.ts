/**
 * 0Touch Gesture Engine - Landmark Utilities
 * Vector math, Euclidean distances, and invariant palm scale matching core/landmarks.py
 */

import { Point3D } from './types';

// MediaPipe 21 Landmark Identifiers
export const LANDMARK_IDS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export function dist2D(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist3D(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculates hand scale invariant to camera distance.
 * Exactly matches LandmarkProcessor.get_palm_scale in Python:
 * scale = max(dist(wrist, mid_mcp), dist(idx_mcp, pinky_mcp) * 1.1)
 * return max(scale, 0.03)
 */
export function getPalmScale(landmarks: Point3D[]): number {
  const wrist = landmarks[LANDMARK_IDS.WRIST];
  const midMcp = landmarks[LANDMARK_IDS.MIDDLE_MCP];
  const idxMcp = landmarks[LANDMARK_IDS.INDEX_MCP];
  const pinkyMcp = landmarks[LANDMARK_IDS.PINKY_MCP];

  const dWristMid = dist2D(wrist, midMcp);
  const dMcpSpan = dist2D(idxMcp, pinkyMcp);

  const scale = Math.max(dWristMid, dMcpSpan * 1.1);
  return Math.max(scale, 0.03);
}

/**
 * Calculates centroid of a set of 21 landmarks.
 */
export function getLandmarkCentroid(landmarks: Point3D[]): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < landmarks.length; i++) {
    sumX += landmarks[i].x;
    sumY += landmarks[i].y;
  }
  return {
    x: sumX / landmarks.length,
    y: sumY / landmarks.length,
  };
}
