import { describe, expect, it } from 'vitest';
import { coarsen } from '../src/geo.js';
import { describeSite, isPresentInMonth, layoutModeFor, type Obstruction, type Site } from '../src/model.js';

const site: Site = {
  id: 'site-1',
  name: 'Home',
  cell: coarsen(39.4817, -86.0547),
  hardinessZone: '6a',
  heatZone: 6,
  frost: {
    thresholdF: 32,
    lastSpring: { p10: '05-13', p50: '04-29' },
    firstFall: { p10: '10-09', p50: '10-18' },
    source: 'provisional',
  },
  frostRisk: 'cautious',
  regions: [{ kind: 'ecoregion3', code: '55', name: 'Eastern Corn Belt Plains' }],
  nativeStrictness: 'ecoregion',
};

describe('describeSite (PRIVACY §8)', () => {
  it('shows what the app uses, not where the gardener lives', () => {
    expect(describeSite(site)).toBe('Zone 6a · Eastern Corn Belt Plains · last frost 05-13 (cautious)');
  });

  it('reads the percentile the risk setting names', () => {
    expect(describeSite({ ...site, frostRisk: 'typical' })).toContain('04-29');
  });

  it('cannot leak a place name because the type has nowhere to hold one', () => {
    const description = describeSite(site);
    expect(description).not.toMatch(/\b\d{5}\b/); // no postcode
    expect(description).not.toContain(String(39.4817));
    expect(Object.keys(site)).not.toContain('address');
  });
});

describe('layoutModeFor (D-020)', () => {
  it('gives annual beds a grid and everything else free placement', () => {
    expect(layoutModeFor('annualVeg')).toBe('grid');
    expect(layoutModeFor('native')).toBe('free');
    expect(layoutModeFor('perennial')).toBe('free');
  });
});

describe('isPresentInMonth (D-023)', () => {
  const base: Obstruction = {
    id: 'o1',
    siteId: 'site-1',
    name: 'x',
    kind: 'tree',
    outline: { points: [], curved: false },
    heightMm: 8000,
    opacity: 0.3,
    presentFrom: null,
    presentTo: null,
    archivedAt: null,
  };

  it('treats a building as always present', () => {
    expect(isPresentInMonth({ ...base, kind: 'building' }, 1)).toBe(true);
    expect(isPresentInMonth({ ...base, kind: 'building' }, 7)).toBe(true);
  });

  it('handles a deciduous canopy in leaf May to October', () => {
    const maple = { ...base, presentFrom: 5, presentTo: 10 };
    expect(isPresentInMonth(maple, 7)).toBe(true);
    expect(isPresentInMonth(maple, 3)).toBe(false);
  });

  it('handles shade cloth — the same field for a different reason', () => {
    const cloth: Obstruction = { ...base, kind: 'shadeCloth', presentFrom: 6, presentTo: 9 };
    expect(isPresentInMonth(cloth, 7)).toBe(true);
    expect(isPresentInMonth(cloth, 4)).toBe(false);
  });

  it('handles a window that wraps the year end', () => {
    const winter = { ...base, presentFrom: 11, presentTo: 3 };
    expect(isPresentInMonth(winter, 12)).toBe(true);
    expect(isPresentInMonth(winter, 2)).toBe(true);
    expect(isPresentInMonth(winter, 6)).toBe(false);
  });
});
