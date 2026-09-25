import { describe, expect, it } from 'vitest';
import { ringPath, samplePolygon, type Ring } from '../src/spline.js';
import { boundingBox, polygonArea } from '../src/geometry.js';
import { feet } from '../src/units.js';

const square = [
  { x: 0, y: 0 },
  { x: feet(4), y: 0 },
  { x: feet(4), y: feet(4) },
  { x: 0, y: feet(4) },
];

describe('samplePolygon', () => {
  it('passes a straight ring through untouched', () => {
    const ring: Ring = { points: square, curved: false };
    expect(samplePolygon(ring)).toBe(square);
  });

  it('expands a curved ring into a polygon everything else can consume', () => {
    const sampled = samplePolygon({ points: square, curved: true });
    expect(sampled.length).toBeGreaterThan(square.length * 4);
    expect(polygonArea(sampled)).toBeGreaterThan(0);
  });

  it('keeps the curve near its control points', () => {
    const box = boundingBox(samplePolygon({ points: square, curved: true }));
    // A Catmull-Rom through a square bulges a little but should not run away.
    expect(box.x0).toBeGreaterThan(-feet(1));
    expect(box.x1).toBeLessThan(feet(5));
  });
});

describe('ringPath', () => {
  it('emits a closed straight path', () => {
    const d = ringPath({ points: square, curved: false });
    expect(d.startsWith('M ')).toBe(true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).not.toContain('C');
  });

  it('emits cubic segments for a curve', () => {
    expect(ringPath({ points: square, curved: true })).toContain('C');
  });

  it('returns nothing for an empty ring rather than broken path data', () => {
    expect(ringPath({ points: [], curved: false })).toBe('');
  });
});
