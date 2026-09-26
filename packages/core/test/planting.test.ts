import { describe, expect, it } from 'vitest';
import {
  checkSpacing,
  isDormantOn,
  occupiedCells,
  occupiesOn,
  placementConflicts,
  projectedSpreadMm,
  type Planting,
} from '../src/planting.js';
import { varietyById } from '../src/catalog/index.js';
import { feet, inches } from '../src/units.js';

const base = (over: Partial<Planting> = {}): Planting => ({
  id: 'p',
  bedId: 'bed-1',
  varietyId: 'lettuce',
  seasonYear: 2026,
  footprint: { mode: 'cells', cells: [{ col: 0, row: 0 }] },
  method: 'directSow',
  plannedSowDate: '2026-04-01',
  plannedEndDate: '2026-07-01',
  status: 'planned',
  notes: '',
  ...over,
});

/** A coneflower: in the ground since 2024, above ground May to October. */
const coneflower = base({
  id: 'coneflower',
  varietyId: 'echinacea-purpurea',
  plannedSowDate: '2024-05-01',
  plannedEndDate: null,
  dormantFrom: 11,
  dormantTo: 4,
  status: 'established',
  footprint: { mode: 'cells', cells: [{ col: 1, row: 1 }, { col: 1, row: 2 }] },
});

describe('occupiesOn — the dormancy trap (D-013)', () => {
  it('holds a perennial’s ground in March, when it looks like bare soil', () => {
    // The single most likely bug in the app: if this returned false, the planner
    // would offer these cells for lettuce every spring.
    expect(occupiesOn(coneflower, '2026-03-15')).toBe(true);
    expect(isDormantOn(coneflower, '2026-03-15')).toBe(true);
  });

  it('holds it in every month, dormant or not', () => {
    for (let month = 1; month <= 12; month += 1) {
      const date = `2026-${String(month).padStart(2, '0')}-15`;
      expect(occupiesOn(coneflower, date), date).toBe(true);
    }
  });

  it('separates dormancy from occupancy — dormancy is only how it is drawn', () => {
    expect(isDormantOn(coneflower, '2026-07-15')).toBe(false);
    expect(occupiesOn(coneflower, '2026-07-15')).toBe(true);
  });

  it('does not hold ground before it was planted', () => {
    expect(occupiesOn(coneflower, '2023-06-01')).toBe(false);
  });

  it('frees an annual once its range ends', () => {
    const lettuce = base();
    expect(occupiesOn(lettuce, '2026-06-30')).toBe(true);
    expect(occupiesOn(lettuce, '2026-07-02')).toBe(false);
  });

  it('prefers actual dates over planned ones', () => {
    const pulled = base({ actualEndDate: '2026-05-01' });
    expect(occupiesOn(pulled, '2026-06-01')).toBe(false);
  });

  it('frees the ground when a planting failed', () => {
    expect(occupiesOn(base({ status: 'failed' }), '2026-05-01')).toBe(false);
  });
});

describe('placementConflicts', () => {
  const plantings = [coneflower];

  it('refuses to put lettuce on a dormant coneflower in March', () => {
    const conflicts = placementConflicts(
      plantings,
      'bed-1',
      { mode: 'cells', cells: [{ col: 1, row: 1 }] },
      '2026-03-10',
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toBe('cellTaken');
    // And says it is dormant, because "there is nothing there" is exactly what
    // the gardener will believe when they look at the bed.
    expect(conflicts[0]?.dormant).toBe(true);
    expect(conflicts[0]?.with.id).toBe('coneflower');
  });

  it('allows a free cell in the same bed', () => {
    const conflicts = placementConflicts(
      plantings,
      'bed-1',
      { mode: 'cells', cells: [{ col: 5, row: 5 }] },
      '2026-03-10',
    );
    expect(conflicts).toEqual([]);
  });

  it('reports every taken cell against the planting holding them', () => {
    const conflicts = placementConflicts(
      plantings,
      'bed-1',
      { mode: 'cells', cells: [{ col: 1, row: 1 }, { col: 1, row: 2 }, { col: 9, row: 9 }] },
      '2026-06-01',
    );
    expect(conflicts[0]?.cells).toEqual(['1:1', '1:2']);
  });

  it('ignores other beds', () => {
    const conflicts = placementConflicts(
      plantings,
      'bed-2',
      { mode: 'cells', cells: [{ col: 1, row: 1 }] },
      '2026-03-10',
    );
    expect(conflicts).toEqual([]);
  });

  it('catches overlapping drifts, which have no cells to compare', () => {
    const drift = base({
      id: 'liatris',
      plannedEndDate: null,
      footprint: {
        mode: 'drift',
        ring: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }], curved: false },
        count: 10,
        spacingMm: 300,
      },
    });
    const conflicts = placementConflicts(
      [drift],
      'bed-1',
      { mode: 'point', x: 500, y: 500, radiusMm: 200 },
      '2026-06-01',
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toBe('overlaps');
  });
});

