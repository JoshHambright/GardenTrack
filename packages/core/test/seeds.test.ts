import { describe, expect, it } from 'vitest';
import { isUsable, viabilityOf, type SeedPacket } from '../src/seeds.js';
import { varietyById } from '../src/catalog/index.js';

const packet = (overrides: Partial<SeedPacket> = {}): SeedPacket => ({
  id: 'p1',
  varietyId: 'lettuce',
  form: 'seed',
  purchasedYear: 2024,
  usedUpAt: null,
  ...overrides,
});

const lettuce = varietyById('lettuce')!; // 5 years
const onion = varietyById('onion')!; // 1 year

describe('viabilityOf', () => {
  it('calls a fresh packet fresh', () => {
    expect(viabilityOf(packet(), lettuce, 2025).status).toBe('fresh');
  });

  it('ages onion seed far faster than lettuce, from the same year', () => {
    const year = 2026;
    expect(viabilityOf(packet({ varietyId: 'onion' }), onion, year).status).toBe('past');
    expect(viabilityOf(packet(), lettuce, year).status).toBe('fresh');
  });

  it('walks through the statuses as a packet ages', () => {
    // Lettuce keeps for about 5 years, so: half that is fresh, up to it is
    // good, half again is worth testing, and beyond that is past. Seven-year-old
    // lettuce is genuinely "test it", not "bin it" — the bands are deliberately
    // generous because storage conditions matter more than age.
    const statuses = [2024, 2026, 2029, 2033].map(
      (year) => viabilityOf(packet(), lettuce, year).status,
    );
    expect(statuses).toEqual(['fresh', 'fresh', 'good', 'past']);
  });

  it('prefers the lot year over the purchase year — that is what ages', () => {
    const old = packet({ purchasedYear: 2025, lotYear: 2015 });
    expect(viabilityOf(old, lettuce, 2025).ageYears).toBe(10);
    expect(viabilityOf(old, lettuce, 2025).status).toBe('past');
  });

  it('never invents a germination percentage', () => {
    const v = viabilityOf(packet(), lettuce, 2028);
    expect(v.testedPercent).toBeNull();
    expect(v.advice).not.toMatch(/\d+%/);
  });

  it('uses a recorded test in preference to the age estimate', () => {
    // A ten-year-old packet that tested at 85% is a good packet, whatever the
    // species table says.
    const tested = packet({ lotYear: 2015, germinationTest: { year: 2025, percent: 85 } });
    const v = viabilityOf(tested, lettuce, 2025);
    expect(v.status).toBe('good');
    expect(v.testedPercent).toBe(85);
    expect(v.advice).toContain('85%');
  });

  it('reports a failed test as past regardless of age', () => {
    const tested = packet({ germinationTest: { year: 2025, percent: 20 } });
    expect(viabilityOf(tested, lettuce, 2025).status).toBe('past');
  });

  it('tells you to test rather than guessing, once past the species life', () => {
    const v = viabilityOf(packet(), lettuce, 2030);
    expect(v.status).toBe('test');
    expect(v.advice).toMatch(/germination test/i);
    expect(isUsable(v)).toBe(true);
  });

  it('treats a future-dated packet as new rather than negatively aged', () => {
    expect(viabilityOf(packet({ purchasedYear: 2030 }), lettuce, 2025).ageYears).toBe(0);
  });
});
