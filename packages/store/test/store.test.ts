import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { isUuidv7 } from '@gardentrack/core';
import { Database, createRecord, merge, softDelete, touch, NotStorableError, type BaseRecord } from '../src/index.js';

interface Bed extends BaseRecord {
  name: string;
  cellMm: number;
}

const makeBed = (name: string, now?: number): Bed =>
  createRecord<Bed>({ name, cellMm: 304.8 }, now);

let db: Database;
beforeEach(async () => {
  db = await Database.open(new IDBFactory());
});

describe('record discipline (D-008)', () => {
  it('stamps a client-generated UUIDv7 and an updatedAt', () => {
    const bed = makeBed('North Raised');
    expect(isUuidv7(bed.id)).toBe(true);
    expect(bed.updatedAt).toBeGreaterThan(0);
    expect(bed.deletedAt).toBeNull();
  });

  it('keeps the id stable across edits', () => {
    const bed = makeBed('North Raised');
    expect(touch(bed, { name: 'North bed' }, bed.updatedAt + 10).id).toBe(bed.id);
  });

  it('resolves a conflict by last write, field-level', () => {
    const mine = makeBed('mine', 1_000);
    const theirs = { ...mine, name: 'theirs', updatedAt: 2_000 };
    expect(merge(mine, theirs).name).toBe('theirs');
    expect(merge(theirs, mine).name).toBe('theirs');
  });
});

describe('Database', () => {
  it('round-trips a record', async () => {
    const bed = await db.put<Bed>('beds', makeBed('North Raised'));
    expect((await db.get<Bed>('beds', bed.id))?.name).toBe('North Raised');
  });

  it('hides tombstoned rows from get and list', async () => {
    const bed = await db.put<Bed>('beds', makeBed('Doomed'));
    await db.put<Bed>('beds', softDelete(bed));
    expect(await db.get<Bed>('beds', bed.id)).toBeUndefined();
    expect(await db.list<Bed>('beds')).toHaveLength(0);
  });

  it('still reports a deletion to sync — a tombstone is a change', async () => {
    const bed = await db.put<Bed>('beds', makeBed('Doomed', 1_000));
    await db.put<Bed>('beds', softDelete(bed, 2_000));
    const changes = await db.changedSince<Bed>('beds', 1_500);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.deletedAt).toBe(2_000);
  });

  it('reports only what changed after the watermark', async () => {
    await db.putMany<Bed>('beds', [makeBed('old', 1_000), makeBed('new', 3_000)]);
    const changes = await db.changedSince<Bed>('beds', 2_000);
    expect(changes.map((b) => b.name)).toEqual(['new']);
  });
});

describe('NotStorableError', () => {
  it('explains a reactive proxy rather than repeating IndexedDB’s DataCloneError', async () => {
    // A Proxy is exactly what Svelte 5 state is, and it cannot be cloned.
    const bed = makeBed('Proxied');
    const proxied = new Proxy(bed, {
      get: (target, key) => Reflect.get(target, key) as unknown,
    });
    await expect(db.put('beds', proxied as typeof bed)).rejects.toBeInstanceOf(NotStorableError);
  });
});
