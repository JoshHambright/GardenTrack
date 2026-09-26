import { addDays, fromMonthDay, type PlainDate } from './dates.js';
import type { FrostRisk, Site } from './model.js';
import type { FrostTolerance, Variety } from './variety.js';

/**
 * The derived schedule (DATA_MODEL §5).
 *
 * Every date here is computed from the site's frost profile and the variety, and
 * then **stored** as a value rather than recomputed on read (D-005) — a later
 * correction to days-to-maturity must not silently rewrite what you did in 2024.
 */

export type Anchor = 'spring' | 'fall';

export interface Schedule {
  readonly anchor: Anchor;
  readonly risk: FrostRisk;
  /** Sowing indoors, for crops that are transplanted. */
  readonly startIndoors: PlainDate | null;
  /** The day seed meets soil, indoors or out. */
  readonly sow: PlainDate;
  readonly transplant: PlainDate | null;
  readonly firstHarvest: PlainDate;
  /** When the bed frees up. Null for perennials — they never do (D-013). */
  readonly end: PlainDate | null;
  readonly notes: readonly string[];
}

/**
 * Conventional offsets from the last spring frost, by hardiness. These are the
 * fallbacks: a catalog entry overrides them when the convention is wrong for it.
 */
const SPRING_OFFSET: Record<FrostTolerance, { transplant: number; directSow: number }> = {
  veryHardy: { transplant: -28, directSow: -35 },
  hardy: { transplant: -14, directSow: -21 },
  halfHardy: { transplant: 0, directSow: -7 },
  tender: { transplant: 7, directSow: 3 },
};

/** How much frost a crop will take at the end of the season, in days past first frost. */
const FALL_GRACE_DAYS: Record<FrostTolerance, number> = {
  veryHardy: 28,
  hardy: 14,
  halfHardy: 0,
  tender: -7,
};

/**
 * The short-day factor. A crop sown for autumn matures more slowly than the seed
 * packet says, because it finishes in shortening days and cooling soil. Ignoring
 * this is the classic reason a fall planting is three weeks late and gets
 * frosted — so the sowing date is pulled forward rather than the gardener being
 * left to discover it.
 */
const FALL_MATURITY_PENALTY = 14;

const PERENNIAL_LIFECYCLES = new Set(['perennial', 'shrub', 'tree', 'bulb']);

export const isPerennial = (variety: Pick<Variety, 'lifecycle'>): boolean =>
  PERENNIAL_LIFECYCLES.has(variety.lifecycle);

function frostDate(site: Site, which: 'lastSpring' | 'firstFall', risk: FrostRisk, year: number) {
  const key = risk === 'cautious' ? 'p10' : 'p50';
  return fromMonthDay(year, site.frost[which][key]);
}

export class UnschedulableError extends Error {}

/** Spring planting: everything hangs off the last frost. */
export function planSpring(variety: Variety, site: Site, year: number, risk?: FrostRisk): Schedule {
  const chosen = risk ?? site.frostRisk;
  const lastFrost = frostDate(site, 'lastSpring', chosen, year);
  const notes: string[] = [];

  const transplanted = variety.sowMethod === 'transplant' || variety.sowMethod === 'either';
  const offsets = SPRING_OFFSET[variety.frostTolerance];

  let sow: PlainDate;
  let transplant: PlainDate | null = null;
  let startIndoors: PlainDate | null = null;

  if (variety.sowMethod === 'transplant') {
    const offset = variety.transplantOffsetDays ?? offsets.transplant;
    transplant = addDays(lastFrost, offset);
    const weeks = variety.weeksIndoors ?? defaultWeeksIndoors(variety);
    startIndoors = addDays(transplant, -weeks * 7);
    sow = startIndoors;
    notes.push(`Started indoors ${weeks} weeks before transplanting.`);
  } else {
    const offset = variety.directSowOffsetDays ?? offsets.directSow;
    sow = addDays(lastFrost, offset);
    if (transplanted) notes.push('Can also be started indoors and transplanted.');
  }

  if (isPerennial(variety)) {
    const first = addDays(transplant ?? sow, variety.daysToMaturity ?? 365);
    notes.push('Perennial — this bed does not free up (D-013).');
    return { anchor: 'spring', risk: chosen, startIndoors, sow, transplant, firstHarvest: first, end: null, notes };
  }

  if (variety.daysToMaturity === undefined) {
    throw new UnschedulableError(`${variety.commonName} has no days-to-maturity`);
  }

  const countFrom = variety.dtmFrom === 'transplant' ? (transplant ?? sow) : sow;
  const firstHarvest = addDays(countFrom, variety.daysToMaturity);
  const end = addDays(firstHarvest, variety.harvestWindowDays ?? defaultHarvestWindow(variety));

  const firstFall = frostDate(site, 'firstFall', chosen, year);
  const grace = FALL_GRACE_DAYS[variety.frostTolerance];
  const killed = addDays(firstFall, grace);
  if (end > killed) {
    notes.push(`Frost is likely to end this around ${killed} rather than ${end}.`);
  }

  return { anchor: 'spring', risk: chosen, startIndoors, sow, transplant, firstHarvest, end: end > killed ? killed : end, notes };
}

