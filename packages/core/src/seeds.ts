import type { Variety } from './variety.js';

/** What you actually have, as opposed to what exists. */
export type SeedForm = 'seed' | 'bulb' | 'tuber' | 'rhizome' | 'bareRoot' | 'plug' | 'potted';

export interface SeedPacket {
  readonly id: string;
  varietyId: string;
  form: SeedForm;
  vendor?: string | undefined;
  purchasedYear: number;
  /** The year printed on the packet, which is what actually ages. */
  lotYear?: number | undefined;
  quantity?: number | undefined;
  quantityUnit?: string | undefined;
  /** A recorded germination test beats every estimate below. */
  germinationTest?: { readonly year: number; readonly percent: number } | undefined;
  notes?: string | undefined;
  usedUpAt: number | null;
}

export type ViabilityStatus = 'fresh' | 'good' | 'test' | 'past' | 'unknown';

export interface Viability {
  readonly status: ViabilityStatus;
  readonly ageYears: number;
  readonly longevityYears: number;
  /** Only ever from a recorded test — never an invented number. */
  readonly testedPercent: number | null;
  readonly advice: string;
}

/**
 * How much life is left in a packet.
 *
 * Deliberately **not** a predicted germination percentage. Seed decline depends
 * on storage humidity and temperature far more than on age, so a confident
 * "62% viable" would be a fabrication dressed as data — the same failure as an
 * untiered companion table (D-021). What the app knows is the species' typical
 * longevity and the packet's age; what it does not know, it says.
 */
export function viabilityOf(
  packet: SeedPacket,
  variety: Pick<Variety, 'seedLongevityYears'>,
  currentYear: number = new Date().getFullYear(),
): Viability {
  const longevity = Math.max(variety.seedLongevityYears, 0.5);
  const base = packet.lotYear ?? packet.purchasedYear;
  const age = Math.max(currentYear - base, 0);

  if (packet.germinationTest !== undefined) {
    const percent = packet.germinationTest.percent;
    return {
      status: percent >= 70 ? 'good' : percent >= 40 ? 'test' : 'past',
      ageYears: age,
      longevityYears: longevity,
      testedPercent: percent,
      advice:
        percent >= 70
          ? `Tested ${percent}% in ${packet.germinationTest.year} — sow normally.`
          : percent >= 40
            ? `Tested ${percent}% — sow thickly and expect gaps.`
            : `Tested ${percent}% — replace it.`,
    };
  }

  const ratio = age / longevity;
  const status: ViabilityStatus =
    ratio <= 0.5 ? 'fresh' : ratio <= 1 ? 'good' : ratio <= 1.5 ? 'test' : 'past';

  const advice: Record<Exclude<ViabilityStatus, 'unknown'>, string> = {
    fresh: 'Well within its typical life.',
    good: 'Near the end of its typical life — sow a little thicker.',
    test: `Past the ${longevity}-year mark for this species. Run a germination test before you plan around it.`,
    past: `Well past the ${longevity}-year mark. Test it or replace it; do not plan a bed around it.`,
  };

  return {
    status,
    ageYears: age,
    longevityYears: longevity,
    testedPercent: null,
    advice: advice[status],
  };
}

export const isUsable = (v: Viability): boolean => v.status !== 'past';
