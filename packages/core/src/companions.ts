import { feet, inches } from './units.js';
import type { Variety } from './variety.js';

/**
 * Companion planting (D-021, D-022).
 *
 * Two things have to be right here, and neither is the lookup table everyone
 * expects.
 *
 * 1. **Most of what circulates is unverified.** Some is well supported — the
 *    Three Sisters, *Tagetes* against root-knot nematodes, umbellifers feeding
 *    parasitoid wasps, juglone from black walnut. A great deal traces to one
 *    popular book from the 1970s and has never survived a trial. Shipping both
 *    at equal confidence is the category's standard failure, so `evidence` and
 *    `mechanism` are required and always shown.
 * 2. **The reliable half is not a table at all.** Shading, feeder competition,
 *    shared-family pests and spacing conflicts are computed from catalog fields
 *    we already store.
 */

export type Polarity = 'beneficial' | 'antagonistic';

export type Mechanism =
  | 'nitrogenFixation'
  | 'structuralSupport'
  | 'nurseShade'
  | 'livingMulch'
  | 'pestRepellent'
  | 'trapCrop'
  | 'beneficialInsectary'
  | 'nematodeSuppression'
  | 'pollinatorAttraction'
  | 'allelopathy'
  | 'resourceCompetition'
  | 'sharedPestOrDisease'
  | 'shading';

export type Evidence = 'trial' | 'extension' | 'traditional' | 'yourGarden';
export type Concurrency = 'concurrent' | 'sequential';
export type TaxonRank = 'family' | 'genus' | 'species' | 'variety';

export interface TaxonRef {
  readonly rank: TaxonRank;
  readonly id: string;
}

export interface CompanionRelation {
  readonly id: string;
  readonly subject: TaxonRef;
  readonly object: TaxonRef;
  readonly polarity: Polarity;
  readonly mechanism: Mechanism;
  readonly evidence: Evidence;
  readonly concurrency: Concurrency;
  readonly note: string;
  readonly source: string;
}

/**
 * **Radius belongs to the mechanism, not the pair**, because the distances
 * genuinely differ by kind — and one of them crosses bed boundaries, which
 * means companion evaluation is a site-wide query rather than a per-bed one.
 */
export const MECHANISM_RADIUS_MM: Readonly<Record<Mechanism, number>> = {
  allelopathy: feet(50), // black walnut's root zone is measured in tens of feet
  beneficialInsectary: feet(100), // insect flight distance — crosses beds
  pollinatorAttraction: feet(100),
  trapCrop: feet(20), // near, but deliberately not adjacent
  nematodeSuppression: feet(3),
  nitrogenFixation: feet(2),
  structuralSupport: inches(18),
  nurseShade: feet(3),
  livingMulch: feet(2),
  pestRepellent: feet(3),
  resourceCompetition: feet(2),
  sharedPestOrDisease: feet(6),
  shading: feet(12),
};

export const MECHANISM_LABEL: Readonly<Record<Mechanism, string>> = {
  nitrogenFixation: 'fixes nitrogen',
  structuralSupport: 'gives it something to climb',
  nurseShade: 'shelters it from afternoon sun',
  livingMulch: 'covers the ground',
  pestRepellent: 'is said to repel its pests',
  trapCrop: 'draws pests away from it',
  beneficialInsectary: 'feeds the predators that eat its pests',
  nematodeSuppression: 'suppresses root-knot nematodes',
  pollinatorAttraction: 'brings pollinators',
  allelopathy: 'poisons it',
  resourceCompetition: 'competes for the same feed',
  sharedPestOrDisease: 'shares its pests and diseases',
  shading: 'will shade it out',
};

const r = (
  id: string,
  subject: TaxonRef,
  object: TaxonRef,
  polarity: Polarity,
  mechanism: Mechanism,
  evidence: Evidence,
  note: string,
  source: string,
  concurrency: Concurrency = 'concurrent',
): CompanionRelation => ({ id, subject, object, polarity, mechanism, evidence, concurrency, note, source });

const genus = (id: string): TaxonRef => ({ rank: 'genus', id });
const family = (id: string): TaxonRef => ({ rank: 'family', id });
const species = (id: string): TaxonRef => ({ rank: 'species', id });

/**
 * Small on purpose. A hundred sourced relations beat a thousand copied ones, and
 * "we have no data on this pairing" is a legitimate answer.
 */