describe('occupiedCells', () => {
  it('maps each taken cell to the planting holding it', () => {
    const taken = occupiedCells([coneflower], 'bed-1', '2026-02-01');
    expect([...taken.keys()].sort()).toEqual(['1:1', '1:2']);
    expect(taken.get('1:1')?.id).toBe('coneflower');
  });
});

describe('checkSpacing', () => {
  const bed = { cellMm: 304.8 };

  it('reports capacity for a grid planting', () => {
    const carrot = varietyById('carrot')!;
    const check = checkSpacing(
      { mode: 'cells', cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }] },
      carrot,
      bed,
    );
    expect(check.capacity).toBe(32); // 16 per cell
    expect(check.ok).toBe(true);
  });

  it('pro-rates a partial cell', () => {
    const carrot = varietyById('carrot')!;
    const check = checkSpacing(
      { mode: 'cells', cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }] },
      carrot,
      bed,
      (cell) => (cell.col === 1 ? 0.5 : 1),
    );
    expect(check.capacity).toBe(24);
  });

  it('flags an overcrowded drift', () => {
    const liatris = varietyById('liatris-pycnostachya')!;
    const oneSquareMetre = {
      points: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ],
      curved: false,
    };
    const check = checkSpacing(
      { mode: 'drift', ring: oneSquareMetre, count: 40, spacingMm: inches(15) },
      liatris,
      bed,
    );
    expect(check.ok).toBe(false);
    expect(check.overcrowdedBy).toBeGreaterThan(30);
    expect(check.explanation).toMatch(/too many/);
  });

  it('accepts a sensible drift', () => {
    const liatris = varietyById('liatris-pycnostachya')!;
    const ring = {
      points: [
        { x: 0, y: 0 },
        { x: feet(6), y: 0 },
        { x: feet(6), y: feet(4) },
        { x: 0, y: feet(4) },
      ],
      curved: false,
    };
    expect(checkSpacing({ mode: 'drift', ring, count: 12, spacingMm: inches(15) }, liatris, bed).ok).toBe(true);
  });

  it('warns when a specimen is drawn smaller than it will grow', () => {
    const serviceberry = varietyById('amelanchier-arborea')!;
    const check = checkSpacing({ mode: 'point', x: 0, y: 0, radiusMm: feet(2) }, serviceberry, bed);
    expect(check.ok).toBe(false);
    expect(check.explanation).toMatch(/matures to/);
  });
});

describe('projectedSpreadMm', () => {
  it('grows toward mature spread rather than starting there', () => {
    const serviceberry = varietyById('amelanchier-arborea')!;
    const y1 = projectedSpreadMm(serviceberry, 1);
    const y4 = projectedSpreadMm(serviceberry, 4);
    const y8 = projectedSpreadMm(serviceberry, 8);
    expect(y1).toBeLessThan(y4);
    expect(y4).toBeLessThan(y8);
    expect(y8).toBe(serviceberry.matureSpreadMm);
  });

  it('decelerates — a shrub fills out fastest early', () => {
    const shrub = varietyById('physocarpus-opulifolius')!;
    const first = projectedSpreadMm(shrub, 2) - projectedSpreadMm(shrub, 0);
    const later = projectedSpreadMm(shrub, 8) - projectedSpreadMm(shrub, 6);
    expect(first).toBeGreaterThan(later);
  });
});
