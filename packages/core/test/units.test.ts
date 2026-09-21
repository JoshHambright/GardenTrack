import { describe, expect, it } from 'vitest';
import { feet, formatArea, formatLength, MM_PER_FOOT, parseLength } from '../src/units.js';

describe('formatLength', () => {
  it('formats whole feet', () => {
    expect(formatLength(feet(8))).toBe('8′ 0″');
  });

  it('carries 11.97 inches into the next foot rather than printing 12', () => {
    expect(formatLength(feet(1) - 0.5)).toBe('1′ 0″');
  });

  it('formats metric', () => {
    expect(formatLength(2500, 'metric')).toBe('2.5 m');
    expect(formatLength(400, 'metric')).toBe('40 cm');
  });
});

describe('parseLength', () => {
  it('round-trips the formats a gardener would type', () => {
    expect(parseLength("8'")).toBeCloseTo(feet(8), 6);
    expect(parseLength('8ft')).toBeCloseTo(feet(8), 6);
    expect(parseLength(`8' 6"`)).toBeCloseTo(feet(8) + 6 * 25.4, 6);
    expect(parseLength('6"')).toBeCloseTo(6 * 25.4, 6);
    expect(parseLength('2.5m', 'metric')).toBeCloseTo(2500, 6);
    expect(parseLength('40cm', 'metric')).toBeCloseTo(400, 6);
  });

  it('returns null rather than guessing — a wrong bed dimension is worse', () => {
    expect(parseLength('')).toBeNull();
    expect(parseLength('about eight feet')).toBeNull();
    expect(parseLength('8 furlongs')).toBeNull();
  });
});

describe('formatArea', () => {
  it('reports a 4x8 bed as 32 sq ft', () => {
    expect(formatArea(feet(4) * feet(8))).toBe('32.0 sq ft');
  });
  it('uses the canonical millimetre base', () => {
    expect(MM_PER_FOOT).toBe(304.8);
  });
});
