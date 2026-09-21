/**
 * Canonical units are millimetres and grams (D-009). Imperial is a display
 * concern; nothing downstream of this module should know a foot exists.
 */

export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

export type UnitSystem = 'imperial' | 'metric';

export const feet = (n: number): number => n * MM_PER_FOOT;
export const inches = (n: number): number => n * MM_PER_INCH;

/** Format a length for display. Never used for storage or comparison. */
export function formatLength(mm: number, system: UnitSystem = 'imperial'): string {
  if (system === 'metric') {
    return mm >= 1000 ? `${(mm / 1000).toFixed(2).replace(/0$/, '')} m` : `${Math.round(mm / 10)} cm`;
  }
  const totalInches = mm / MM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inch = totalInches - ft * 12;
  // 11.97" should read 1' 0", not 0' 12".
  if (Math.abs(inch - 12) < 0.05) {
    ft += 1;
    inch = 0;
  }
  return `${ft}′ ${inch.toFixed(1).replace(/\.0$/, '')}″`;
}

/**
 * Parse a typed length back to millimetres. Accepts 8', 8ft, 8' 6", 6", 2.5m,
 * 40cm. Returns null rather than guessing — a silently wrong bed dimension is
 * worse than a rejected one.
 */
export function parseLength(input: string, system: UnitSystem = 'imperial'): number | null {
  const text = input.trim().toLowerCase();
  if (text === '') return null;

  if (system === 'metric') {
    const m = /^([\d.]+)\s*(m|cm|mm)?$/.exec(text);
    if (m === null) return null;
    const value = Number.parseFloat(m[1] as string);
    if (!Number.isFinite(value)) return null;
    if (m[2] === 'cm') return value * 10;
    if (m[2] === 'mm') return value;
    return value * 1000;
  }

  const m = /^(?:([\d.]+)\s*(?:'|′|ft|feet)\s*)?(?:([\d.]+)\s*(?:"|″|in|inch|inches)?)?$/.exec(text);
  if (m === null || (m[1] === undefined && m[2] === undefined)) return null;
  const ft = m[1] === undefined ? 0 : Number.parseFloat(m[1]);
  const inch = m[2] === undefined ? 0 : Number.parseFloat(m[2]);
  if (!Number.isFinite(ft) || !Number.isFinite(inch)) return null;
  return ft * MM_PER_FOOT + inch * MM_PER_INCH;
}

export function formatArea(mm2: number, system: UnitSystem = 'imperial'): string {
  if (system === 'metric') return `${(mm2 / 1e6).toFixed(2)} m²`;
  return `${(mm2 / (MM_PER_FOOT * MM_PER_FOOT)).toFixed(1)} sq ft`;
}
