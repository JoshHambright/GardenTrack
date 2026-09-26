import { describe, expect, it } from 'vitest';
import {
  COMPANION_RELATIONS,
  derivedFindings,
  evaluatePair,
  EVIDENCE_RANK,
  MECHANISM_RADIUS_MM,
  sortByConfidence,
  suggestCompanions,
  taxaOf,
  type SeedBoxState,
} from '../src/companions.js';
import { BUNDLED_CATALOG, varietyById } from '../src/catalog/index.js';
import { feet } from '../src/units.js';

const tomato = varietyById('tomato')!;
const basil = varietyById('basil')!;
const dill = varietyById('dill')!;
const corn = varietyById('sweet-corn')!;
const poleBean = varietyById('bean-pole')!;
const pepper = varietyById('pepper-sweet')!;
const lettuce = varietyById('lettuce')!;

describe('the relation table', () => {
  it('requires a mechanism, an evidence tier and a source on every row', () => {
    for (const relation of COMPANION_RELATIONS) {
      expect(relation.mechanism, relation.id).toBeTruthy();
      expect(relation.evidence, relation.id).toBeTruthy();
      expect(relation.source.length, relation.id).toBeGreaterThan(10);
    }
  });

  it('is honest about the folklore it carries', () => {
    const carrots = COMPANION_RELATIONS.find((r) => r.id === 'carrot-tomato')!;
    expect(carrots.evidence).toBe('traditional');
    expect(carrots.source).toMatch(/Riotte/);
  });

  it('keeps trial-backed relations distinguishable from repeated advice', () => {
    const tiers = new Set(COMPANION_RELATIONS.map((r) => r.evidence));
    expect(tiers.has('trial')).toBe(true);
    expect(tiers.has('traditional')).toBe(true);
  });
});

describe('taxaOf', () => {
  it('walks variety → species → genus → family', () => {
    expect(taxaOf(tomato).map((t) => t.rank)).toEqual(['variety', 'species', 'genus', 'family']);
  });
});

describe('evaluatePair', () => {
  it('finds the Three Sisters through the genus, not the variety', () => {
    const findings = evaluatePair(corn, poleBean);
    const support = findings.find((f) => f.mechanism === 'structuralSupport');
    expect(support?.evidence).toBe('extension');
    expect(findings.some((f) => f.mechanism === 'nitrogenFixation')).toBe(true);
  });

  it('reports basil and tomato as traditional, not as fact', () => {
    const finding = evaluatePair(tomato, basil).find((f) => f.mechanism === 'pestRepellent');
    expect(finding?.evidence).toBe('traditional');
    expect(finding?.note).toMatch(/least tested/);
  });

  it('finds the insectary relation between an umbellifer and a nightshade', () => {
    const finding = evaluatePair(tomato, dill).find((f) => f.mechanism === 'beneficialInsectary');
    expect(finding?.evidence).toBe('trial');
  });

  it('respects distance — an insectary planting reaches across beds, a trellis does not', () => {
    expect(MECHANISM_RADIUS_MM.beneficialInsectary).toBeGreaterThan(feet(50));
    expect(MECHANISM_RADIUS_MM.structuralSupport).toBeLessThan(feet(3));

    const faraway = evaluatePair(tomato, dill, { distanceMm: feet(40) });
    expect(faraway.some((f) => f.mechanism === 'beneficialInsectary')).toBe(true);

    const cornFar = evaluatePair(corn, poleBean, { distanceMm: feet(40) });
    expect(cornFar.some((f) => f.mechanism === 'structuralSupport')).toBe(false);
  });

  it('separates sequential relations from concurrent ones', () => {
    const concurrent = evaluatePair(tomato, poleBean, { concurrent: true });
    const sequential = evaluatePair(tomato, poleBean, { concurrent: false });
    expect(concurrent.every((f) => f.concurrency === 'concurrent')).toBe(true);
    expect(sequential.some((f) => f.concurrency === 'sequential')).toBe(true);
  });
});

