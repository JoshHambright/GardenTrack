import {
  circlePoints,
  feet,
  layoutModeFor,
  roundedRectPoints,
  type Bed,
  type Obstruction,
  type Surface,
  type Vec,
} from '@gardentrack/core';

/**
 * A starting layout traced from photographs of the real garden.
 *
 * **Every dimension here is an estimate.** Beds are created with
 * `dimensionsVerified: false` so the app says so, and so nothing downstream
 * treats a number nobody measured as though it had been. The point is to save
 * dragging shapes out of nothing, not to pretend at accuracy — a measurement
 * tool that invents measurements is worse than an empty one.
 *
 * Positions are in feet from an arbitrary origin at the south-west of the house.
 */

const rect = (x: number, y: number, w: number, h: number): Vec[] => [
  { x: feet(x), y: feet(y) },
  { x: feet(x + w), y: feet(y) },
  { x: feet(x + w), y: feet(y + h) },
  { x: feet(x), y: feet(y + h) },
];

/** A soft blob for island beds and borders, which are never straight-edged. */
function blob(cx: number, cy: number, rx: number, ry: number, wobble = 0.16): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const k = 1 + Math.sin(a * 2) * wobble + Math.cos(a * 3) * (wobble / 2);
    points.push({ x: feet(cx + Math.cos(a) * rx * k), y: feet(cy + Math.sin(a) * ry * k) });
  }
  return points;
}

export interface SeedLayout {
  readonly beds: ReadonlyArray<Omit<Bed, 'id'>>;
  readonly obstructions: ReadonlyArray<Omit<Obstruction, 'id'>>;
  readonly surfaces: ReadonlyArray<Omit<Surface, 'id'>>;
}

export function seedFromPhotos(siteId: string): SeedLayout {
  const bed = (
    name: string,
    kind: Bed['kind'],
    purpose: Bed['purpose'],
    points: Vec[],
    curved = false,
  ): Omit<Bed, 'id'> => ({
    siteId,
    name,
    kind,
    purpose,
    layoutMode: layoutModeFor(purpose),
    outline: { points, curved },
    holes: [],
    cellMm: 304.8,
    gridRotationDeg: 0,
    soilNotes: 'Position and size estimated from a photo — measure before planning against it.',
    dimensionsVerified: false,
    archivedAt: null,
  });

  const beds: Array<Omit<Bed, 'id'>> = [
    bed(
      'Foundation border',
      'border',
      'perennial',
      blob(20, -4.5, 17, 3.2, 0.1),
      true,
    ),
    bed('Corner bed', 'inGround', 'mixed', rect(41, -9, 9, 8)),
    bed('Pollinator island', 'inGround', 'native', blob(22, -22, 6.5, 4.5), true),
    bed(
      'North raised',
      'raised',
      'annualVeg',
      roundedRectPoints({ x: feet(4), y: feet(12) }, feet(8), feet(4), feet(0.75)),
    ),
    bed(
      'Strawberry bed',
      'raised',
      'annualVeg',
      roundedRectPoints({ x: feet(4), y: feet(18) }, feet(8), feet(4), feet(0.75)),
    ),
  ];

  // Grow bags: individually placed, because Phase 3 plants into each one and the
  // history that makes this app worth keeping is per-container.
  const bagDiameter = 16 * 25.4;
  for (let i = 0; i < 6; i += 1) {
    const cx = feet(15) + (i % 3) * (bagDiameter + feet(0.5));
    const cy = feet(12.5) + Math.floor(i / 3) * (bagDiameter + feet(0.5));
    beds.push(
      bed(`Grow bag ${i + 1}`, 'container', 'annualVeg', circlePoints({ x: cx, y: cy }, bagDiameter / 2)),
    );
  }

  const obstructions: Array<Omit<Obstruction, 'id'>> = [
    {
      siteId,
      name: 'House',
      kind: 'building',
      outline: { points: rect(0, 0, 40, 28), curved: false },
      heightMm: feet(18),
      opacity: 0,
      presentFrom: null,
      presentTo: null,
      archivedAt: null,
    },
    {
      siteId,
      name: 'Porch roof',
      kind: 'structure',
      outline: { points: rect(-9, 2, 9, 20), curved: false },
      heightMm: feet(10),
      opacity: 0,
      presentFrom: null,
      presentTo: null,
      archivedAt: null,
    },
    {
      siteId,
      name: 'Shade cloth',
      kind: 'shadeCloth',
      outline: { points: rect(2, 16.5, 12, 8), curved: false },
      heightMm: feet(7),
      opacity: 0.35,
      // Up for the hot months only — the presence window is for choices as well
      // as for biology (D-023).
      presentFrom: 6,
      presentTo: 9,
      archivedAt: null,
    },
    {
      siteId,
      name: 'Tree line',
      kind: 'tree',
      outline: { points: rect(56, -30, 14, 60), curved: false },
      heightMm: feet(45),
      opacity: 0.25,
      presentFrom: 5,
      presentTo: 10,
      archivedAt: null,
    },
    {
      siteId,
      name: 'Fruit tree',
      kind: 'tree',
      outline: { points: circlePoints({ x: feet(48), y: feet(-24) }, feet(9)), curved: false },
      heightMm: feet(16),
      opacity: 0.3,
      presentFrom: 4,
      presentTo: 10,
      archivedAt: null,
    },
  ];

  const surfaces: Array<Omit<Surface, 'id'>> = [
    {
      siteId,
      name: 'Gravel path',
      kind: 'gravel',
      outline: { points: rect(0, 10, 3.5, 18), curved: false },
      archivedAt: null,
    },
    {
      siteId,
      name: 'Mulch',
      kind: 'mulch',
      outline: { points: rect(3.5, 10, 22, 18), curved: false },
      archivedAt: null,
    },
    {
      siteId,
      name: 'Deck',
      kind: 'deck',
      outline: { points: rect(-9, 2, 9, 20), curved: false },
      archivedAt: null,
    },
  ];

  return { beds, obstructions, surfaces };
}
