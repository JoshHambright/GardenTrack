/**
 * Plane geometry in millimetres. Pure, no I/O.
 *
 * The load-bearing idea (D-019): a bed is an outline, and the planting grid is
 * a regular lattice clipped against it. Shape reaches the rest of the app only
 * as a per-cell `coverage` fraction, so spacing, capacity and yield maths never
 * learn that beds can be L-shaped.
 */

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export type Polygon = readonly Vec[];

export function polygonArea(points: Polygon): number {
  if (points.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Vec;
    const b = points[(i + 1) % points.length] as Vec;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

export function boundingBox(points: Polygon): Box {
  if (points.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  const first = points[0] as Vec;
  let x0 = first.x;
  let y0 = first.y;
  let x1 = first.x;
  let y1 = first.y;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function centroid(points: Polygon): Vec {
  const b = boundingBox(points);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

export function rotate(point: Vec, about: Vec, degrees: number): Vec {
  const r = (degrees * Math.PI) / 180;
  const sin = Math.sin(r);
  const cos = Math.cos(r);
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos };
}

export function pointInPolygon(point: Vec, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i] as Vec;
    const b = polygon[j] as Vec;
    const straddles = a.y > point.y !== b.y > point.y;
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

type Keep = (v: Vec) => boolean;
type Cut = (a: Vec, b: Vec) => Vec;

function clipHalfPlane(polygon: Polygon, keep: Keep, cut: Cut): Vec[] {
  if (polygon.length === 0) return [];
  const out: Vec[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i] as Vec;
    const previous = polygon[(i + polygon.length - 1) % polygon.length] as Vec;
    const currentIn = keep(current);
    const previousIn = keep(previous);
    if (currentIn) {
      if (!previousIn) out.push(cut(previous, current));
      out.push(current);
    } else if (previousIn) {
      out.push(cut(previous, current));
    }
  }
  return out;
}

/** Sutherland–Hodgman clip of a polygon against an axis-aligned rectangle. */
export function clipToRect(polygon: Polygon, box: Box): Vec[] {
  const atX = (x: number): Cut => (a, b) => ({
    x,
    y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x),
  });
  const atY = (y: number): Cut => (a, b) => ({
    x: a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y),
    y,
  });
  let clipped: Vec[] = [...polygon];
  clipped = clipHalfPlane(clipped, (v) => v.x >= box.x0, atX(box.x0));
  clipped = clipHalfPlane(clipped, (v) => v.x <= box.x1, atX(box.x1));
  clipped = clipHalfPlane(clipped, (v) => v.y >= box.y0, atY(box.y0));
  clipped = clipHalfPlane(clipped, (v) => v.y <= box.y1, atY(box.y1));
  return clipped;
}

export interface GridCell {
  readonly col: number;
  readonly row: number;
  readonly box: Box;
  /** 0–1. A rectangle on-grid is 1 everywhere; shape arrives only as this. */
  readonly coverage: number;
}

/** Cells below this are unusable; above `COVERAGE_FULL` they count whole. */
export const COVERAGE_MIN = 0.3;
export const COVERAGE_FULL = 0.85;

export interface GridOptions {
  readonly cellMm: number;
  readonly holes?: readonly Polygon[] | undefined;
  /** Grid angle, independent of the bed's own — rows face the sun (D-019). */
  readonly rotationDeg?: number | undefined;
}

/**
 * Lay a lattice over the outline's bounding box and clip each cell to it.
 * The grid stays regular; only `coverage` varies.
 */
export function gridCells(outline: Polygon, options: GridOptions): GridCell[] {
  const { cellMm } = options;
  if (cellMm <= 0) throw new RangeError(`cellMm must be positive: ${cellMm}`);
  if (outline.length < 3) return [];

  const rotationDeg = options.rotationDeg ?? 0;
  const pivot = centroid(outline);
  const toGrid = (p: Vec): Vec => (rotationDeg === 0 ? p : rotate(p, pivot, -rotationDeg));
  const local = outline.map(toGrid);
  const holes = (options.holes ?? []).map((hole) => hole.map(toGrid));

  const bounds = boundingBox(local);
  const originX = Math.floor(bounds.x0 / cellMm) * cellMm;
  const originY = Math.floor(bounds.y0 / cellMm) * cellMm;
  const cols = Math.ceil((bounds.x1 - originX) / cellMm);
  const rows = Math.ceil((bounds.y1 - originY) / cellMm);
  const cellArea = cellMm * cellMm;

  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const box: Box = {
        x0: originX + col * cellMm,
        y0: originY + row * cellMm,
        x1: originX + (col + 1) * cellMm,
        y1: originY + (row + 1) * cellMm,
      };
      let area = polygonArea(clipToRect(local, box));
      if (area <= 0) continue;
      for (const hole of holes) area -= polygonArea(clipToRect(hole, box));
      const coverage = Math.min(1, Math.max(0, area / cellArea));
      if (coverage < 0.02) continue;
      cells.push({ col, row, box, coverage });
    }
  }
  return cells;
}

/**
 * Plantable capacity in whole cells. Partial cells count pro-rata; cells below
 * COVERAGE_MIN count for nothing.
 */
export function effectiveCapacity(cells: readonly GridCell[]): number {
  let total = 0;
  for (const cell of cells) {
    if (cell.coverage >= COVERAGE_FULL) total += 1;
    else if (cell.coverage >= COVERAGE_MIN) total += cell.coverage;
  }
  return total;
}

/** Ramer–Douglas–Peucker. Turns a freehand stroke into a few honest points. */
export function simplify(points: Polygon, epsilonMm: number): Vec[] {
  if (points.length < 3) return [...points];
  const first = points[0] as Vec;
  const last = points[points.length - 1] as Vec;
  const span = Math.hypot(last.x - first.x, last.y - first.y);

  let worstIndex = 0;
  let worstDistance = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i] as Vec;
    const distance =
      span === 0
        ? Math.hypot(p.x - first.x, p.y - first.y)
        : Math.abs(
            (last.y - first.y) * p.x -
              (last.x - first.x) * p.y +
              last.x * first.y -
              last.y * first.x,
          ) / span;
    if (distance > worstDistance) {
      worstDistance = distance;
      worstIndex = i;
    }
  }

  if (worstDistance <= epsilonMm) return [first, last];
  const head = simplify(points.slice(0, worstIndex + 1), epsilonMm);
  const tail = simplify(points.slice(worstIndex), epsilonMm);
  return [...head.slice(0, -1), ...tail];
}
