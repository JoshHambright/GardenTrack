import { describe, expect, it } from 'vitest';
import {
  coarsen,
  cellRadiusMetres,
  exceedsPrecision,
  InvalidCoordinateError,
  DEFAULT_PRECISION_DEG,
} from '../src/geo.js';

describe('coarsen', () => {
  it('rounds onto the shared grid', () => {
    const cell = coarsen(39.4817, -86.0547);
    expect(cell.lat).toBe(39.5);
    expect(cell.lon).toBe(-86.1);
    expect(cell.method).toBe('rounded');
  });

  it('leaves no floating-point tail that would leak the input', () => {
    // 39.400000000000006 would disclose that the input was not exactly 39.4.
    for (const lat of [39.35, 39.44, 12.3456789, -0.05, 77.7]) {
      const { lat: stored, precisionDeg } = coarsen(lat, 0);
      expect(exceedsPrecision(stored, precisionDeg)).toBe(false);
      expect(String(stored)).not.toMatch(/\d{6,}$/);
    }
  });

  it('collapses every point in a cell onto one value — the property that protects them', () => {
    // Both of these round to 39.5 / -86.1.
    expect(coarsen(39.47, -86.06)).toEqual(coarsen(39.53, -86.14));
  });

  it('separates points that straddle a boundary, which every grid does', () => {
    // -86.06 and -86.04 are 1.7 km apart and land in different cells. This is
    // inherent to grids, not a defect: the guarantee is that a stored value
    // never narrows a garden below a cell, not that neighbours always match.
    expect(coarsen(39.47, -86.06).lon).toBe(-86.1);
    expect(coarsen(39.47, -86.04).lon).toBe(-86);
  });

  it('is deterministic, never jittered', () => {
    const runs = Array.from({ length: 50 }, () => coarsen(39.4817, -86.0547));
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it('honours an explicit precision', () => {
    expect(coarsen(39.4817, -86.0547, 1).lat).toBe(39);
    expect(coarsen(39.4817, -86.0547, 0.5).lat).toBe(39.5);
  });

  it('rejects impossible input rather than guessing', () => {
    expect(() => coarsen(91, 0)).toThrow(InvalidCoordinateError);
    expect(() => coarsen(0, 181)).toThrow(InvalidCoordinateError);
    expect(() => coarsen(Number.NaN, 0)).toThrow(InvalidCoordinateError);
    expect(() => coarsen(0, 0, 0)).toThrow(InvalidCoordinateError);
  });

  it('keeps a garden at least a few km from its stored value', () => {
    // The claim in PRIVACY.md §2 is ~11 km of latitude at 0.1 degrees.
    const radius = cellRadiusMetres(coarsen(39.48, -86.05));
    expect(radius).toBeGreaterThan(5_000);
    expect(DEFAULT_PRECISION_DEG).toBe(0.1);
  });
});

describe('P0-06c — a serialised Site cannot retain a precise position', () => {
  it('holds no value matching the input more closely than the grid', () => {
    const inputLat = 39.481704;
    const inputLon = -86.054722;
    const site = {
      id: 'site-1',
      name: 'Home',
      cell: coarsen(inputLat, inputLon),
      hardinessZone: '6a',
    };

    const serialised = JSON.stringify(site);

    // No field anywhere in the document reproduces the input to full precision.
    expect(serialised).not.toContain('39.4817');
    expect(serialised).not.toContain('86.0547');

    // Every number in the document is either on the grid or unrelated to position.
    const numbers = [...serialised.matchAll(/-?\d+\.\d+/g)].map((m) => Number(m[0]));
    for (const value of numbers) {
      const nearLat = Math.abs(value - inputLat) < 0.1;
      const nearLon = Math.abs(value - inputLon) < 0.1;
      if (nearLat || nearLon) {
        expect(exceedsPrecision(value, site.cell.precisionDeg)).toBe(false);
      }
    }
  });
});
