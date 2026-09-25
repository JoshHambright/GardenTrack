import type { Polygon, Vec } from './geometry.js';

/**
 * Closed Catmull–Rom sampling (P1-04). A curved bed is stored as a handful of
 * control points; everything downstream — clipping, hit-testing, area — works on
 * polygons, so the spline is sampled rather than special-cased.
 */

export interface Ring {
  readonly points: Polygon;
  /** True for a freehand or island bed; false for straight-edged. */
  readonly curved: boolean;
}

export const DEFAULT_SPLINE_STEPS = 8;

export function samplePolygon(ring: Ring, steps = DEFAULT_SPLINE_STEPS): Polygon {
  if (!ring.curved || ring.points.length < 3) return ring.points;
  const p = ring.points;
  const out: Vec[] = [];
  for (let i = 0; i < p.length; i += 1) {
    const p0 = p[(i - 1 + p.length) % p.length] as Vec;
    const p1 = p[i] as Vec;
    const p2 = p[(i + 1) % p.length] as Vec;
    const p3 = p[(i + 2) % p.length] as Vec;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return out;
}

function catmullRom(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) };
}

/** SVG path data for a ring, straight or splined. Rendering only. */
export function ringPath(ring: Ring): string {
  const p = ring.points;
  if (p.length === 0) return '';
  if (!ring.curved || p.length < 3) {
    return `M ${p.map((v) => `${v.x} ${v.y}`).join(' L ')} Z`;
  }
  const first = p[0] as Vec;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < p.length; i += 1) {
    const p0 = p[(i - 1 + p.length) % p.length] as Vec;
    const p1 = p[i] as Vec;
    const p2 = p[(i + 1) % p.length] as Vec;
    const p3 = p[(i + 2) % p.length] as Vec;
    d +=
      ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6},` +
      ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6},` +
      ` ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}
