import { describe, expect, it } from 'vitest';
import { classifyOutline, isRectangular, roundedRectPoints, TEMPLATES, templateById } from '../src/shapes.js';
import { boundingBox, polygonArea } from '../src/geometry.js';
import { feet, MM_PER_FOOT } from '../src/units.js';
import type { Ring } from '../src/spline.js';

const ring = (points: { x: number; y: number }[], curved = false): Ring => ({ points, curved });

describe('templates', () => {
  it('builds every template at the requested origin', () => {
    for (const template of TEMPLATES) {
      const built = template.build({ x: feet(2), y: feet(3) });
      const box = boundingBox(built.points);
      expect(box.x0).toBeCloseTo(feet(2), 3);
      expect(box.y0).toBeCloseTo(feet(3), 3);
      expect(polygonArea(built.points)).toBeGreaterThan(0);
    }
  });

  it('makes a 4x8 bed exactly 32 square feet', () => {
    const bed = templateById('rect4x8')?.build({ x: 0, y: 0 });
    expect(polygonArea(bed!.points) / (MM_PER_FOOT * MM_PER_FOOT)).toBeCloseTo(32, 6);
  });

  it('gives the corrugated metal bed radiused corners', () => {
    const bed = templateById('vego8x4')!.build({ x: 0, y: 0 });
    expect(bed.points.length).toBeGreaterThan(4);
    // Rounding corners removes area from the bounding box.
    const box = boundingBox(bed.points);
    const bbox = (box.x1 - box.x0) * (box.y1 - box.y0);
    expect(polygonArea(bed.points)).toBeLessThan(bbox);
  });
});

describe('classifyOutline', () => {
  it('recognises a plain rectangle', () => {
    const shape = classifyOutline(
      ring([
        { x: 0, y: 0 },
        { x: feet(4), y: 0 },
        { x: feet(4), y: feet(8) },
        { x: 0, y: feet(8) },
      ]),
    );
    expect(shape.kind).toBe('rectangle');
    expect(shape.squarenessDeg).toBeCloseTo(0, 6);
    expect(isRectangular(shape)).toBe(true);
  });

  it('recognises the real beds — rounded corners, and recovers the radius', () => {
    // P1-18: a sharp-corner test would call this a polygon and the edge edit
    // would then behave differently for Josh's actual beds than for a template.
    const radius = feet(0.75);
    const shape = classifyOutline(ring(roundedRectPoints({ x: 0, y: 0 }, feet(8), feet(4), radius)));
    expect(shape.kind).toBe('roundedRectangle');
    expect(shape.cornerRadiusMm).toBeCloseTo(radius, -1);
    expect(isRectangular(shape)).toBe(true);
  });

  it('recovers a range of corner radii', () => {
    for (const r of [feet(0.25), feet(0.5), feet(1)]) {
      const shape = classifyOutline(ring(roundedRectPoints({ x: 0, y: 0 }, feet(8), feet(4), r, 10)));
      expect(shape.kind).toBe('roundedRectangle');
      expect(shape.cornerRadiusMm! / r).toBeGreaterThan(0.9);
      expect(shape.cornerRadiusMm! / r).toBeLessThan(1.1);
    }
  });

  it('calls a skewed quadrilateral a polygon, not a rectangle', () => {
    const shape = classifyOutline(
      ring([
        { x: 0, y: 0 },
        { x: feet(4), y: feet(0.6) },
        { x: feet(4), y: feet(8) },
        { x: 0, y: feet(8) },
      ]),
    );
    expect(shape.kind).toBe('polygon');
    expect(shape.squarenessDeg).toBeGreaterThan(3);
    expect(isRectangular(shape)).toBe(false);
  });

  it('calls an L-shape a polygon', () => {
    const l = templateById('lShape')!.build({ x: 0, y: 0 });
    expect(classifyOutline(l).kind).toBe('polygon');
  });

  it('calls a curved ring a curve without inspecting its points', () => {
    expect(classifyOutline(ring([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], true)).kind).toBe(
      'curve',
    );
  });
});

describe('container templates (P1-20)', () => {
  it('sizes grow bags by diameter, not by nominal gallons', () => {
    const five = templateById('bag5')!.build({ x: 0, y: 0 });
    const twenty = templateById('bag20')!.build({ x: 0, y: 0 });
    const width = (r: { points: readonly { x: number; y: number }[] }) => {
      const box = boundingBox(r.points);
      return box.x1 - box.x0;
    };
    // 5 gal is 12 inches across; four times the volume is nowhere near four
    // times the width, which is exactly why footprint is stored, not gallons.
    expect(width(five) / 25.4).toBeCloseTo(12, 0);
    expect(width(twenty) / 25.4).toBeCloseTo(20, 0);
    expect(width(twenty) / width(five)).toBeLessThan(2);
  });

  it('separates containers from beds so the rail can group them', () => {
    const groups = new Set(TEMPLATES.map((t) => t.group));
    expect(groups).toEqual(new Set(['bed', 'container']));
    expect(templateById('bag10')?.group).toBe('container');
    expect(templateById('rect4x8')?.group).toBe('bed');
  });

  it('places a bag at the origin like every other template', () => {
    const box = boundingBox(templateById('bag10')!.build({ x: 1000, y: 2000 }).points);
    expect(box.x0).toBeCloseTo(1000, 3);
    expect(box.y0).toBeCloseTo(2000, 3);
  });
});
