import { describe, expect, it } from 'vitest';
import {
  dayOfYear,
  doyFromMonthDay,
  frostProfileFromMinima,
  frostYears,
  InsufficientRecordError,
  monthDayFromDoy,
  percentile,
  seasonLengthDays,
  type DailyMinimum,
} from '../src/frost.js';

/** A synthetic record: each year freezes up to `springDoy` and from `fallDoy`. */
function record(years: ReadonlyArray<[number, number, number]>): DailyMinimum[] {
  const days: DailyMinimum[] = [];
  for (const [year, springDoy, fallDoy] of years) {
    for (let doy = 1; doy <= 365; doy += 1) {
      const date = new Date(Date.UTC(year, 0, doy));
      const iso = date.toISOString().slice(0, 10);
      const freezing = doy <= springDoy || doy >= fallDoy;
      days.push({ date: iso, minF: freezing ? 28 : 55 });
    }
  }
  return days;
}

describe('dayOfYear / monthDayFromDoy', () => {
  it('round-trips a date', () => {
    expect(dayOfYear('2024-01-01')).toBe(1);
    expect(dayOfYear('2001-05-13')).toBe(133);
    expect(monthDayFromDoy(133)).toBe('05-13');
    expect(doyFromMonthDay('05-13')).toBe(133);
  });

  it('clamps rather than wrapping past the year end', () => {
    expect(monthDayFromDoy(400)).toBe('12-31');
    expect(monthDayFromDoy(0)).toBe('01-01');
  });
});

describe('frostYears', () => {
  it('finds the last spring and first fall frost in each year', () => {
    const years = frostYears(record([[2020, 110, 290]]), 32);
    expect(years).toEqual([{ year: 2020, lastSpringDoy: 110, firstFallDoy: 290 }]);
  });

  it('ignores days above the threshold', () => {
    const warm: DailyMinimum[] = [
      { date: '2020-04-01', minF: 40 },
      { date: '2020-10-01', minF: 38 },
    ];
    expect(frostYears(warm, 32)).toEqual([]);
  });

  it('skips gaps in the record rather than treating them as warm', () => {
    const gappy: DailyMinimum[] = [
      { date: '2020-04-01', minF: null },
      { date: '2020-04-02', minF: 28 },
    ];
    expect(frostYears(gappy, 32)[0]?.lastSpringDoy).toBe(dayOfYear('2020-04-02'));
  });

  it('uses the threshold it is given — a freeze and a frost differ by weeks', () => {
    const shoulder: DailyMinimum[] = [
      { date: '2020-04-20', minF: 34 },
      { date: '2020-04-10', minF: 30 },
      { date: '2020-11-01', minF: 34 },
    ];
    expect(frostYears(shoulder, 32)[0]?.lastSpringDoy).toBe(dayOfYear('2020-04-10'));
    expect(frostYears(shoulder, 36)[0]?.lastSpringDoy).toBe(dayOfYear('2020-04-20'));
  });
});

describe('percentile', () => {
  it('interpolates between samples', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([10, 20], 0.5)).toBe(15);
    expect(percentile([7], 0.9)).toBe(7);
  });
});

describe('frostProfileFromMinima', () => {
  // Ten years, last spring frost spread from day 100 to 136, first fall 280-298.
  const years: Array<[number, number, number]> = [
    [2015, 100, 298],
    [2016, 104, 296],
    [2017, 108, 294],
    [2018, 112, 292],
    [2019, 116, 290],
    [2020, 120, 288],
    [2021, 124, 286],
    [2022, 128, 284],
    [2023, 132, 282],
    [2024, 136, 280],
  ];

  it('puts the cautious spring date at the LATE end, not the average', () => {
    // The whole point: p10 means "only 10% of years frost after this", which is
    // the 90th percentile of last-frost dates. Reading it as the 10th would put
    // tomatoes out a month early.
    const profile = frostProfileFromMinima(record(years));
    expect(doyFromMonthDay(profile.lastSpring.p10)).toBeGreaterThan(
      doyFromMonthDay(profile.lastSpring.p50),
    );
    expect(doyFromMonthDay(profile.lastSpring.p50)).toBe(118); // median of 100..136
    expect(doyFromMonthDay(profile.lastSpring.p10)).toBeCloseTo(132.4, 0);
  });

  it('puts the cautious fall date at the EARLY end', () => {
    const profile = frostProfileFromMinima(record(years));
    expect(doyFromMonthDay(profile.firstFall.p10)).toBeLessThan(
      doyFromMonthDay(profile.firstFall.p50),
    );
    expect(doyFromMonthDay(profile.firstFall.p50)).toBe(289);
  });

  it('gives a shorter season when planning cautiously', () => {
    const profile = frostProfileFromMinima(record(years));
    expect(seasonLengthDays(profile, 'cautious')).toBeLessThan(
      seasonLengthDays(profile, 'typical'),
    );
  });

  it('records the threshold and sample size in the source, so it can be judged', () => {
    const profile = frostProfileFromMinima(record(years), 32, 'open-meteo archive');
    expect(profile.source).toContain('10 years');
    expect(profile.source).toContain('32');
  });

  it('refuses a record too short to be worth a percentile', () => {
    expect(() => frostProfileFromMinima(record(years.slice(0, 3)))).toThrow(
      InsufficientRecordError,
    );
  });
});
