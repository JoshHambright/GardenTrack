import { boundingBox, polygonArea, simplify, type Polygon, type Vec } from './geometry.js';
import type { Ring } from './spline.js';
import { feet } from './units.js';

/**
 * Bed templates and outline classification (P1-11, P1-18).
 *
 * Templates matter because most raised beds are standard sizes, and starting
 * from a shape beats starting from a blank canvas (D-024). Classification
 * matters because the edge-length edit behaves differently for a rectangle —
 * and because the real beds this is built for are corrugated metal with
 * radiused corners, which a sharp-corner test does not recognise.
 */

export type TemplateId =
  | 'rect4x8'
  | 'rect4x4'
  | 'rect2x8'
  | 'vego8x4'
  | 'lShape'
  | 'keyhole'
  | 'bag5'
  | 'bag10'
  | 'bag15'
  | 'bag20';

export type TemplateGroup = 'bed' | 'container';

export interface Template {
  readonly id: TemplateId;
  readonly label: string;
  readonly note: string;
  readonly group: TemplateGroup;
  build(origin: Vec): Ring;
}

/** A circle, for a grow bag or a pot. */
export function circlePoints(centre: Vec, radiusMm: number, steps = 16): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    points.push({ x: centre.x + Math.cos(a) * radiusMm, y: centre.y + Math.sin(a) * radiusMm });
  }
  return points;
}

/**
 * Fabric grow bag diameters, which are what the footprint actually is. Nominal
 * gallons describe volume, not width, and the two are only loosely related.
 */
const BAG_DIAMETER_INCHES: Readonly<Record<'bag5' | 'bag10' | 'bag15' | 'bag20', number>> = {
  bag5: 12,
  bag10: 16,
  bag15: 18,
  bag20: 20,
};

function bagTemplate(id: 'bag5' | 'bag10' | 'bag15' | 'bag20', gallons: number): Template {
  const diameter = BAG_DIAMETER_INCHES[id] * 25.4;
  return {
    id,
    label: `${gallons} gal bag`,
    note: `${BAG_DIAMETER_INCHES[id]}″ across.`,
    group: 'container',
    build: (o) => ({
      points: circlePoints({ x: o.x + diameter / 2, y: o.y + diameter / 2 }, diameter / 2),
      curved: false,
    }),
  };
}

const rectPoints = (o: Vec, w: number, h: number): Vec[] => [
  { x: o.x, y: o.y },
  { x: o.x + w, y: o.y },
  { x: o.x + w, y: o.y + h },
  { x: o.x, y: o.y + h },
];

/** A corrugated metal bed: straight runs joined by quarter-circle corners. */
export function roundedRectPoints(
  o: Vec,
  w: number,
  h: number,
  radiusMm: number,
  perCorner = 6,
): Vec[] {
  const r = Math.min(radiusMm, Math.min(w, h) / 2);
  if (r <= 0) return rectPoints(o, w, h);
  const corners: ReadonlyArray<readonly [Vec, number]> = [
    [{ x: o.x + w - r, y: o.y + r }, -Math.PI / 2],
    [{ x: o.x + w - r, y: o.y + h - r }, 0],
    [{ x: o.x + r, y: o.y + h - r }, Math.PI / 2],
    [{ x: o.x + r, y: o.y + r }, Math.PI],
  ];
  const points: Vec[] = [];
  for (const [centre, start] of corners) {
    for (let i = 0; i <= perCorner; i += 1) {
      const a = start + (i / perCorner) * (Math.PI / 2);
      points.push({ x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r });
    }
  }
  return points;
}

/**
 * Every template honours one contract: the outline's bounding box starts at the
 * origin the gardener tapped. Shapes with a notch — the keyhole — don't reach
 * their nominal box by construction, so normalise rather than trusting the
 * trigonometry of each one.
 */
