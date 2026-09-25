<script lang="ts">
  import {
    describeSite,
    layoutModeFor,
    TEMPLATES,
    SNAP_DEFAULT,
    type BedPurpose,
    type SnapSettings,
    type UnitSystem,
    type Site,
    type Bed,
  } from '@gardentrack/core';
  import { Garden, type StoredBed, type StoredObstruction, type StoredSite } from '@gardentrack/store';
  import BedMap from './lib/BedMap.svelte';
  import Setup from './lib/Setup.svelte';
  import { readViewport, type Viewport } from './lib/tier.js';
  import { requestPersistence } from './lib/registerSW.js';

  let viewport: Viewport = $state(readViewport());
  let garden: Garden | null = $state(null);
  let site: StoredSite | null = $state(null);
  let beds: StoredBed[] = $state([]);
  let obstructions: StoredObstruction[] = $state([]);
  let selectedId: string | null = $state(null);
  let units: UnitSystem = $state('imperial');
  let snap: SnapSettings = $state(SNAP_DEFAULT);
  let reshape = $state(false);
  let persisted: boolean | null = $state(null);
  let loading = $state(true);
  let map: BedMap | undefined = $state();

  const selected = $derived(beds.find((b) => b.id === selectedId) ?? null);

  $effect(() => {
    const onResize = (): void => void (viewport = readViewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  $effect(() => {
    void (async () => {
      const opened = await Garden.open();
      garden = opened;
      site = (await opened.currentSite()) ?? null;
      if (site !== null) await reload(opened, site.id);
      persisted = await requestPersistence();
      loading = false;
    })();
  });

  async function reload(g: Garden, siteId: string): Promise<void> {
    beds = await g.activeBeds(siteId);
    obstructions = await g.activeObstructions(siteId);
  }

  /**
   * Everything crossing into the store goes through $state.snapshot first.
   * Svelte 5 state is a Proxy, and a Proxy cannot be structured-cloned, so a
   * reactive object handed to IndexedDB fails with a DataCloneError that names
   * nothing useful. The store stays framework-agnostic; this is the boundary.
   */
  async function createSite(fields: Omit<Site, 'id'>): Promise<void> {
    if (garden === null) return;
    site = await garden.sites.save(garden.sites.create($state.snapshot(fields) as never));
    await reload(garden, site.id);
  }

  async function addTemplate(templateId: string): Promise<void> {
    if (garden === null || site === null) return;
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template === undefined) return;
    // Drop each new bed clear of the last so they don't stack.
    const offset = beds.length * 1524;
    const outline = template.build({ x: offset, y: 0 });
    const purpose: BedPurpose = 'annualVeg';
    const fields: Omit<Bed, 'id'> = {
      siteId: site.id,
      name: `${template.label} bed`,
      kind: 'raised',
      purpose,
      layoutMode: layoutModeFor(purpose),
      outline,
      holes: [],
      cellMm: 304.8,
      gridRotationDeg: 0,
      soilNotes: '',
      archivedAt: null,
    };
    const bed = await garden.beds.save(garden.beds.create(fields as never));
    beds = [...beds, bed];
    selectedId = bed.id;
    map?.fit();
  }

  /** Live during a drag — not written until the gesture ends. */
  function previewBed(next: StoredBed): void {
    beds = beds.map((bed) => (bed.id === next.id ? next : bed));
  }

  async function commitBed(next: StoredBed): Promise<void> {
    if (garden === null) return;
    const plain = $state.snapshot(next) as StoredBed;
    const saved = await garden.beds.update(plain, { outline: plain.outline } as never);
    beds = beds.map((bed) => (bed.id === saved.id ? saved : bed));
  }

  async function updateSelected(changes: Partial<Bed>): Promise<void> {
    if (garden === null || selected === null) return;
    const saved = await garden.beds.update(
      $state.snapshot(selected) as StoredBed,
      $state.snapshot(changes) as never,
    );
    beds = beds.map((bed) => (bed.id === saved.id ? saved : bed));
  }

  async function archiveSelected(): Promise<void> {
    if (garden === null || selected === null || site === null) return;
    await garden.archiveBed($state.snapshot(selected) as StoredBed);
    selectedId = null;
    await reload(garden, site.id);
  }
</script>

{#if loading}
  <p class="boot">Opening your garden…</p>
{:else if site === null}
  <Setup oncreate={createSite} />
{:else}
  <div class="shell" data-tier={viewport.tier}>
    <header>
      <div class="brand">
        <b>GardenTrack</b>
        <span class="label">{describeSite(site)}</span>
      </div>
      <div class="controls">
        <div class="seg">
          {#each ['imperial', 'metric'] as system (system)}
            <button
              type="button"
              aria-pressed={units === system}
              onclick={() => (units = system as UnitSystem)}
            >{system === 'imperial' ? 'ft·in' : 'm·cm'}</button>
          {/each}
        </div>
        <button
          type="button"
          class="chip"
          aria-pressed={snap.enabled}
          onclick={() => (snap = { ...snap, enabled: !snap.enabled })}>Assists</button
        >
        <button type="button" class="chip" onclick={() => map?.fit()}>Fit</button>
      </div>
    </header>

    <aside class="rail">
      <span class="label">Add a bed</span>
      {#each TEMPLATES as template (template.id)}
        <button type="button" class="tool" onclick={() => addTemplate(template.id)}>
          <b>{template.label}</b>
          <i>{template.note}</i>
        </button>
      {/each}
      {#if persisted === false}
        <p class="warnbox">
          Storage is not persistent — the browser may evict your garden. Installing to the home
          screen usually fixes it.
        </p>
      {/if}
    </aside>

    <main>
      <BedMap
        bind:this={map}
        {beds}
        {obstructions}
        {selectedId}
        {snap}
        {units}
        {reshape}
        onselect={(id) => {
          selectedId = id;
          if (id === null) reshape = false;
        }}
        onchange={previewBed}
        oncommit={commitBed}
      />
    </main>

    <aside class="inspector">
      {#if selected === null}
        <p class="empty">
          <b>Nothing selected</b>
          Add a bed from the templates, then drag it to move, a square handle to resize, or the
          stem to rotate.
        </p>
      {:else}
        <label class="field">
          <span class="label">Name</span>
          <input
            value={selected.name}
            onchange={(event) => updateSelected({ name: event.currentTarget.value })}
          />
        </label>

        <div class="field">
          <span class="label">Purpose</span>
          <div class="chips">
            {#each ['annualVeg', 'native', 'perennial', 'mixed'] as purpose (purpose)}
              <button
                type="button"
                class="chip"
                aria-pressed={selected.purpose === purpose}
                onclick={() =>
                  updateSelected({
                    purpose: purpose as BedPurpose,
                    layoutMode: layoutModeFor(purpose as BedPurpose),
                  })}>{purpose === 'annualVeg' ? 'annual veg' : purpose}</button
              >
            {/each}
          </div>
          <p class="note">
            {selected.purpose === 'annualVeg'
              ? 'Square-foot grid, clipped to the outline (D-019).'
              : 'Drifts and specimens, no grid — a lattice is the wrong primitive here (D-020).'}
          </p>
        </div>

        <div class="field">
          <span class="label">Editing</span>
          <div class="chips">
            <button type="button" class="chip" aria-pressed={!reshape} onclick={() => (reshape = false)}>
              Move &amp; scale
            </button>
            <button type="button" class="chip" aria-pressed={reshape} onclick={() => (reshape = true)}>
              Reshape corners
            </button>
          </div>
        </div>

        {#if selected.layoutMode === 'grid'}
          <div class="field">
            <span class="label">Grid rotation</span>
            <input
              type="range"
              min="0"
              max="90"
              value={selected.gridRotationDeg}
              oninput={(event) =>
                updateSelected({ gridRotationDeg: Number(event.currentTarget.value) })}
            />
            <p class="note">Independent of the bed's own angle — rows face the sun.</p>
          </div>
        {/if}

        <button type="button" class="danger" onclick={archiveSelected}>Archive bed</button>
        <p class="note">Archived, never deleted — a removed bed orphans its history.</p>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .boot {
    padding: 40px;
    text-align: center;
    color: var(--muted);
  }
  .shell {
    display: grid;
    block-size: 100dvh;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: 'head' 'main' 'rail';
  }
  header {
    grid-area: head;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 14px;
    background: var(--panel);
    border-block-end: 1px solid var(--rule);
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .brand b {
    font-size: 16px;
  }
  .controls {
    display: flex;
    gap: 7px;
    align-items: center;
  }
  .seg {
    display: flex;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: var(--ground);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    padding: 0 10px;
    min-block-size: var(--target);
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--accent);
    color: #fff;
  }
  .chip {
    min-block-size: var(--target);
    padding: 0 12px;
    border: 1px solid var(--rule);
    border-radius: 20px;
    background: var(--ground);
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .chip[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-wash);
    color: var(--accent-ink);
  }
  .rail {
    grid-area: rail;
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    background: var(--panel);
    border-block-start: 1px solid var(--rule);
    overflow-x: auto;
    align-items: center;
  }
  .rail > .label {
    display: none;
  }
  .tool {
    flex: 0 0 auto;
    min-block-size: var(--target);
    padding: 4px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    text-align: start;
  }
  .tool b {
    display: block;
    font-size: 13px;
  }
  .tool i {
    display: none;
  }
  main {
    grid-area: main;
    min-block-size: 0;
  }
  .inspector {
    display: none;
  }
  .field {
    display: grid;
    gap: 6px;
  }
  .field input:not([type]) {
    font: inherit;
    min-block-size: var(--target);
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 12.5px;
  }
  .empty b {
    display: block;
    margin-block-end: 4px;
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
  }
  .warnbox {
    color: var(--warn);
    font-size: 12.5px;
    margin: 0;
  }
  .danger {
    min-block-size: var(--target);
    border: 1px solid var(--rule);
    background: transparent;
    color: var(--bad);
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
    justify-self: start;
    padding: 0 12px;
  }

  /* Tablet and desktop: the rail becomes a side column and the inspector appears. */
  .shell[data-tier='tablet'],
  .shell[data-tier='desktop'] {
    grid-template-columns: 172px minmax(0, 1fr) 300px;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'head head head' 'rail main inspector';
  }
  .shell[data-tier='desktop'] {
    grid-template-columns: 200px minmax(0, 1fr) 330px;
  }
  .shell[data-tier='tablet'] .rail,
  .shell[data-tier='desktop'] .rail {
    flex-direction: column;
    align-items: stretch;
    border-block-start: 0;
    border-inline-end: 1px solid var(--rule);
    overflow-y: auto;
  }
  .shell[data-tier='tablet'] .rail > .label,
  .shell[data-tier='desktop'] .rail > .label {
    display: block;
    padding: 4px 4px 2px;
  }
  .shell[data-tier='tablet'] .tool i,
  .shell[data-tier='desktop'] .tool i {
    display: block;
    font-style: normal;
    font-size: 11.5px;
    color: var(--muted);
  }
  .shell[data-tier='tablet'] .inspector,
  .shell[data-tier='desktop'] .inspector {
    grid-area: inspector;
    display: grid;
    gap: 14px;
    align-content: start;
    padding: 14px;
    background: var(--panel);
    border-inline-start: 1px solid var(--rule);
    overflow-y: auto;
  }
</style>
