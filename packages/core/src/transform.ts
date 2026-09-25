import { boundingBox, rotate, type Box, type Polygon, type Vec } from './geometry.js';
import { classifyOutline, isRectangular } from './shapes.js';
import { snapAngle, snapDelta, snapDimension, type SnapSettings } from './snap.js';
import type { Ring } from './spline.js';
import { samplePolygon } from './spline.js';

/**
 * Move, scale and reshape (D-026). Three operations, chosen by what the
 * gardener grabs rather than by a mode picked beforehand.
 *
 * Every function here takes the *original* points and returns new ones, so a
 * drag re-applies from the start and never compounds rounding.
 */

export type ScaleHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Eight targets round a small bed overlap on a thumb; fall back to corners. */
export const scaleHandles = {
  corners: ['nw', 'ne', 'se', 'sw'] as const,
  all: ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const,
};

export const move = (points: Polygon, dx: number, dy: number): Vec[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

export function moveSnapped(points: Polygon, dx: number, dy: number, snap: SnapSettings): Vec[] {
  const d = snapDelta(dx, dy, snap);
  return move(points, d.x, d.y);
}

export const rotateAbout = (points: Polygon, about: Vec, degrees: number): Vec[] =>
  points.map((p) => rotate(p, about, degrees));

export function rotateSnapped(
  points: Polygon,
  about: Vec,
  degrees: number,
  snap: SnapSettings,
): Vec[] {
  return rotateAbout(points, about, snapAngle(degrees, snap));
}

export interface ScaleResult {
  readonly points: Vec[];
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Scale from a handle, anchored at the opposite corner or edge.
 *
 * The snap applies to the resulting *dimension*, not to the pointer — you want
 * a bed that reads 4′ 0″, which is not the same as a corner landing on a grid
 * intersection when the anchor is off-grid.
 */
export function scaleFromHandle(
  points: Polygon,
  original: Box,
  handle: ScaleHandle,
  pointer: Vec,
  snap: SnapSettings,
  minimumMm = 100,
): ScaleResult {
  const width0 = Math.max(original.x1 - original.x0, 1);
  const height0 = Math.max(original.y1 - original.y0, 1);

  let scaleX = 1;
  let scaleY = 1;
  let anchorX = original.x0;
  let anchorY = original.y0;

  if (handle.includes('e') || handle.includes('w')) {
    const east = handle.includes('e');
    anchorX = east ? original.x0 : original.x1;
    const raw = east ? pointer.x - original.x0 : original.x1 - pointer.x;
    scaleX = snapDimension(raw, snap, minimumMm) / width0;
  }
  if (handle.includes('n') || handle.includes('s')) {
    const south = handle.includes('s');
    anchorY = south ? original.y0 : original.y1;
    const raw = south ? pointer.y - original.y0 : original.y1 - pointer.y;
    scaleY = snapDimension(raw, snap, minimumMm) / height0;
  }

  return {
    points: points.map((p) => ({
      x: anchorX + (p.x - anchorX) * scaleX,
      y: anchorY + (p.y - anchorY) * scaleY,
    })),
    widthMm: width0 * scaleX,
    heightMm: height0 * scaleY,
  };
}

/** Set one overall dimension exactly, anchored at the outline's top-left. */
export function setDimension(points: Polygon, axis: 'w' | 'h', targetMm: number): Vec[] {
  const box = boundingBox(points);
  const width = Math.max(box.x1 - box.x0, 1);
  const height = Math.max(box.y1 - box.y0, 1);
  const scaleX = axis === 'w' ? targetMm / width : 1;
  const scaleY = axis === 'h' ? targetMm / height : 1;
  return points.map((p) => ({
    x: box.x0 + (p.x - box.x0) * scaleX,
    y: box.y0 + (p.y - box.y0) * scaleY,
  }));
}

/**
 * Set the length of one edge (P1-10).
 *
 * For a rectangle — including a rounded one, which is why classification is a
 * derivation rather than a corner count (P1-18) — the whole axis scales, so the
 * bed stays a rectangle. For anything else, only the far vertex moves, because
 * guessing which other vertices "should" follow is how an editor starts fighting
 * the person using it.
 */
export function setEdgeLength(ring: Ring, edgeIndex: number, targetMm: number): Ring {
  const points = ring.points;
  if (points.length < 2 || targetMm <= 0) return ring;

  const i = edgeIndex % points.length;
  const j = (i + 1) % points.length;
  const a = points[i] as Vec;
  const b = points[j] as Vec;
  const current = Math.hypot(b.x - a.x, b.y - a.y);
  if (current === 0) return ring;

  if (isRectangular(classifyOutline(ring))) {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    return { ...ring, points: setDimension(points, horizontal ? 'w' : 'h', targetMm) };
  }

  const ux = (b.x - a.x) / current;
  const uy = (b.y - a.y) / current;
  const delta = targetMm - current;
  const next = [...points];
  next[j] = { x: b.x + ux * delta, y: b.y + uy * delta };
  return { ...ring, points: next };
}

/** Move a single vertex — reshape mode. */
export function setVertex(ring: Ring, index: number, position: Vec): Ring {
  if (index < 0 || index >= ring.points.length) return ring;
  const next = [...ring.points];
  next[index] = position;
  return { ...ring, points: next };
}

export const outlineBox = (ring: Ring): Box => boundingBox(samplePolygon(ring));