/**
 * Fall planting: counted **backward** from the first frost, which is the same
 * arithmetic with a different anchor — and worth building at the same time,
 * because a fall calendar is a large fraction of the value.
 */
export function planFall(variety: Variety, site: Site, year: number, risk?: FrostRisk): Schedule {
  const chosen = risk ?? site.frostRisk;
  if (variety.daysToMaturity === undefined) {
    throw new UnschedulableError(`${variety.commonName} has no days-to-maturity`);
  }
  if (isPerennial(variety)) {
    throw new UnschedulableError(`${variety.commonName} is a perennial — plan it in spring`);
  }

  const firstFall = frostDate(site, 'firstFall', chosen, year);
  const grace = FALL_GRACE_DAYS[variety.frostTolerance];
  const usableUntil = addDays(firstFall, grace);
  const maturity = variety.daysToMaturity + FALL_MATURITY_PENALTY;

  const notes = [
    `Includes ${FALL_MATURITY_PENALTY} days for shortening light — a fall crop matures slower than the packet says.`,
  ];
  if (grace > 0) notes.push(`Hardy enough to keep picking about ${grace} days past first frost.`);
  if (grace < 0) notes.push('Tender — it ends before the first frost, not after it.');

  const countFrom = addDays(usableUntil, -maturity);
  let sow = countFrom;
  let transplant: PlainDate | null = null;
  let startIndoors: PlainDate | null = null;

  if (variety.sowMethod === 'transplant' && variety.dtmFrom === 'transplant') {
    transplant = countFrom;
    const weeks = variety.weeksIndoors ?? defaultWeeksIndoors(variety);
    startIndoors = addDays(transplant, -weeks * 7);
    sow = startIndoors;
  }

  return {
    anchor: 'fall',
    risk: chosen,
    startIndoors,
    sow,
    transplant,
    firstHarvest: addDays(countFrom, maturity - (grace > 0 ? grace : 0)),
    end: usableUntil,
    notes,
  };
}

function defaultWeeksIndoors(variety: Variety): number {
  if (variety.family === 'Solanaceae') return 7;
  if (variety.family === 'Brassicaceae') return 5;
  if (variety.family === 'Amaryllidaceae') return 10;
  return 5;
}

function defaultHarvestWindow(variety: Variety): number {
  switch (variety.lifecycle) {
    case 'annual':
      return variety.family === 'Solanaceae' || variety.family === 'Cucurbitaceae' ? 60 : 21;
    case 'biennial':
      return 30;
    default:
      return 30;
  }
}

/** A succession: the same variety sown every `intervalDays`, `count` times. */
export function succession(base: Schedule, count: number, intervalDays: number): Schedule[] {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => shift(base, i * intervalDays));
}

function shift(schedule: Schedule, days: number): Schedule {
  if (days === 0) return schedule;
  return {
    ...schedule,
    startIndoors: schedule.startIndoors === null ? null : addDays(schedule.startIndoors, days),
    sow: addDays(schedule.sow, days),
    transplant: schedule.transplant === null ? null : addDays(schedule.transplant, days),
    firstHarvest: addDays(schedule.firstHarvest, days),
    end: schedule.end === null ? null : addDays(schedule.end, days),
  };
}
