import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { coarsen, feet, layoutModeFor, type Bed, type Site } from '@gardentrack/core';
import { Garden, type StoredBed, type StoredSite } from '../src/repositories.js';

const siteFields = (): Omit<Site, 'id'> => ({
  name: 'Home',
  cell: coarsen(39.4817, -86.0547),
  hardinessZone: '6a',
  heatZone: 6,
  frost: {
    thresholdF: 32,
    lastSpring: { p10: '05-13', p50: '04-29' },
    firstFall: { p10: '10-09', p50: '10-18' },
    source: 'provisional',
  },
  frostRisk: 'cautious',
  regions: [{ kind: 'ecoregion3', code: '55', name: 'Eastern Corn Belt Plains' }],
  nativeStrictness: 'ecoregion',
});

const bedFields = (siteId: string, name: string): Omit<Bed, 'id'> => ({
  siteId,
  name,
  kind: 'raised',
  purpose: 'annualVeg',
  layoutMode: layoutModeFor('annualVeg'),
  outline: {
    points: [
      { x: 0, y: 0 },
      { x: feet(4), y: 0 },
      { x: feet(4), y: feet(8) },
      { x: 0, y: feet(8) },
    ],
    curved: false,
  },
  holes: [],
  cellMm: 304.8,
  gridRotationDeg: 0,
  soilNotes: '',
  archivedAt: null,
});

let garden: Garden;
let site: StoredSite;

beforeEach(async () => {
  garden = await Garden.open(new IDBFactory());
  site = await garden.sites.save(garden.sites.create(siteFields() as never));
});

describe('Garden', () => {
  it('round-trips a site with its coarsened cell intact', async () => {
    const loaded = await garden.currentSite();
    expect(loaded?.cell.lat).toBe(39.5);
    expect(loaded?.cell.method).toBe('rounded');
  });

  it('stores no precise position anywhere in the persisted site', async () => {
    const loaded = await garden.currentSite();
    const json = JSON.stringify(loaded);
    expect(json).not.toContain('39.4817');
    expect(json).not.toContain('86.0547');
  });

  it('lists only this site’s active beds', async () => {
    await garden.beds.save(garden.beds.create(bedFields(site.id, 'North') as never));
    await garden.beds.save(garden.beds.create(bedFields('other-site', 'Elsewhere') as never));
    const beds = await garden.activeBeds(site.id);
    expect(beds.map((b) => b.name)).toEqual(['North']);
  });

  it('archives a bed without losing it', async () => {
    const bed = await garden.beds.save(garden.beds.create(bedFields(site.id, 'Old') as never));
    await garden.archiveBed(bed);

    expect(await garden.activeBeds(site.id)).toHaveLength(0);
    const archived = await garden.archivedBeds(site.id);
    expect(archived).toHaveLength(1);
    // Still fully readable — a deleted bed would orphan a decade of history.
    expect(archived[0]?.outline.points).toHaveLength(4);
  });

  it('restores an archived bed', async () => {
    const bed = await garden.beds.save(garden.beds.create(bedFields(site.id, 'Back') as never));
    await garden.restoreBed(await garden.archiveBed(bed));
    expect(await garden.activeBeds(site.id)).toHaveLength(1);
  });

  it('bumps updatedAt on edit but keeps the id', async () => {
    const bed = await garden.beds.save(garden.beds.create(bedFields(site.id, 'A') as never));
    const renamed = await garden.beds.update(bed, { name: 'B' } as never, bed.updatedAt + 50);
    expect(renamed.id).toBe(bed.id);
    expect(renamed.updatedAt).toBeGreaterThan(bed.updatedAt);
    expect((await garden.beds.get(bed.id) as StoredBed).name).toBe('B');
  });
});
