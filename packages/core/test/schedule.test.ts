import { describe, expect, it } from 'vitest';
import { planFall, planSpring, succession, UnschedulableError } from '../src/schedule.js';
import { daysBetween } from '../src/dates.js';
import { varietyById } from '../src/catalog/index.js';
import { coarsen } from '../src/geo.js';
import type { Site } from '../src/model.js';

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
  regions: [],
  nativeStrictness: 'off',
};

const tomato = varietyById('tomato')!;
const carrot = varietyById('carrot')!;
const spinach = varietyById('spinach')!;
const kale = varietyById('kale')!;
const echinacea = varietyById('echinacea-purpurea')!;

describe('planSpring', () => {
  it('holds a tender transplant back until after the last frost', () => {
    const plan = planSpring(tomato, site, 2026);
    expect(plan.transplant).toBe('2026-05-20'); // a week after the cautious 05-13
    expect(plan.startIndoors).toBe('2026-04-01'); // seven weeks earlier
    expect(plan.sow).toBe(plan.startIndoors);
  });

  it('counts days to maturity from transplant when that is how it is measured', () => {
    // Getting this backwards is a six-week error.
    const plan = planSpring(tomato, site, 2026);
    expect(daysBetween(plan.transplant!, plan.firstHarvest)).toBe(tomato.daysToMaturity);
  });

  it('counts from sow for a direct-sown crop', () => {
    const plan = planSpring(carrot, site, 2026);
    expect(plan.transplant).toBeNull();
    expect(daysBetween(plan.sow, plan.firstHarvest)).toBe(carrot.daysToMaturity);
  });

  it('puts a very hardy crop in the ground well before the last frost', () => {
    const plan = planSpring(spinach, site, 2026);
    expect(plan.sow < '2026-05-13').toBe(true);
    expect(daysBetween(plan.sow, '2026-05-13')).toBe(35);
  });

  it('plans earlier when the gardener accepts more risk', () => {
    const cautious = planSpring(tomato, site, 2026, 'cautious');
    const typical = planSpring(tomato, site, 2026, 'typical');
    expect(typical.transplant! < cautious.transplant!).toBe(true);
    expect(daysBetween(typical.transplant!, cautious.transplant!)).toBe(14);
  });

  it('gives a perennial no end date at all', () => {
    const plan = planSpring(echinacea, site, 2026);
    expect(plan.end).toBeNull();
    expect(plan.notes.join(' ')).toMatch(/does not free up/);
  });

  it('ends a tender crop when frost takes it, not when picking would stop', () => {
    const plan = planSpring(tomato, site, 2026);
    // Tender: killed a week before the cautious first frost of 10-09. For this
    // variety the 60-day picking window happens to run out on exactly that day,
    // so nothing is truncated and no warning is needed.
    expect(plan.end).toBe('2026-10-02');
    expect(plan.notes.join(' ')).not.toMatch(/Frost is likely/);
  });

  it('truncates and says so when the harvest window outruns the frost', () => {
    const squash = varietyById('winter-squash')!;
    const plan = planSpring(squash, site, 2026);
    expect(plan.end).toBe('2026-10-02'); // cut back to the frost kill date
    expect(plan.notes.join(' ')).toMatch(/Frost is likely/);
  });

  it('refuses rather than inventing a date when maturity is unknown', () => {
    const noDtm = { ...carrot, daysToMaturity: undefined };
    expect(() => planSpring(noDtm, site, 2026)).toThrow(UnschedulableError);
  });
});

describe('planFall', () => {
  it('counts backward from first frost, not forward from a sowing date', () => {
    const plan = planFall(spinach, site, 2026);
    expect(plan.anchor).toBe('fall');
    expect(plan.end! >= '2026-10-09').toBe(true); // very hardy, keeps going past frost
  });

  it('adds the short-day penalty, so the sowing is pulled earlier', () => {
    const plan = planFall(carrot, site, 2026);
    const naive = daysBetween(plan.sow, plan.end!);
    expect(naive).toBe(carrot.daysToMaturity! + 14);
    expect(plan.notes.join(' ')).toMatch(/shortening light/);
  });

  it('lets a very hardy crop run past the first frost', () => {
    const plan = planFall(kale, site, 2026);
    expect(plan.end!).toBe('2026-11-06'); // 28 days past the cautious 10-09
    expect(plan.notes.join(' ')).toMatch(/past first frost/);
  });

  it('ends a tender crop before the frost rather than after it', () => {
    const plan = planFall(varietyById('bean-bush')!, site, 2026);
    expect(plan.end! < '2026-10-09').toBe(true);
  });

  it('refuses to plan a perennial for fall', () => {
    expect(() => planFall(echinacea, site, 2026)).toThrow(UnschedulableError);
  });
});

describe('succession', () => {
  it('staggers a sowing without drifting the intervals', () => {
    const base = planSpring(varietyById('lettuce')!, site, 2026);
    const runs = succession(base, 5, 14);
    expect(runs).toHaveLength(5);
    expect(daysBetween(runs[0]!.sow, runs[4]!.sow)).toBe(56);
    expect(daysBetween(runs[0]!.firstHarvest, runs[4]!.firstHarvest)).toBe(56);
  });

  it('returns a single run rather than nothing for a count of zero', () => {
    const base = planSpring(carrot, site, 2026);
    expect(succession(base, 0, 14)).toHaveLength(1);
  });
});
