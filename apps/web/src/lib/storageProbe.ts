import { Database, createRecord, type BaseRecord } from '@gardentrack/store';

/**
 * P0-08 — the measurement Phase 0 exists to take.
 *
 * Photos are ~95% of stored bytes, and browser quota and eviction rules are the
 * kind of thing you discover too late. This writes real downscaled images to
 * real IndexedDB and reports what the browser actually does, so the per-photo
 * budget is a number rather than a guess.
 */

export interface PhotoRow extends BaseRecord {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

export interface ProbeResult {
  readonly persisted: boolean;
  readonly quotaBytes: number | null;
  readonly usageBefore: number | null;
  readonly usageAfter: number | null;
  readonly photosWritten: number;
  readonly meanPhotoBytes: number;
  readonly overheadRatio: number | null;
  readonly estimatedPhotoCapacity: number | null;
  readonly writeMsPerPhoto: number;
}

/** A plausible downscaled garden photo: noisy enough not to compress unrealistically. */
export async function makeTestPhoto(longEdge: number, quality: number): Promise<Blob> {
  const width = longEdge;
  const height = Math.round((longEdge * 3) / 4);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2d canvas unavailable');

  const image = ctx.createImageData(width, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor(i / 4 / width);
    // Soil-and-foliage-ish noise. Flat colour would compress to nothing and lie.
    const leaf = Math.sin(px / 9) * Math.cos(py / 7) * 40;
    image.data[i] = 70 + leaf + Math.random() * 45;
    image.data[i + 1] = 95 + leaf + Math.random() * 55;
    image.data[i + 2] = 55 + leaf + Math.random() * 35;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('toBlob failed')) : resolve(blob)),
      'image/jpeg',
      quality,
    );
  });
}

export async function runStorageProbe(
  count = 40,
  longEdge = 1280,
  quality = 0.72,
): Promise<ProbeResult> {
  const persisted = await requestPersisted();
  const before = await estimate();

  const db = await Database.open();
  const photos: PhotoRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const blob = await makeTestPhoto(longEdge, quality);
    photos.push(
      createRecord<PhotoRow>({
        blob,
        width: longEdge,
        height: Math.round((longEdge * 3) / 4),
        bytes: blob.size,
      }),
    );
  }

  const startedAt = performance.now();
  await db.putMany('photos', photos);
  const writeMs = performance.now() - startedAt;

  const after = await estimate();
  db.close();

  const meanPhotoBytes = photos.reduce((sum, p) => sum + p.bytes, 0) / Math.max(photos.length, 1);
  const storedDelta =
    before.usage !== null && after.usage !== null ? after.usage - before.usage : null;
  const rawTotal = meanPhotoBytes * photos.length;
  const overheadRatio = storedDelta !== null && rawTotal > 0 ? storedDelta / rawTotal : null;

  const perPhotoStored = overheadRatio === null ? meanPhotoBytes : meanPhotoBytes * overheadRatio;
  const estimatedPhotoCapacity =
    after.quota !== null && perPhotoStored > 0 ? Math.floor(after.quota / perPhotoStored) : null;

  return {
    persisted,
    quotaBytes: after.quota,
    usageBefore: before.usage,
    usageAfter: after.usage,
    photosWritten: photos.length,
    meanPhotoBytes,
    overheadRatio,
    estimatedPhotoCapacity,
    writeMsPerPhoto: writeMs / Math.max(photos.length, 1),
  };
}

async function estimate(): Promise<{ usage: number | null; quota: number | null }> {
  if (!navigator.storage?.estimate) return { usage: null, quota: null };
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? null, quota: e.quota ?? null };
}

async function requestPersisted(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