export const COMPANION_RELATIONS: readonly CompanionRelation[] = [
  r('three-sisters-support', genus('Zea'), genus('Phaseolus'), 'beneficial', 'structuralSupport',
    'extension', 'Corn stalks carry pole beans without a trellis.', 'Three Sisters intercropping, widely documented'),
  r('three-sisters-nitrogen', genus('Phaseolus'), genus('Zea'), 'beneficial', 'nitrogenFixation',
    'extension', 'Beans fix nitrogen the corn is hungry for.', 'Three Sisters intercropping'),
  r('squash-living-mulch', genus('Cucurbita'), genus('Zea'), 'beneficial', 'livingMulch',
    'extension', 'Squash leaves shade the soil and hold moisture.', 'Three Sisters intercropping'),

  r('legume-precedes-heavy', family('Fabaceae'), family('Solanaceae'), 'beneficial', 'nitrogenFixation',
    'extension', 'A legume before a heavy feeder leaves nitrogen behind.', 'Standard rotation practice',
    'sequential'),

  r('umbellifer-insectary', family('Apiaceae'), family('Solanaceae'), 'beneficial', 'beneficialInsectary',
    'trial', 'Umbellifer flowers feed parasitoid wasps and hoverflies that predate aphids and hornworms.',
    'Replicated field studies on floral resources for natural enemies'),
  r('aster-insectary', family('Asteraceae'), family('Brassicaceae'), 'beneficial', 'beneficialInsectary',
    'trial', 'Aster-family flowers provision the same predators.',
    'Replicated field studies on floral resources for natural enemies'),

  r('tagetes-nematode', species('Tagetes patula'), family('Solanaceae'), 'beneficial', 'nematodeSuppression',
    'trial', 'French marigold suppresses root-knot nematodes when grown as a preceding cover, not as a border.',
    'Multiple controlled trials; effect is species- and nematode-specific', 'sequential'),

  r('juglone', genus('Juglans'), family('Solanaceae'), 'antagonistic', 'allelopathy',
    'trial', 'Juglone from black walnut kills tomatoes, peppers and potatoes outright.',
    'Well-characterised allelopathy'),

  r('brassica-allium', family('Brassicaceae'), family('Amaryllidaceae'), 'antagonistic', 'resourceCompetition',
    'traditional', 'Long-repeated advice to keep brassicas and alliums apart. Poorly evidenced.',
    'Folk practice; no replicated trial found'),
  r('basil-tomato', species('Ocimum basilicum'), genus('Solanum'), 'beneficial', 'pestRepellent',
    'traditional', 'The most repeated pairing in gardening, and among the least tested.',
    'Folk practice; trials on hornworm deterrence are equivocal'),
  r('carrot-tomato', genus('Daucus'), genus('Solanum'), 'beneficial', 'pestRepellent',
    'traditional', 'From a popular 1970s book. No trial support located.',
    'Riotte, Carrots Love Tomatoes (1975)'),

  r('fennel-inhibits', genus('Foeniculum'), family('Fabaceae'), 'antagonistic', 'allelopathy',
    'extension', 'Fennel inhibits nearby legumes.', 'Extension guidance, consistent across sources'),
];

/* ------------------------------------------------- taxon resolution */

/** Walk up from a variety to the first taxon the table knows about. */
export function taxaOf(variety: Variety): TaxonRef[] {
  const taxa: TaxonRef[] = [{ rank: 'variety', id: variety.id }];
  if (variety.scientificName !== undefined) taxa.push({ rank: 'species', id: variety.scientificName });
  if (variety.genus !== undefined) taxa.push({ rank: 'genus', id: variety.genus });
  taxa.push({ rank: 'family', id: variety.family });
  return taxa;
}

const matches = (ref: TaxonRef, taxa: readonly TaxonRef[]): boolean =>
  taxa.some((t) => t.rank === ref.rank && t.id === ref.id);

export interface Finding {
  readonly polarity: Polarity;
  readonly mechanism: Mechanism;
  readonly evidence: Evidence;
  readonly concurrency: Concurrency;
  readonly radiusMm: number;
  readonly other: Variety;
  readonly note: string;
  readonly source: string;
  /** True when this came from catalog arithmetic rather than the table. */
  readonly derived: boolean;
}

/**
 * The free half: computed from fields we already store, carrying no folklore
 * risk and more reliable than most of the table.
 */
