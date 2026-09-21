/**
 * UUIDv7 — time-ordered, client-generated (D-008). Autoincrement keys collide
 * the moment a second device exists, and sync is a stated destination.
 */

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  const ms = BigInt(Math.trunc(now));
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  }
  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isUuidv7 = (value: string): boolean => UUID_V7.test(value);

/** Milliseconds encoded in the id. Used for ordering, never for display. */
export function uuidv7Timestamp(id: string): number {
  return Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
