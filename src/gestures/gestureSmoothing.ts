/**
 * 0Touch Gesture Engine - 1€ Filter Implementation
 * Casiez et al., CHI 2012.
 * Adaptive low-pass filter for noisy human tracking input:
 * Low latency during fast motion, high jitter reduction at rest.
 * Matches LandmarkProcessor in Python.
 */

import { Point3D, FilterConfig } from './types';

export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number;
  private dxPrev: number;
  private tPrev: number;

  constructor(t0: number, x0: number, minCutoff = 1.2, beta = 0.5, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = x0;
    this.dxPrev = 0.0;
    this.tPrev = t0;
  }

  private smoothingFactor(dt: number, cutoff: number): number {
    const r = 2.0 * Math.PI * cutoff * dt;
    return r / (r + 1.0);
  }

  public filter(t: number, x: number): number {
    const dt = Math.max(t - this.tPrev, 1e-4);
    this.tPrev = t;

    // Estimate derivative
    const dx = (x - this.xPrev) / dt;
    const alphaD = this.smoothingFactor(dt, this.dCutoff);
    this.dxPrev = alphaD * dx + (1.0 - alphaD) * this.dxPrev;

    // Dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    const alpha = this.smoothingFactor(dt, cutoff);

    this.xPrev = alpha * x + (1.0 - alpha) * this.xPrev;
    return this.xPrev;
  }
}

export class OneEuroFilter3D {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;
  private fz: OneEuroFilter1D;

  constructor(t0: number, p0: Point3D, config: FilterConfig) {
    this.fx = new OneEuroFilter1D(t0, p0.x, config.minCutoff, config.beta, config.dCutoff);
    this.fy = new OneEuroFilter1D(t0, p0.y, config.minCutoff, config.beta, config.dCutoff);
    this.fz = new OneEuroFilter1D(t0, p0.z, config.minCutoff, config.beta, config.dCutoff);
  }

  public filter(t: number, p: Point3D): Point3D {
    return {
      x: this.fx.filter(t, p.x),
      y: this.fy.filter(t, p.y),
      z: this.fz.filter(t, p.z),
    };
  }
}

export class LandmarkSmoother {
  private filtersMap: Map<number, OneEuroFilter3D[]> = new Map();
  private config: FilterConfig;

  constructor(config: FilterConfig = { minCutoff: 1.2, beta: 0.5, dCutoff: 1.0 }) {
    this.config = config;
  }

  public reset(handIdx?: number): void {
    if (handIdx === undefined) {
      this.filtersMap.clear();
    } else {
      this.filtersMap.delete(handIdx);
    }
  }

  public smoothLandmarks(landmarks: Point3D[], timestamp: number, handIdx = 0): Point3D[] {
    let filters = this.filtersMap.get(handIdx);
    if (!filters || filters.length !== landmarks.length) {
      filters = landmarks.map((p) => new OneEuroFilter3D(timestamp, p, this.config));
      this.filtersMap.set(handIdx, filters);
      return landmarks.map((p) => ({ ...p }));
    }

    return landmarks.map((p, i) => filters![i].filter(timestamp, p));
  }
}
