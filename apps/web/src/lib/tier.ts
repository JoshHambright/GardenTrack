/**
 * Device tiers (D-018). A tier is a *place with a job*, not a screen width:
 * phone captures in the garden, tablet lays out at the potting bench, desktop
 * does bulk work indoors.
 *
 * Width and input are tracked separately on purpose. A touchscreen laptop and a
 * tablet with a trackpad both exist, and conflating the two is the classic
 * responsive bug — it is what broke the scale handles in Spike A.
 */
export type Tier = 'phone' | 'tablet' | 'desktop';

export const TIER_BREAKPOINTS = { tablet: 700, desktop: 1100 } as const;

export function tierForWidth(width: number): Tier {
  if (width >= TIER_BREAKPOINTS.desktop) return 'desktop';
  if (width >= TIER_BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export interface Viewport {
  readonly tier: Tier;
  readonly coarsePointer: boolean;
}

export function readViewport(): Viewport {
  const width = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const coarsePointer =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return { tier: tierForWidth(width), coarsePointer };
}
