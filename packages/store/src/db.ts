import type { BaseRecord } from './record.js';
import { isLive } from './record.js';

export const DB_NAME = 'gardentrack';
export const DB_VERSION = 1;

/** Every collection the app persists. Adding one is a version bump. */
export const STORES = [
  'sites',
  'beds',
  'obstructions',
  'varieties',
  'seedPackets',
  'plantings',
  'events',
  'photos',
  'tasks',
] as const;

export type StoreName = (typeof STORES)[number];

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function openDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: 'id' });
        // Sync reads changes since a watermark; deleted rows must come too.
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('could not open database'));
  });
}

export class Database {
  constructor(private readonly db: IDBDatabase) {}

  static async open(factory?: IDBFactory): Promise<Database> {
    return new Database(await openDatabase(factory));
  }

  async put<T extends BaseRecord>(store: StoreName, record: T): Promise<T> {
    const tx = this.db.transaction(store, 'readwrite');
    await promisify(tx.objectStore(store).put(record));
    return record;
  }

  async putMany<T extends BaseRecord>(store: StoreName, records: readonly T[]): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    await Promise.all(records.map((record) => promisify(objectStore.put(record))));
  }

  /** Returns undefined for a tombstoned row — callers never see deleted data. */
  async get<T extends BaseRecord>(store: StoreName, id: string): Promise<T | undefined> {
    const tx = this.db.transaction(store, 'readonly');
    const found = await promisify<T | undefined>(tx.objectStore(store).get(id));
    return found !== undefined && isLive(found) ? found : undefined;
  }

  async list<T extends BaseRecord>(store: StoreName): Promise<T[]> {
    const tx = this.db.transaction(store, 'readonly');
    const all = await promisify<T[]>(tx.objectStore(store).getAll());
    return all.filter(isLive);
  }

  /** Includes tombstones on purpose: a deletion is a change to replicate. */
  async changedSince<T extends BaseRecord>(store: StoreName, watermark: number): Promise<T[]> {
    const tx = this.db.transaction(store, 'readonly');
    const index = tx.objectStore(store).index('updatedAt');
    return promisify<T[]>(index.getAll(IDBKeyRange.lowerBound(watermark, true)));
  }

  close(): void {
    this.db.close();
  }
}
