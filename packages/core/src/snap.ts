import type { Vec } from './geometry.js';

/**
 * Drawing assists (D-024). Snapping is per-tool: beds snap hard, obstructions
 * barely need to, and drifts deliberately do not snap at all.
 */

export interface SnapSettings {
  readonly enabled: boolean;
  /** 0 disables grid snapping. 152.4 = 6″, 304.8 = 1′. */
  readonly gridMm: number;
  /** 0 disables angle snapping. 15 makes an L-bed come out square. */
  readonly angleDeg: number;
}

export const SNAP_OFF: SnapSettings = { enabled: false, gridMm: 0, angleDeg: 0 };
export const SNAP_DEFAULT: SnapSettings = { enabled: true, gridMm: 152.4, angleDeg: 15 };
/** Drifts are blobs by nature; a grid would imply precision that isn't real. */
export const SNAP_DRIFT = SNAP_OFF;

/**
 * Angle first, then length along the resulting ray.
 *
 * Doing it the other way — snapping x and y independently to the grid — gives
 * clean coordinates and crooked edges, which is exactly backwards: the gardener
 * cares that the bed is square and 8 feet long, not that its corner sits on a
 * round number.
 */
export function snapPoint(point: Vec, from: Vec | null, snap: SnapSettings): Vec {
  if (!snap.enabled) return point;

  if (from !== null && snap.angleDeg > 0) {
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const step = (snap.angleDeg * Math.PI) / 180;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    let length = Math.hypot(dx, dy);
    if (snap.gridMm > 0) length = Math.round(length / snap.gridMm) * snap.gridMm;
    return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
  }

  if (snap.gridMm > 0) {
    return {
      x: Math.round(point.x / snap.gridMm) * snap.gridMm,
      y: Math.round(point.y / snap.gridMm) * snap.gridMm,
    };
  }
  return point;
}

/** Snap a delta, so moving a bed keeps whatever alignment it already had. */
export function snapDelta(dx: number, dy: number, snap: SnapSettings): Vec {
  if (!snap.enabled || snap.gridMm <= 0) return { x: dx, y: dy };
  return {
    x: Math.round(dx / snap.gridMm) * snap.gridMm,
    y: Math.round(dy / snap.gridMm) * snap.gridMm,
  };
}

/**
 * Snap the resulting *dimension*, not the handle position (D-026). A corner
 * landing on a grid intersection does not give a bed that reads 4′ 0″ when the
 * anchor corner is off-grid.
 */
export function snapDimension(length: number, snap: SnapSettings, minimumMm = 100): number {
  const snapped =
    snap.enabled && snap.gridMm > 0 ? Math.round(length / snap.gridMm) * snap.gridMm : length;
  return Math.max(snapped, minimumMm);
}

export function snapAngle(degrees: number, snap: SnapSettings): number {
  if (!snap.enabled || snap.angleDeg <= 0) return degrees;
  return Math.round(degrees / snap.angleDeg) * snap.angleDeg;
}