function atOrigin(build: (origin: Vec) => Ring): (origin: Vec) => Ring {
  return (origin) => {
    const ring = build(origin);
    const box = boundingBox(ring.points);
    const dx = origin.x - box.x0;
    const dy = origin.y - box.y0;
    if (dx === 0 && dy === 0) return ring;
    return { ...ring, points: ring.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  };
}

const rawTemplates: readonly Template[] = [
  {
    id: 'rect4x8',
    group: 'bed',
    label: "4′ × 8′",
    note: 'The default raised bed.',
    build: (o) => ({ points: rectPoints(o, feet(4), feet(8)), curved: false }),
  },
  {
    id: 'rect4x4',
    group: 'bed',
    label: "4′ × 4′",
    note: 'Square-foot gardening classic.',
    build: (o) => ({ points: rectPoints(o, feet(4), feet(4)), curved: false }),
  },
  {
    id: 'rect2x8',
    group: 'bed',
    label: "2′ × 8′",
    note: 'A narrow strip along a fence or wall.',
    build: (o) => ({ points: rectPoints(o, feet(2), feet(8)), curved: false }),
  },
  {
    id: 'vego8x4',
    group: 'bed',
    label: "8′ × 4′ rounded",
    note: 'Corrugated metal bed with radiused corners.',
    build: (o) => ({ points: roundedRectPoints(o, feet(8), feet(4), feet(0.75)), curved: false }),
  },
  {
    id: 'lShape',
    group: 'bed',
    label: 'L-shape',
    note: 'Around a corner.',
    build: (o) => ({
      points: [
        { x: o.x, y: o.y },
        { x: o.x + feet(8), y: o.y },
        { x: o.x + feet(8), y: o.y + feet(4) },
        { x: o.x + feet(4), y: o.y + feet(4) },
        { x: o.x + feet(4), y: o.y + feet(8) },
        { x: o.x, y: o.y + feet(8) },
      ],
      curved: false,
    }),
  },
  {
    id: 'keyhole',
    group: 'bed',
    label: 'Keyhole',
    note: 'Round bed with an access notch.',
    build: (o) => {
      const r = feet(3);
      const centre = { x: o.x + r, y: o.y + r };
      const points: Vec[] = [];
      // Leave a 50° gap for the path in.
      for (let a = 25; a <= 335; a += 10) {
        const rad = (a * Math.PI) / 180;
        points.push({ x: centre.x + Math.cos(rad) * r, y: centre.y + Math.sin(rad) * r });
      }
      points.push(centre);
      return { points, curved: false };
    },
  },
];

const allTemplates: readonly Template[] = [
  ...rawTemplates,
  bagTemplate('bag5', 5),
  bagTemplate('bag10', 10),
  bagTemplate('bag15', 15),
  bagTemplate('bag20', 20),
];

export const TEMPLATES: readonly Template[] = allTemplates.map((t) => ({
  ...t,
  build: atOrigin(t.build),
}));

export const templateById = (id: TemplateId): Template | undefined =>
  TEMPLATES.find((t) => t.id === id);

export type OutlineKind = 'rectangle' | 'roundedRectangle' | 'polygon' | 'curve';

export interface OutlineShape {
  readonly kind: OutlineKind;
  /** Present for roundedRectangle — derived, not stored on the bed. */
  readonly cornerRadiusMm?: number;
  /** Worst corner deviation from 90°, for the accuracy readout. */
  readonly squarenessDeg?: number;
}

/**
 * What shape is this, really?
 *
 * A rounded rectangle is recognised by a derivation rather than a point count:
 * squaring off four quarter-circle corners adds exactly (4 − π)r² of area, so
 * `r = sqrt((bboxArea − polyArea) / (4 − π))`. If that radius is consistent with
 * the bed's size, it is a rounded rectangle and the edge-edit rule set should
 * treat it as one.
 */
export function classifyOutline(ring: Ring, toleranceDeg = 3): OutlineShape {
  if (ring.curved) return { kind: 'curve' };
  const points = ring.points;
  if (points.length < 3) return { kind: 'polygon' };

  if (points.length === 4) {
    const worst = worstCornerDeviation(points);
    if (worst <= toleranceDeg) return { kind: 'rectangle', squarenessDeg: worst };
    return { kind: 'polygon', squarenessDeg: worst };
  }

  const box = boundingBox(points);
  const bboxArea = (box.x1 - box.x0) * (box.y1 - box.y0);
  const area = polygonArea(points);
  if (bboxArea <= 0) return { kind: 'polygon' };

  const missing = bboxArea - area;
  if (missing <= 0) return { kind: 'polygon' };
  const radius = Math.sqrt(missing / (4 - Math.PI));
  const shortSide = Math.min(box.x1 - box.x0, box.y1 - box.y0);

  // A radius over half the short side is a stadium or a circle, not a bed with
  // rounded corners; a tiny one is just a polygon that happens to be convex.
  if (radius > shortSide / 2 || radius < shortSide * 0.02) return { kind: 'polygon' };

  // Confirm by reconstruction: the derived rounded rect should match the area.
  const rebuilt = roundedRectPoints({ x: box.x0, y: box.y0 }, box.x1 - box.x0, box.y1 - box.y0, radius, 12);
  const rebuiltArea = polygonArea(rebuilt);
  if (Math.abs(rebuiltArea - area) / area > 0.02) return { kind: 'polygon' };

  const corners = simplify([...points, points[0] as Vec], shortSide * 0.25);
  const worst = corners.length >= 5 ? worstCornerDeviation(corners.slice(0, 4)) : undefined;
  return worst === undefined
    ? { kind: 'roundedRectangle', cornerRadiusMm: radius }
    : { kind: 'roundedRectangle', cornerRadiusMm: radius, squarenessDeg: worst };
}

/** True when a length edit should scale a whole axis rather than move a vertex. */
export const isRectangular = (shape: OutlineShape): boolean =>
  shape.kind === 'rectangle' || shape.kind === 'roundedRectangle';

function worstCornerDeviation(points: Polygon): number {
  let worst = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[(i + points.length - 1) % points.length] as Vec;
    const b = points[i] as Vec;
    const c = points[(i + 1) % points.length] as Vec;
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const angle = Math.abs(
      (Math.atan2(v1.x * v2.y - v1.y * v2.x, v1.x * v2.x + v1.y * v2.y) * 180) / Math.PI,
    );
    worst = Math.max(worst, Math.abs(angle - 90));
  }
  return worst;
}