describe('derivedFindings — the half that needs no table', () => {
  it('flags two nightshades as sharing pests, which is rotation seen sideways', () => {
    const finding = derivedFindings(tomato, pepper).find((f) => f.mechanism === 'sharedPestOrDisease');
    expect(finding?.polarity).toBe('antagonistic');
    expect(finding?.derived).toBe(true);
    expect(finding?.note).toMatch(/Solanaceae/);
  });

  it('flags two heavy feeders competing', () => {
    expect(
      derivedFindings(tomato, varietyById('sweet-corn')!).some(
        (f) => f.mechanism === 'resourceCompetition',
      ),
    ).toBe(true);
  });

  it('calls a tall neighbour shade when the subject wants full sun', () => {
    const carrot = varietyById('carrot')!;
    const finding = derivedFindings(carrot, corn).find((f) => f.mechanism === 'shading');
    expect(finding?.polarity).toBe('antagonistic');
    expect(finding?.note).toMatch(/shade it out/);
  });

  it('does not cry shade over comparable heights', () => {
    // Corn at 7ft does not shade a 6ft tomato. The rule needs a real
    // difference, not merely a taller neighbour.
    expect(derivedFindings(tomato, corn).some((f) => f.mechanism === 'shading')).toBe(false);
  });

  it('calls the same neighbour shelter when the subject prefers part shade', () => {
    const finding = derivedFindings(lettuce, corn).find((f) => f.mechanism === 'nurseShade');
    expect(finding?.polarity).toBe('beneficial');
  });

  it('does not flag a plant against itself', () => {
    expect(derivedFindings(tomato, tomato).some((f) => f.mechanism === 'sharedPestOrDisease')).toBe(false);
  });
});

describe('sortByConfidence', () => {
  it('puts trials first and folklore last, and never ranks your own garden above extension', () => {
    const findings = sortByConfidence(evaluatePair(tomato, dill));
    const tiers = findings.map((f) => f.evidence);
    expect(tiers[0]).toBe('trial');
    expect(EVIDENCE_RANK.yourGarden).toBeGreaterThan(EVIDENCE_RANK.extension);
  });
});

describe('suggestCompanions', () => {
  const box = (have: readonly string[], stale: readonly string[] = []) =>
    (variety: { id: string }): SeedBoxState =>
      have.includes(variety.id) ? 'have' : stale.includes(variety.id) ? 'haveStale' : 'none';

  it('puts what is already in the seed box first', () => {
    // A recommendation you can act on this weekend beats a better one you would
    // have to order and wait for.
    const suggestions = suggestCompanions(tomato, BUNDLED_CATALOG, box(['basil']));
    expect(suggestions[0]?.variety.id).toBe('basil');
    expect(suggestions[0]?.seedBox).toBe('have');
  });

  it('ranks by evidence once the seed box is equal', () => {
    const suggestions = suggestCompanions(tomato, BUNDLED_CATALOG, box([]));
    const first = suggestions[0]!;
    expect(first.findings[0]?.evidence).toBe('trial');
  });

  it('puts a stale packet ahead of one you do not have at all', () => {
    const suggestions = suggestCompanions(tomato, BUNDLED_CATALOG, box([], ['basil']));
    const ids = suggestions.map((s) => s.variety.id);
    const basilIndex = ids.indexOf('basil');
    const noneIndex = suggestions.findIndex((s) => s.seedBox === 'none');
    expect(basilIndex).toBeLessThan(noneIndex);
  });

  it('suggests nothing antagonistic', () => {
    const suggestions = suggestCompanions(tomato, BUNDLED_CATALOG, box([]));
    for (const suggestion of suggestions) {
      expect(suggestion.findings.every((f) => f.polarity === 'beneficial')).toBe(true);
    }
  });

  it('carries the evidence tier on every suggestion, never a bare list', () => {
    const suggestions = suggestCompanions(tomato, BUNDLED_CATALOG, box(['dill']));
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.findings[0]?.evidence).toBeTruthy();
      expect(suggestion.findings[0]?.source.length).toBeGreaterThan(5);
    }
  });
});
