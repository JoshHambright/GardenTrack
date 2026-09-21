import { uuidv7 } from '@gardentrack/core';

/**
 * The three rules that make sync possible later without a migration (D-008):
 * a client-generated UUIDv7, an `updatedAt`, and soft deletes. A hard delete
 * cannot be replicated, so nothing in this app performs one.
 */
export interface BaseRecord {
  readonly id: string;
  updatedAt: number;
  deletedAt: number | null;
}

export type New<T extends BaseRecord> = Omit<T, keyof BaseRecord>;

export function createRecord<T extends BaseRecord>(fields: New<T>, now = Date.now()): T {
  return { ...fields, id: uuidv7(now), updatedAt: now, deletedAt: null } as unknown as T;
}

export function touch<T extends BaseRecord>(record: T, changes: Partial<New<T>>, now = Date.now()): T {
  return { ...record, ...changes, updatedAt: now };
}

/** Tombstone, never removal — see D-008. */
export function softDelete<T extends BaseRecord>(record: T, now = Date.now()): T {
  return { ...record, updatedAt: now, deletedAt: now };
}

export const isLive = <T extends BaseRecord>(record: T): boolean => record.deletedAt === null;

/** Field-level last-write-wins. The right ceiling for one household (D-008). */
export function merge<T extends BaseRecord>(mine: T, theirs: T): T {
  return theirs.updatedAt > mine.updatedAt ? theirs : mine;
}
