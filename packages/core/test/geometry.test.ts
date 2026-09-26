import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  cellIndexAt,
  clipToRect,
  COVERAGE_FULL,
  COVERAGE_MIN,
  effectiveCapacity,
  gridCells,
  pointInPolygon,
  polygonArea,
  simplify,
  type Polygon,
} from '../src/geometry.js';
import { feet, MM_PER_FOOT } from '../src/units.js';

const rect = (x: number, y: number, w: number, h: number): Polygon => [
  { x: feet(x), y: feet(y) },
  { x: feet(x + w), y: feet(y) },
  { x: feet(x + w), y: feet(y + h) },
  { x: feet(x), y: feet(y + h) },
];

describe('polygonArea', () => {
  it('measures a 4x8 bed as 32 square feet', () => {
    expect(polygonArea(rect(0, 0, 4, 8)) / (MM_PER_FOOT * MM_PER_FOOT)).toBeCloseTo(32, 6);
  });

  it('is winding-order independent', () => {
    const forward = rect(0, 0, 4, 8);
    expect(polygonArea([...forward].reverse())).toBeCloseTo(polygonArea(forward), 6);
  });

  it('is zero for a degenerate outline', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(0);
  });
});

describe('clipToRect', () => {
  it('returns the whole polygon when it is already inside', () => {
    const box = boundingBox(rect(0, 0, 4, 8));
    expect(polygonArea(clipToRect(rect(1, 1, 1, 1), box))).toBeCloseTo(polygonArea(rect(1, 1, 1, 1)), 6);
  });

  it('returns nothing when the polygon is outside', () => {
    const box = { x0: 0, y0: 0, x1: feet(1), y1: feet(1) };
    expect(polygonArea(clipToRect(rect(5, 5, 1, 1), box))).toBe(0);
  });

  it('halves a cell straddled down the middle', () => {
    const box = { x0: 0, y0: 0, x1: feet(1), y1: feet(1) };
    const half = clipToRect(rect(0.5, 0, 1, 1), box);
    expect(polygonArea(half) / (MM_PER_FOOT * MM_PER_FOOT)).toBeCloseTo(0.5, 6);
  });
});

describe('gridCells', () => {
  it('gives a 4x8 bed 32 whole cells', () => {
    const cells = gridCells(rect(0, 0, 4, 8), { cellMm: MM_PER_FOOT });
    expect(cells).toHaveLength(32);
    expect(cells.every((c) => c.coverage >= COVERAGE_FULL)).toBe(true);
    expect(effectiveCapacity(cells)).toBeCloseTo(32, 6);
  });

  it('gives an off-grid bed partial cells at its edges', () => {
    const cells = gridCells(rect(0.5, 0, 4, 8), { cellMm: MM_PER_FOOT });
    const partial = cells.filter((c) => c.coverage < COVERAGE_FULL);
    expect(partial.length).toBeGreaterThan(0);
    // Area is conserved regardless of where the lattice falls.
    const total = cells.reduce((sum, c) => sum + c.coverage, 0);
    expect(total).toBeCloseTo(32, 4);
  });

  it('handles an L-shaped bed without special-casing it', () => {
    const l: Polygon = [
      { x: feet(0), y: feet(0) },
      { x: feet(8), y: feet(0) },
      { x: feet(8), y: feet(4) },
      { x: feet(4), y: feet(4) },
      { x: feet(4), y: feet(8) },
      { x: feet(0), y: feet(8) },
    ];
    const cells = gridCells(l, { cellMm: MM_PER_FOOT });
    expect(effectiveCapacity(cells)).toBeCloseTo(48, 4); // 8x4 + 4x4
  });

  it('subtracts a hole — the tree in the middle of the bed', () => {
    const hole = rect(1, 1, 2, 2);
    const withHole = gridCells(rect(0, 0, 4, 8), { cellMm: MM_PER_FOOT, holes: [hole] });
    expect(effectiveCapacity(withHole)).toBeCloseTo(28, 4); // 32 - 4
  });

  it('rotates the grid independently of the bed', () => {
    const straight = gridCells(rect(0, 0, 4, 8), { cellMm: MM_PER_FOOT });
    const angled = gridCells(rect(0, 0, 4, 8), { cellMm: MM_PER_FOOT, rotationDeg: 30 });
    expect(angled.length).toBeGreaterThan(straight.length); // more, partly-covered cells

    // The bed is still 32 sq ft, but an angled lattice clips slivers along the
    // edges and cells under 2% coverage are dropped. The loss is bounded and
    // one-directional — we under-report capacity, never over-report it.
    const area = angled.reduce((sum, c) => sum + c.coverage, 0);
    expect(area).toBeLessThanOrEqual(32 + 1e-6);
    expect(area).toBeGreaterThan(31.99);
  });

  it('rejects a nonsensical cell size', () => {
    expect(() => gridCells(rect(0, 0, 4, 8), { cellMm: 0 })).toThrow(RangeError);
  });
});

