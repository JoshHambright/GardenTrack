import type { NativeStrictness, RegionRef, Site } from './model.js';

/** Lifecycle decides whether an occupancy ends and whether the ground frees. */
export type Lifecycle =
  | 'annual'
  | 'biennial'
  | 'tenderPerennial'
  | 'perennial'
  | 'shrub'
  | 'tree'
  | 'bulb';

export type SunRequirement = 'full' | 'partial' | 'shade';
export type Moisture = 'dry' | 'medium' | 'moist' | 'wet';
export type SowMethod = 'directSow' | 'transplant' | 'either' | 'division' | 'bareRoot';
export type FrostTolerance = 'tender' | 'halfHardy' | 'hardy' | 'veryHardy';
/** Makes the most reliable companion advice computable rather than looked up. */
export type FeederClass = 'heavy' | 'moderate' | 'light' | 'fixer';

export interface Variety {
  readonly id: string;
  commonName: string;
  scientificName?: string | undefined;
  cultivar?: string | undefined;
  family: string;
  genus?: string | undefined;
  lifecycle: Lifecycle;

  daysToMaturity?: number | undefined;
  /** Counted from sow for direct-sown crops, from transplant for started ones.
   *  Getting this wrong silently breaks every derived date in the app. */
  dtmFrom: 'sow' | 'transplant';

  spacingMm: number;
  matureSpreadMm?: number | undefined;
  matureHeightMm?: number | undefined;
  /** The square-foot number, which does not always match the arithmetic. */
  plantsPerCell?: number | undefined;

  hardinessZoneMin?: string | undefined;
  hardinessZoneMax?: string | undefined;
  heatZoneMax?: number | undefined;

  sunRequirement: SunRequirement;
  moisture: Moisture;
  sowMethod: SowMethod;
  frostTolerance: FrostTolerance;
  feederClass: FeederClass;

  bloomStartMonth?: number | undefined;
  bloomEndMonth?: number | undefined;
  /** A set of regions, never a boolean — "native" without a scale is marketing. */
  nativeToRegions: readonly string[];
  pollinatorValue?: 'high' | 'medium' | 'low' | undefined;
  /** Larval host genera. The most persuasive number in native gardening and
   *  the least cleanly licensed, so it is filled by hand where filled at all. */
  hostGenera: readonly string[];

  seedLongevityYears: number;
  isCustom: boolean;
  notes?: string | undefined;
}

/* ------------------------------------------------------------------ zones */

/** "6a" → 6.0, "6b" → 6.5, so zones compare as numbers without losing the half. */
export function parseZone(zone: string): number | null {
  const m = /^(\d{1,2})([ab])?$/i.exec(zone.trim());
  if (m === null) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  return m[2]?.toLowerCase() === 'b' ? base + 0.5 : base;
}

export type ZoneFit = 'suitable' | 'marginal' | 'tooCold' | 'tooWarm' | 'unknown';

/**
 * Will it survive here?
 *
 * Only perennials and woodies are gated by hardiness: an annual is killed by
 * frost every year by design, so refusing to show tomatoes in zone 4 would be
 * nonsense. And a variety rated exactly to the site's zone is reported
 * **marginal**, not suitable — the site straddles 6a and 6b, and being wrong
 * toward optimism costs a plant (CLIMATE.md).
 */
export function zoneFit(variety: Variety, siteZone: string): ZoneFit {
  const perennial =
    variety.lifecycle === 'perennial' ||
    variety.lifecycle === 'shrub' ||
    variety.lifecycle === 'tree' ||
    variety.lifecycle === 'bulb';
  if (!perennial) return 'suitable';

  const site = parseZone(siteZone);
  const min = variety.hardinessZoneMin === undefined ? null : parseZone(variety.hardinessZoneMin);
  const max = variety.hardinessZoneMax === undefined ? null : parseZone(variety.hardinessZoneMax);
  if (site === null || min === null) return 'unknown';

  if (site < min) return 'tooCold';
  if (max !== null && site > max) return 'tooWarm';
  if (site - min < 0.5) return 'marginal';
  return 'suitable';
}

/* --------------------------------------------------------------- nativity */

export interface NativeVerdict {
  readonly native: boolean;
  /** The region the claim is relative to — never hidden behind a badge. */
  readonly region: RegionRef | null;
  readonly strictness: NativeStrictness;
}

const STRICTNESS_ORDER: Record<NativeStrictness, readonly RegionRef['kind'][]> = {
  ecoregion: ['ecoregion4', 'ecoregion3'],
  state: ['ecoregion4', 'ecoregion3', 'state'],
  continent: ['ecoregion4', 'ecoregion3', 'state', 'county'],
  off: [],
};

/**
 * Native to *what*? Native to North America is not native to your county, so the
 * answer names the region it is true of, at the strictness the gardener chose.
 */
export function nativeTo(variety: Variety, site: Site): NativeVerdict {
  if (site.nativeStrictness === 'off') {
    return { native: false, region: null, strictness: 'off' };
  }
  const kinds = STRICTNESS_ORDER[site.nativeStrictness];
  for (const kind of kinds) {
    for (const region of site.regions) {
      if (region.kind !== kind) continue;
      const key = `${region.kind}:${region.code}`;
      if (variety.nativeToRegions.includes(key)) {
        return { native: true, region, strictness: site.nativeStrictness };
      }
    }
  }
  return { native: false, region: null, strictness: site.nativeStrictness };
}

/* ------------------------------------------------------------- filtering */

export interface CatalogFilter {
  readonly search?: string | undefined;
  readonly lifecycles?: readonly Lifecycle[] | undefined;
  readonly sun?: SunRequirement | undefined;
  readonly moisture?: Moisture | undefined;
  readonly nativeOnly?: boolean | undefined;
  /** Hide anything that will not survive the winter here. */
  readonly hardyOnly?: boolean | undefined;
}

export function filterCatalog(
  varieties: readonly Variety[],
  site: Site,
  filter: CatalogFilter,
): Variety[] {
  const needle = filter.search?.trim().toLowerCase() ?? '';
  return varieties.filter((variety) => {
    if (needle !== '') {
      const haystack = [variety.commonName, variety.scientificName ?? '', variety.cultivar ?? '', variety.family]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filter.lifecycles !== undefined && filter.lifecycles.length > 0) {
      if (!filter.lifecycles.includes(variety.lifecycle)) return false;
    }
    if (filter.sun !== undefined && variety.sunRequirement !== filter.sun) return false;
    if (filter.moisture !== undefined && variety.moisture !== filter.moisture) return false;
    if (filter.nativeOnly === true && !nativeTo(variety, site).native) return false;
    if (filter.hardyOnly === true) {
      const fit = zoneFit(variety, site.hardinessZone);
      if (fit === 'tooCold' || fit === 'tooWarm') return false;
    }
    return true;
  });
}
