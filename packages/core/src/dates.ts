/**
 * Plain calendar dates. No timezone, because a planting date is a day in a
 * garden, not an instant — and a local-midnight Date in the wrong zone lands a
 * sowing on the previous day for half the world.
 */
export type PlainDate = string; // YYYY-MM-DD

export function makeDate(year: number, month: number, day: number): PlainDate {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toISOString().slice(0, 10);
}

export function fromMonthDay(year: number, monthDay: string): PlainDate {
  const [m, d] = monthDay.split('-').map(Number) as [number, number];
  return makeDate(year, m, d);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: PlainDate, to: PlainDate): number {
  const parse = (s: PlainDate): number => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export const compareDates = (a: PlainDate, b: PlainDate): number => (a < b ? -1 : a > b ? 1 : 0);
export const isBefore = (a: PlainDate, b: PlainDate): boolean => a < b;
export const isOnOrAfter = (a: PlainDate, b: PlainDate): boolean => a >= b;

/** Inclusive on both ends — a planting occupies its last day. */
export const withinRange = (date: PlainDate, from: PlainDate, to: PlainDate | null): boolean =>
  date >= from && (to === null || date <= to);

export const monthOf = (date: PlainDate): number => Number(date.slice(5, 7));