describe('effectiveCapacity', () => {
  it('counts a sliver as nothing and a mostly-covered cell as whole', () => {
    const box = { x0: 0, y0: 0, x1: 1, y1: 1 };
    expect(
      effectiveCapacity([
        { col: 0, row: 0, box, coverage: COVERAGE_MIN - 0.01 },
        { col: 1, row: 0, box, coverage: COVERAGE_FULL + 0.01 },
      ]),
    ).toBe(1);
  });
});

describe('pointInPolygon', () => {
  it('finds the inside of an L where a bounding box would not', () => {
    const l: Polygon = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 40, y: 40 },
      { x: 40, y: 80 },
      { x: 0, y: 80 },
    ];
    expect(pointInPolygon({ x: 10, y: 10 }, l)).toBe(true);
    expect(pointInPolygon({ x: 60, y: 60 }, l)).toBe(false); // the notch
  });
});

describe('simplify', () => {
  it('reduces a jittered straight stroke to its endpoints', () => {
    const stroke = Array.from({ length: 40 }, (_, i) => ({
      x: i * 10,
      y: (i % 2 === 0 ? 1 : -1) * 0.4,
    }));
    expect(simplify(stroke, 5)).toHaveLength(2);
  });

  it('keeps a real corner', () => {
    const stroke = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    expect(simplify(stroke, 1).length).toBeGreaterThanOrEqual(3);
  });
});

describe('cellIndexAt', () => {
  const bed = rect(0, 0, 4, 8);
  const options = { cellMm: MM_PER_FOOT };

  it('agrees with the lattice gridCells produced', () => {
    // Painting a cell and rendering it must not be able to disagree.
    const cells = gridCells(bed, options);
    for (const cell of cells) {
      const middle = {
        x: (cell.box.x0 + cell.box.x1) / 2,
        y: (cell.box.y0 + cell.box.y1) / 2,
      };
      expect(cellIndexAt(bed, options, middle)).toEqual({ col: cell.col, row: cell.row });
    }
  });

  it('returns null outside the bed', () => {
    expect(cellIndexAt(bed, options, { x: feet(9), y: feet(9) })).toBeNull();
  });

  it('returns null in the notch of an L-shaped bed', () => {
    const l: Polygon = [
      { x: 0, y: 0 },
      { x: feet(8), y: 0 },
      { x: feet(8), y: feet(4) },
      { x: feet(4), y: feet(4) },
      { x: feet(4), y: feet(8) },
      { x: 0, y: feet(8) },
    ];
    expect(cellIndexAt(l, options, { x: feet(6), y: feet(6) })).toBeNull();
    expect(cellIndexAt(l, options, { x: feet(6), y: feet(2) })).not.toBeNull();
  });

  it('follows the grid when it is rotated independently of the bed', () => {
    const straight = cellIndexAt(bed, options, { x: feet(0.5), y: feet(0.5) });
    const angled = cellIndexAt(bed, { ...options, rotationDeg: 45 }, { x: feet(0.5), y: feet(0.5) });
    expect(straight).not.toEqual(angled);
  });
});
