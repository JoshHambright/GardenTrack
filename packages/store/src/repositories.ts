import type { Bed, Obstruction, Site, Surface } from '@gardentrack/core';
import { Database, type StoreName } from './db.js';
import { createRecord, isLive, softDelete, touch, type BaseRecord, type New } from './record.js';

/**
 * Typed collections over the raw store (P1-05).
 *
 * Beds are archived, never deleted — a removed bed orphans a decade of history
 * (D-019) — and the underlying delete is a tombstone anyway (D-008), so there
 * are two distinct ideas here and both are kept.
 */

export type StoredSite = Site & BaseRecord;
export type StoredBed = Bed & BaseRecord;
export type StoredObstruction = Obstruction & BaseRecord;
export type StoredSurface = Surface & BaseRecord;

class Collection<T extends BaseRecord> {
  constructor(
    private readonly db: Database,
    private readonly store: StoreName,
  ) {}

  create(fields: New<T>, now?: number): T {
    return createRecord<T>(fields, now);
  }

  async save(record: T): Promise<T> {
    return this.db.put<T>(this.store, record);
  }

  async update(record: T, changes: Partial<New<T>>, now?: number): Promise<T> {
    return this.db.put<T>(this.store, touch(record, changes, now));
  }

  async remove(record: T, now?: number): Promise<void> {
    await this.db.put<T>(this.store, softDelete(record, now));
  }

  get(id: string): Promise<T | undefined> {
    return this.db.get<T>(this.store, id);
  }

  list(): Promise<T[]> {
    return this.db.list<T>(this.store);
  }
}

export class Garden {
  readonly sites: Collection<StoredSite>;
  readonly beds: Collection<StoredBed>;
  readonly obstructions: Collection<StoredObstruction>;
  readonly surfaces: Collection<StoredSurface>;

  private constructor(private readonly db: Database) {
    this.sites = new Collection<StoredSite>(db, 'sites');
    this.beds = new Collection<StoredBed>(db, 'beds');
    this.obstructions = new Collection<StoredObstruction>(db, 'obstructions');
    this.surfaces = new Collection<StoredSurface>(db, 'surfaces');
  }

  static async open(factory?: IDBFactory): Promise<Garden> {
    return new Garden(await Database.open(factory));
  }

  /** Archiving keeps the history; only the map stops showing it. */
  async archiveBed(bed: StoredBed, now = Date.now()): Promise<StoredBed> {
    return this.beds.update(bed, { archivedAt: now } as Partial<New<StoredBed>>, now);
  }

  async restoreBed(bed: StoredBed, now = Date.now()): Promise<StoredBed> {
    return this.beds.update(bed, { archivedAt: null } as Partial<New<StoredBed>>, now);
  }

  async activeBeds(siteId: string): Promise<StoredBed[]> {
    const all = await this.beds.list();
    return all.filter((bed) => bed.siteId === siteId && bed.archivedAt === null && isLive(bed));
  }

  async archivedBeds(siteId: string): Promise<StoredBed[]> {
    const all = await this.beds.list();
    return all.filter((bed) => bed.siteId === siteId && bed.archivedAt !== null);
  }

  async activeObstructions(siteId: string): Promise<StoredObstruction[]> {
    const all = await this.obstructions.list();
    return all.filter((o) => o.siteId === siteId && o.archivedAt === null);
  }

  async activeSurfaces(siteId: string): Promise<StoredSurface[]> {
    const all = await this.surfaces.list();
    return all.filter((s) => s.siteId === siteId && s.archivedAt === null);
  }

  async currentSite(): Promise<StoredSite | undefined> {
    const sites = await this.sites.list();
    return sites[0];
  }

  close(): void {
    this.db.close();
  }
}
