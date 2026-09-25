import type { GeoCell } from './geo.js';
import type { Ring } from './spline.js';

/**
 * Domain types for Phase 1. Deliberately free of a place name — a `Site` has a
 * `GeoCell` and region codes and nowhere to put an address (D-028).
 */

export type RegionKind = 'ecoregion3' | 'ecoregion4' | 'state' | 'county';
export interface RegionRef {
  readonly kind: RegionKind;
  readonly code: string;
  readonly name: string;
}

/** Month-day, e.g. "05-13". Frost dates are seasonal, not absolute. */
export type MonthDay = string;

export interface FrostProfile {
  /** 32 (freeze) and 36 (frost) are different events, ~2 weeks apart. */
  readonly thresholdF: number;
  readonly lastSpring: { readonly p10: MonthDay; readonly p50: MonthDay };
  readonly firstFall: { readonly p10: MonthDay; readonly p50: MonthDay };
  readonly source: string;
}

/** Which percentile the planner reads. Tomatoes are cautious; cover crops typical. */
export type FrostRisk = 'cautious' | 'typical';
export type NativeStrictness = 'ecoregion' | 'state' | 'continent' | 'off';

export interface Site {
  readonly id: string;
  name: string;
  cell: GeoCell;
  hardinessZone: string;
  heatZone: number | null;
  frost: FrostProfile;
  frostRisk: FrostRisk;
  regions: readonly RegionRef[];
  nativeStrictness: NativeStrictness;
}

export type BedKind =
  | 'raised'
  | 'inGround'
  | 'container'
  | 'greenhouse'
  | 'coldFrame'
  | 'border'
  | 'mound';

/** Drives rotation checking, layout mode and planting defaults (D-020). */
export type BedPurpose = 'annualVeg' | 'perennial' | 'native' | 'mixed';
export type LayoutMode = 'grid' | 'free';

export interface Bed {
  readonly id: string;
  siteId: string;
  name: string;
  kind: BedKind;
  purpose: BedPurpose;
  layoutMode: LayoutMode;
  outline: Ring;
  holes: readonly Ring[];
  cellMm: number;
  /** Independent of the bed's own angle — rows face the sun, not the edge. */
  gridRotationDeg: number;
  soilNotes: string;
  /**
   * False until someone has put a tape measure on it. Sketched and seeded beds
   * start false: this is a measurement tool, and a number nobody checked should
   * say so rather than quietly feeding the spacing maths (D-024).
   */
  dimensionsVerified: boolean;
  archivedAt: number | null;
}

/**
 * Gravel, mulch, pavers. **Cosmetic only** — a surface has no coverage, grows
 * nothing and casts no shade. It exists so the plan is recognisable as the
 * garden, because beds that sit in circulation space rather than next to each
 * other are hard to place from memory (D-030).
 */
export type SurfaceKind = 'gravel' | 'mulch' | 'stone' | 'paver' | 'grass' | 'deck';

export interface Surface {
  readonly id: string;
  siteId: string;
  name: string;
  kind: SurfaceKind;
  outline: Ring;
  archivedAt: number | null;
}

export type ObstructionKind =
  | 'building'
  | 'fence'
  | 'wall'
  | 'shed'
  | 'tree'
  | 'shrub'
  | 'structure'
  | 'shadeCloth';

export interface Obstruction {
  readonly id: string;
  siteId: string;
  name: string;
  kind: ObstructionKind;
  outline: Ring;
  heightMm: number;
  /** 0 solid; ~0.2–0.4 for a deciduous canopy or shade cloth. */
  opacity: number;
  /**
   * A presence window, not a botanical fact: a deciduous canopy and a shade
   * cloth over the strawberries want exactly the same field (D-023).
   */
  presentFrom: number | null;
  presentTo: number | null;
  archivedAt: number | null;
}

export const layoutModeFor = (purpose: BedPurpose): LayoutMode =>
  purpose === 'annualVeg' ? 'grid' : 'free';

export function isPresentInMonth(obstruction: Obstruction, month: number): boolean {
  const { presentFrom, presentTo } = obstruction;
  if (presentFrom === null || presentTo === null) return true;
  // A window may wrap the year end — an evergreen windbreak taken down in spring.
  return presentFrom <= presentTo
    ? month >= presentFrom && month <= presentTo
    : month >= presentFrom || month <= presentTo;
}

/**
 * What the UI shows instead of a location (PRIVACY §8). There is no place name
 * to leak because the type never had one.
 */
export function describeSite(site: Site): string {
  const region = site.regions.find((r) => r.kind === 'ecoregion3') ?? site.regions[0];
  const frost = site.frostRisk === 'cautious' ? site.frost.lastSpring.p10 : site.frost.lastSpring.p50;
  const parts = [`Zone ${site.hardinessZone}`];
  if (region !== undefined) parts.push(region.name);
  parts.push(`last frost ${frost} (${site.frostRisk})`);
  return parts.join(' · ');
}
