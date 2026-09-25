import type { FrostProfile, MonthDay } from './model.js';

/**
 * P2-00 — derive a frost profile from historical daily minimum temperatures
 * rather than copying a published table.
 *
 * Published frost dates disagree by a fortnight because they use different
 * thresholds (a 32 °F freeze and a 36 °F frost are different events) and
 * different probability levels, and because the nearest long-record station is
 * usually a city airport whose heat island flatters a rural garden. Deriving the
 * profile from daily minima at the gardener's own cell removes all three
 * problems at once — and the request carries only a coarse cell (D-028).
 */

export interface DailyMinimum {
  /** ISO date, YYYY-MM-DD. */
  readonly date: string;
  /** Daily minimum temperature in °F. Null for a gap in the record. */
  readonly minF: number | null;
}

export interface FrostYear {
  readonly year: number;
  /** Day-of-year of the last spring frost, or null if the year never froze. */
  readonly lastSpringDoy: number | null;
  readonly firstFallDoy: number | null;
}

/** Midsummer. Frost before this is "spring", after it is "fall". */
const MIDYEAR_DOY = 196;

export function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const start = Date.UTC(y, 0, 1);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000) + 1;
}

/** Non-leap-year month-day for a day number, which is what a gardener reads. */
export function monthDayFromDoy(doy: number): MonthDay {
  const clamped = Math.min(Math.max(Math.round(doy), 1), 365);
  const date = new Date(Date.UTC(2001, 0, clamped));
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}`;
}

export function frostYears(minima: readonly DailyMinimum[], thresholdF: number): FrostYear[] {
  const byYear = new Map<number, { last: number | null; first: number | null }>();

  for (const day of minima) {
    if (day.minF === null || day.minF > thresholdF) continue;
    const year = Number(day.date.slice(0, 4));
    const doy = dayOfYear(day.date);
    const entry = byYear.get(year) ?? { last: null, first: null };
    if (doy <= MIDYEAR_DOY) {
      if (entry.last === null || doy > entry.last) entry.last = doy;
    } else if (entry.first === null || doy < entry.first) {
      entry.first = doy;
    }
    byYear.set(year, entry);
  }

  return [...byYear.entries()]
    .map(([year, e]) => ({ year, lastSpringDoy: e.last, firstFallDoy: e.first }))
    .sort((a, b) => a.year - b.year);
}

/** Linear-interpolated percentile of a sorted sample. */
export function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return Number.NaN;
  if (sorted.length === 1) return sorted[0] as number;
  const position = (sorted.length - 1) * Math.min(Math.max(fraction, 0), 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return (sorted[lower] as number) * (1 - weight) + (sorted[upper] as number) * weight;
}

export class InsufficientRecordError extends Error {}

/**
 * Build the profile.
 *
 * **`p10` is a risk level, not a percentile of the date distribution**, and
 * conflating the two is a silent two-week error in the direction that kills
 * seedlings:
 *
 * - `lastSpring.p10` — plant after this and only 10% of years frost you. That is
 *   the **90th** percentile of last-frost dates, the *late* end.
 * - `firstFall.p10` — 10% of years have already frosted by this date. That is
 *   the **10th** percentile, the *early* end.
 *
 * Both are the cautious answer for their season, which is the point: the
 * gardener asks "when is it safe", not "what is the average".
 */
export function frostProfileFromMinima(
  minima: readonly DailyMinimum[],
  thresholdF = 32,
  source = 'derived from daily minima',
): FrostProfile {
  const years = frostYears(minima, thresholdF);
  const spring = years
    .map((y) => y.lastSpringDoy)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const fall = years
    .map((y) => y.firstFallDoy)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  if (spring.length < 5 || fall.length < 5) {
    throw new InsufficientRecordError(
      `need at least 5 years of frost in each season; got ${spring.length} spring, ${fall.length} fall`,
    );
  }

  return {
    thresholdF,
    lastSpring: {
      p10: monthDayFromDoy(percentile(spring, 0.9)),
      p50: monthDayFromDoy(percentile(spring, 0.5)),
    },
    firstFall: {
      p10: monthDayFromDoy(percentile(fall, 0.1)),
      p50: monthDayFromDoy(percentile(fall, 0.5)),
    },
    source: `${source} (${years.length} years, ≤${thresholdF}°F)`,
  };
}

/** Growing season length in days at a given risk level. */
export function seasonLengthDays(profile: FrostProfile, risk: 'cautious' | 'typical'): number {
  const key = risk === 'cautious' ? 'p10' : 'p50';
  const spring = doyFromMonthDay(profile.lastSpring[key]);
  const fall = doyFromMonthDay(profile.firstFall[key]);
  return Math.max(fall - spring, 0);
}

export function doyFromMonthDay(monthDay: MonthDay): number {
  const [m, d] = monthDay.split('-').map(Number) as [number, number];
  return dayOfYear(`2001-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}