export function derivedFindings(subject: Variety, other: Variety): Finding[] {
  const findings: Finding[] = [];
  const make = (
    polarity: Polarity,
    mechanism: Mechanism,
    note: string,
    concurrency: Concurrency = 'concurrent',
  ): Finding => ({
    polarity,
    mechanism,
    evidence: 'extension',
    concurrency,
    radiusMm: MECHANISM_RADIUS_MM[mechanism],
    other,
    note,
    source: 'computed from the catalog',
    derived: true,
  });

  // Crop rotation seen sideways: one family in adjacent places in one season.
  if (subject.family === other.family && subject.id !== other.id) {
    findings.push(
      make('antagonistic', 'sharedPestOrDisease',
        `Both are ${subject.family} — same pests, same diseases, and they will find both.`),
    );
  }

  if (subject.feederClass === 'heavy' && other.feederClass === 'heavy') {
    findings.push(make('antagonistic', 'resourceCompetition', 'Two heavy feeders side by side will run the bed down.'));
  }

  if (other.feederClass === 'fixer' && subject.feederClass === 'heavy') {
    findings.push(make('beneficial', 'nitrogenFixation', `${other.commonName} fixes nitrogen that ${subject.commonName} wants.`));
  }

  // An unrecorded mature height is treated as short, which is right for the
  // vegetables it applies to (carrots, lettuce) and is why the rule also
  // requires the neighbour to be genuinely tall rather than merely taller.
  const subjectHeight = subject.matureHeightMm ?? 0;
  const otherHeight = other.matureHeightMm ?? 0;
  if (otherHeight > subjectHeight * 2 && otherHeight > feet(3)) {
    const helpful = subject.sunRequirement !== 'full';
    findings.push(
      helpful
        ? make('beneficial', 'nurseShade', `${other.commonName} will shelter it from afternoon sun, which it prefers.`)
        : make('antagonistic', 'shading', `${other.commonName} grows to ${Math.round(otherHeight / 304.8)}ft and will shade it out.`),
    );
  }

  return findings;
}

export interface EvaluateOptions {
  /** Only report relations whose radius reaches this far. */
  readonly distanceMm?: number | undefined;
  /** False when the two plantings never share the ground at the same time. */
  readonly concurrent?: boolean | undefined;
}

/** Score one variety against a neighbour, table plus arithmetic. */
export function evaluatePair(
  subject: Variety,
  other: Variety,
  options: EvaluateOptions = {},
): Finding[] {
  const subjectTaxa = taxaOf(subject);
  const otherTaxa = taxaOf(other);
  const findings: Finding[] = [...derivedFindings(subject, other)];

  for (const relation of COMPANION_RELATIONS) {
    const forward = matches(relation.object, subjectTaxa) && matches(relation.subject, otherTaxa);
    const backward = matches(relation.subject, subjectTaxa) && matches(relation.object, otherTaxa);
    if (!forward && !backward) continue;
    findings.push({
      polarity: relation.polarity,
      mechanism: relation.mechanism,
      evidence: relation.evidence,
      concurrency: relation.concurrency,
      radiusMm: MECHANISM_RADIUS_MM[relation.mechanism],
      other,
      note: relation.note,
      source: relation.source,
      derived: false,
    });
  }

  return findings.filter((finding) => {
    if (options.distanceMm !== undefined && options.distanceMm > finding.radiusMm) return false;
    if (options.concurrent === false && finding.concurrency === 'concurrent') return false;
    if (options.concurrent === true && finding.concurrency === 'sequential') return false;
    return true;
  });
}

/** Trial first, folklore last — and `yourGarden` never above `extension`. */
export const EVIDENCE_RANK: Readonly<Record<Evidence, number>> = {
  trial: 0,
  extension: 1,
  yourGarden: 2,
  traditional: 3,
};

export const sortByConfidence = (findings: readonly Finding[]): Finding[] =>
  [...findings].sort((a, b) => EVIDENCE_RANK[a.evidence] - EVIDENCE_RANK[b.evidence]);

/* ------------------------------------------------------ suggestions */

export type SeedBoxState = 'have' | 'haveStale' | 'planted' | 'none';

export interface Suggestion {
  readonly variety: Variety;
  readonly findings: readonly Finding[];
  readonly seedBox: SeedBoxState;
}

/**
 * What to plant next to this, ranked so a recommendation you can act on this
 * weekend beats a better one you would have to order and wait for.
 */
export function suggestCompanions(
  subject: Variety,
  candidates: readonly Variety[],
  seedBoxOf: (variety: Variety) => SeedBoxState,
): Suggestion[] {
  const order: Record<SeedBoxState, number> = { have: 0, haveStale: 1, none: 2, planted: 3 };
  return candidates
    .filter((candidate) => candidate.id !== subject.id)
    .map((candidate) => ({
      variety: candidate,
      findings: sortByConfidence(
        evaluatePair(subject, candidate).filter((f) => f.polarity === 'beneficial'),
      ),
      seedBox: seedBoxOf(candidate),
    }))
    .filter((suggestion) => suggestion.findings.length > 0)
    .sort((a, b) => {
      const box = order[a.seedBox] - order[b.seedBox];
      if (box !== 0) return box;
      return (
        EVIDENCE_RANK[a.findings[0]!.evidence] - EVIDENCE_RANK[b.findings[0]!.evidence]
      );
    });
}
