import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOG, CATALOG_VERSION, varietyById } from '../src/catalog/index.js';
import { coarsen } from '../src/geo.js';
import type { Site } from '../src/model.js';
import { filterCatalog, nativeTo, parseZone, zoneFit } from '../src/variety.js';

const site: Site = {
  id: 's',
  name: 'Home',
  cell: coarsen(39.5, -86.1),
  hardinessZone: '6a',
  heatZone: 6,
  frost: {
    thresholdF: 32,
    lastSpring: { p10: '05-13', p50: '04-29' },
    firstFall: { p10: '10-09', p50: '10-18' },
    source: 'provisional',
  },
  frostRisk: 'cautious',
  regions: [
    { kind: 'ecoregion3', code: '55', name: 'Eastern Corn Belt Plains' },
    { kind: 'state', code: 'IN', name: 'Indiana' },
  ],
  nativeStrictness: 'ecoregion',
};

describe('parseZone', () => {
  it('keeps the half-zone', () => {
    expect(parseZone('6a')).toBe(6);
    expect(parseZone('6b')).toBe(6.5);
    expect(parseZone('10')).toBe(10);
    expect(parseZone('nonsense')).toBeNull();
  });
});

describe('zoneFit', () => {
  it('does not gate annuals — frost kills them by design', () => {
    expect(zoneFit(varietyById('tomato')!, '4a')).toBe('suitable');
  });

  it('reports a perennial rated exactly to this zone as marginal, not suitable', () => {
    // CLIMATE.md: the site straddles 6a/6b, and being wrong toward optimism
    // costs a plant. Buttonbush is rated to zone 5.
    expect(zoneFit(varietyById('cephalanthus-occidentalis')!, '5a')).toBe('marginal');
    expect(zoneFit(varietyById('cephalanthus-occidentalis')!, '6a')).toBe('suitable');
  });

  it('rejects a perennial that will not survive the winter', () => {
    expect(zoneFit(varietyById('cephalanthus-occidentalis')!, '4a')).toBe('tooCold');
  });

  it('rejects one that needs a colder winter than it will get', () => {
    expect(zoneFit(varietyById('physocarpus-opulifolius')!, '9a')).toBe('tooWarm');
  });

  it('says so when it does not know', () => {
    expect(zoneFit(varietyById('echinacea-purpurea')!, 'nonsense')).toBe('unknown');
  });
});

describe('nativeTo', () => {
  it('names the region the claim is true of, never just a badge', () => {
    const verdict = nativeTo(varietyById('asclepias-tuberosa')!, site);
    expect(verdict.native).toBe(true);
    expect(verdict.region?.name).toBe('Eastern Corn Belt Plains');
    expect(verdict.strictness).toBe('ecoregion');
  });

  it('is false for a plant from somewhere else', () => {
    expect(nativeTo(varietyById('tomato')!, site).native).toBe(false);
  });

  it('honours a looser strictness', () => {
    const stateOnly = { ...site, regions: [site.regions[1]!] };
    // With ecoregion strictness and no ecoregion recorded, nothing qualifies…
    expect(nativeTo(varietyById('asclepias-tuberosa')!, stateOnly).native).toBe(false);
    // …but relaxing to state does.
    const relaxed: Site = { ...stateOnly, nativeStrictness: 'state' };
    expect(nativeTo(varietyById('asclepias-tuberosa')!, relaxed).region?.code).toBe('IN');
  });

  it('returns nothing when the gardener has turned it off', () => {
    const off: Site = { ...site, nativeStrictness: 'off' };
    expect(nativeTo(varietyById('asclepias-tuberosa')!, off).native).toBe(false);
  });
});

describe('filterCatalog', () => {
  it('finds by common and scientific name', () => {
    expect(filterCatalog(BUNDLED_CATALOG, site, { search: 'coneflower' })).toHaveLength(1);
    expect(filterCatalog(BUNDLED_CATALOG, site, { search: 'asclepias' })).toHaveLength(3);
  });

  it('returns a genuinely useful native shortlist for this site', () => {
    const natives = filterCatalog(BUNDLED_CATALOG, site, { nativeOnly: true, hardyOnly: true });
    expect(natives.length).toBeGreaterThanOrEqual(15);
    expect(natives.every((v) => nativeTo(v, site).native)).toBe(true);
  });

  it('combines filters', () => {
    const shade = filterCatalog(BUNDLED_CATALOG, site, {
      nativeOnly: true,
      sun: 'partial',
    });
    expect(shade.map((v) => v.id)).toContain('aquilegia-canadensis');
    expect(shade.map((v) => v.id)).not.toContain('eryngium-yuccifolium');
  });

  it('finds something for a wet spot', () => {
    const wet = filterCatalog(BUNDLED_CATALOG, site, { moisture: 'wet', nativeOnly: true });
    expect(wet.map((v) => v.id)).toContain('lobelia-cardinalis');
  });
});

describe('the bundled catalog', () => {
  it('has unique ids and a version', () => {
    const ids = new Set(BUNDLED_CATALOG.map((v) => v.id));
    expect(ids.size).toBe(BUNDLED_CATALOG.length);
    expect(CATALOG_VERSION).toBeGreaterThan(0);
  });

  it('marks nothing as custom — user additions must survive an update', () => {
    expect(BUNDLED_CATALOG.every((v) => !v.isCustom)).toBe(true);
  });

  it('records dtmFrom wherever days-to-maturity exists', () => {
    for (const variety of BUNDLED_CATALOG) {
      if (variety.daysToMaturity !== undefined) {
        expect(['sow', 'transplant']).toContain(variety.dtmFrom);
      }
    }
  });

  it('counts transplanted crops from transplant, not from sow', () => {
    // Getting this backwards is a four-to-six week error in the derived dates.
    expect(varietyById('tomato')?.dtmFrom).toBe('transplant');
    expect(varietyById('carrot')?.dtmFrom).toBe('sow');
  });

  it('gives every perennial a hardiness floor, since that is what gates it', () => {
    for (const variety of BUNDLED_CATALOG) {
      if (['perennial', 'shrub', 'tree', 'bulb'].includes(variety.lifecycle)) {
        expect(variety.hardinessZoneMin, variety.id).toBeDefined();
      }
    }
  });

  it('keeps onion seed at one year — the shortest-lived thing in the box', () => {
    expect(varietyById('onion')?.seedLongevityYears).toBe(1);
    expect(varietyById('lettuce')?.seedLongevityYears).toBe(5);
  });

  it('covers the flowering season without a long gap', () => {
    const months = new Set<number>();
    for (const v of BUNDLED_CATALOG) {
      if (v.bloomStartMonth === undefined || v.bloomEndMonth === undefined) continue;
      for (let m = v.bloomStartMonth; m <= v.bloomEndMonth; m += 1) months.add(m);
    }
    for (let m = 4; m <= 10; m += 1) expect(months, `month ${m}`).toContain(m);
  });
});
