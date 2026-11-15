/**
 * 0Touch Gesture Engine - MediaPipe Tasks Vision Hand Tracker Wrapper
 * Initializes the HandLandmarker model using @mediapipe/tasks-vision,
 * manages the video stream, mirrors horizontally (for natural user interaction),
 * sorts hands by horizontal screen coordinate (Left vs Right), and returns raw landmark structures.
 */

import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { TrackedHandRaw, ScreenSide } from './types';

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private isReady = false;

  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.70,
        minHandPresenceConfidence: 0.70,
        minTrackingConfidence: 0.70,
      });

      this.isReady = true;
    } finally {
      this.isInitializing = false;
    }
  }

  public ready(): boolean {
    return this.isReady && this.handLandmarker !== null;
  }

  /**
   * Processes a video element frame for hand tracking.
   * Mirrors x coordinate (1 - x) to ensure natural mirror interaction:
   * The user's physical left hand appears on screen LEFT (x < 0.5).
   * The user's physical right hand appears on screen RIGHT (x > 0.5).
   */
  public detectVideo(video: HTMLVideoElement, timestampMs: number): TrackedHandRaw[] {
    if (!this.handLandmarker || !this.isReady) {
      return [];
    }

    let result: HandLandmarkerResult;
    try {
      result = this.handLandmarker.detectForVideo(video, timestampMs);
    } catch (e) {
      console.error('Error in HandLandmarker.detectForVideo:', e);
      return [];
    }

    if (!result.landmarks || result.landmarks.length === 0) {
      return [];
    }

    const trackedHands: TrackedHandRaw[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const rawLms = result.landmarks[i];

      // Mirror horizontally: x = 1 - lm.x so that camera mirror view aligns
      const lms = rawLms.map((lm) => ({
        x: 1.0 - lm.x,
        y: lm.y,
        z: lm.z,
      }));

      // Centroid
      const sumX = lms.reduce((acc, pt) => acc + pt.x, 0);
      const sumY = lms.reduce((acc, pt) => acc + pt.y, 0);
      const cx = sumX / lms.length;
      const cy = sumY / lms.length;

      trackedHands.push({
        landmarks: lms,
        centroidX: cx,
        centroidY: cy,
      });
    }

    // Sort hands left-to-right based on screen X
    trackedHands.sort((a, b) => a.centroidX - b.centroidX);

    if (trackedHands.length === 1) {
      const side: ScreenSide = trackedHands[0].centroidX < 0.5 ? 'LEFT' : 'RIGHT';
      trackedHands[0].screenSide = side;
    } else if (trackedHands.length >= 2) {
      trackedHands[0].screenSide = 'LEFT';
      trackedHands[1].screenSide = 'RIGHT';
      return trackedHands.slice(0, 2);
    }

    return trackedHands;
  }

  public close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    this.isReady = false;
  }
}
