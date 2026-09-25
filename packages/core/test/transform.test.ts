import { describe, expect, it } from 'vitest';
import {
  moveSnapped,
  rotateSnapped,
  scaleFromHandle,
  setDimension,
  setEdgeLength,
  setVertex,
  outlineBox,
} from '../src/transform.js';
import { boundingBox } from '../src/geometry.js';
import { SNAP_DEFAULT, SNAP_OFF, snapPoint } from '../src/snap.js';
import { roundedRectPoints } from '../src/shapes.js';
import { feet } from '../src/units.js';
import type { Ring } from '../src/spline.js';

const bed4x8 = [
  { x: 0, y: 0 },
  { x: feet(4), y: 0 },
  { x: feet(4), y: feet(8) },
  { x: 0, y: feet(8) },
];
const ring = (points: { x: number; y: number }[], curved = false): Ring => ({ points, curved });

describe('snapPoint', () => {
  it('holds an edge to the angle increment, then rounds its length', () => {
    // Drawn slightly off horizontal and slightly short of 4 feet.
    const p = snapPoint({ x: feet(3.9), y: feet(0.2) }, { x: 0, y: 0 }, SNAP_DEFAULT);
    expect(p.y).toBeCloseTo(0, 6); // snapped to 0 degrees
    expect(p.x % 152.4).toBeCloseTo(0, 6); // and to a 6-inch multiple
  });

  it('does nothing when assists are off — drifts never snap', () => {
    const raw = { x: 123.4, y: 567.8 };
    expect(snapPoint(raw, { x: 0, y: 0 }, SNAP_OFF)).toEqual(raw);
  });
});

describe('move', () => {
  it('snaps the delta so an aligned bed stays aligned', () => {
    const moved = moveSnapped(bed4x8, 160, 20, SNAP_DEFAULT);
    expect(moved[0]?.x).toBeCloseTo(152.4, 6);
    expect(moved[0]?.y).toBeCloseTo(0, 6);
  });
});

describe('scaleFromHandle', () => {
  it('anchors at the opposite corner', () => {
    const box = boundingBox(bed4x8);
    const result = scaleFromHandle(bed4x8, box, 'se', { x: feet(6), y: feet(10) }, SNAP_OFF);
    const after = boundingBox(result.points);
    expect(after.x0).toBeCloseTo(0, 6); // north-west stayed put
    expect(after.y0).toBeCloseTo(0, 6);
    expect(after.x1).toBeCloseTo(feet(6), 6);
    expect(after.y1).toBeCloseTo(feet(10), 6);
  });

  it('scales one axis only from an edge handle', () => {
    const box = boundingBox(bed4x8);
    const after = boundingBox(
      scaleFromHandle(bed4x8, box, 'e', { x: feet(6), y: feet(99) }, SNAP_OFF).points,
    );
    expect(after.x1).toBeCloseTo(feet(6), 6);
    expect(after.y1).toBeCloseTo(feet(8), 6); // untouched
  });

  it('snaps the resulting dimension, not the pointer (D-026)', () => {
    // Anchor deliberately off-grid: snapping the pointer would give a crooked size.
    const offGrid = bed4x8.map((p) => ({ x: p.x + 37, y: p.y + 37 }));
    const box = boundingBox(offGrid);
    const result = scaleFromHandle(offGrid, box, 'se', { x: 37 + feet(5.9), y: 37 + feet(8) }, SNAP_DEFAULT);
    expect(result.widthMm % 152.4).toBeCloseTo(0, 6);
  });

  it('refuses to invert or collapse a bed', () => {
    const box = boundingBox(bed4x8);
    const result = scaleFromHandle(bed4x8, box, 'se', { x: -feet(99), y: -feet(99) }, SNAP_OFF, 100);
    expect(result.widthMm).toBeGreaterThanOrEqual(100);
    expect(result.heightMm).toBeGreaterThanOrEqual(100);
  });
});

describe('rotate', () => {
  it('snaps to the angle increment and preserves size', () => {
    const before = boundingBox(bed4x8);
    const centre = { x: feet(2), y: feet(4) };
    const spun = rotateSnapped(bed4x8, centre, 13, SNAP_DEFAULT); // snaps to 15
    const after = boundingBox(spun);
    // A 15 degree rotation grows the bounding box but not the bed.
    expect(after.x1 - after.x0).toBeGreaterThan(before.x1 - before.x0);
    const side = Math.hypot((spun[1]?.x ?? 0) - (spun[0]?.x ?? 0), (spun[1]?.y ?? 0) - (spun[0]?.y ?? 0));
    expect(side).toBeCloseTo(feet(4), 6);
  });
});

describe('setEdgeLength', () => {
  it('keeps a rectangle rectangular by scaling the whole axis', () => {
    const next = setEdgeLength(ring(bed4x8), 0, feet(6));
    const box = boundingBox(next.points);
    expect(box.x1 - box.x0).toBeCloseTo(feet(6), 6);
    expect(box.y1 - box.y0).toBeCloseTo(feet(8), 6);
    expect(next.points).toHaveLength(4);
  });

  it('does the same for a rounded metal bed — the case that would have broken', () => {
    const rounded = ring(roundedRectPoints({ x: 0, y: 0 }, feet(8), feet(4), feet(0.75)));
    const next = setEdgeLength(rounded, 0, feet(10));
    const box = boundingBox(next.points);
    expect(box.x1 - box.x0).toBeCloseTo(feet(10), 4);
    expect(box.y1 - box.y0).toBeCloseTo(feet(4), 4);
  });

  it('moves only the far vertex on a non-rectangle', () => {
    const l = ring([
      { x: 0, y: 0 },
      { x: feet(8), y: 0 },
      { x: feet(8), y: feet(4) },
      { x: feet(4), y: feet(4) },
      { x: feet(4), y: feet(8) },
      { x: 0, y: feet(8) },
    ]);
    const next = setEdgeLength(l, 0, feet(10));
    expect(next.points[1]?.x).toBeCloseTo(feet(10), 6);
    expect(next.points[2]?.x).toBeCloseTo(feet(8), 6); // neighbours untouched
  });

  it('ignores a nonsense target rather than collapsing the bed', () => {
    expect(setEdgeLength(ring(bed4x8), 0, 0).points).toEqual(bed4x8);
  });
});

describe('setDimension and setVertex', () => {
  it('sets an exact overall width', () => {
    const box = boundingBox(setDimension(bed4x8, 'w', feet(5)));
    expect(box.x1 - box.x0).toBeCloseTo(feet(5), 6);
  });

  it('moves one vertex and leaves the rest', () => {
    const next = setVertex(ring(bed4x8), 2, { x: feet(9), y: feet(9) });
    expect(next.points[2]).toEqual({ x: feet(9), y: feet(9) });
    expect(next.points[0]).toEqual(bed4x8[0]);
  });

  it('ignores an out-of-range vertex index', () => {
    expect(setVertex(ring(bed4x8), 99, { x: 0, y: 0 }).points).toEqual(bed4x8);
  });
});

describe('outlineBox', () => {
  it('measures a curved ring through its sampled polygon', () => {
    const curved = ring(
      [
        { x: 0, y: 0 },
        { x: feet(4), y: 0 },
        { x: feet(4), y: feet(4) },
        { x: 0, y: feet(4) },
      ],
      true,
    );
    const box = outlineBox(curved);
    expect(box.x1 - box.x0).toBeGreaterThan(0);
  });
});
