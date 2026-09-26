<script lang="ts">
  import { tick } from 'svelte';
  import {
    describeSite,
    formatLength,
    layoutModeFor,
    TEMPLATES,
    SNAP_DEFAULT,
    type BedPurpose,
    type SnapSettings,
    type UnitSystem,
    type Site,
    type Bed,
    type Obstruction,
    type Surface,
    type Ring,
    type ObstructionKind,
    type SeedPacket,
    type Variety,
    type CellRef,
    type PlainDate,
    type Planting,
    type PlacementConflict,
    BUNDLED_CATALOG,
    planSpring,
    placementConflicts,
    checkSpacing,
    suggestCompanions,
    sortByConfidence,
    evaluatePair,
    viabilityOf,
    MECHANISM_LABEL,
    gridCells,
    samplePolygon,
    UnschedulableError,
    varietyById,
    type SeedBoxState,
  } from '@gardentrack/core';
  import {
    Garden,
    type StoredBed,
    type StoredObstruction,
    type StoredSite,
    type StoredSurface,
    type StoredSeedPacket,
    type StoredVariety,
    type StoredPlanting,
  } from '@gardentrack/store';
  import BedMap from './lib/BedMap.svelte';
  import { DRAW_TOOLS, type DrawTool } from './lib/tools.js';
  import { seedFromPhotos } from './lib/seed.js';
  import Catalog from './lib/Catalog.svelte';
  import Seeds from './lib/Seeds.svelte';
  import DateScrubber from './lib/DateScrubber.svelte';
  import Setup from './lib/Setup.svelte';
  import { readViewport, type Viewport } from './lib/tier.js';
  import { requestPersistence } from './lib/registerSW.js';

  let viewport: Viewport = $state(readViewport());
  let garden: Garden | null = $state(null);
  let site: StoredSite | null = $state(null);
  let beds: StoredBed[] = $state([]);
  let obstructions: StoredObstruction[] = $state([]);
  let surfaces: StoredSurface[] = $state([]);
  let tool: DrawTool = $state('select');
  type View = 'plan' | 'plants' | 'seeds';
  let view: View = $state('plan');
  let packets: StoredSeedPacket[] = $state([]);
  let customVarieties: StoredVariety[] = $state([]);
  let plantings: StoredPlanting[] = $state([]);
  let today = new Date().toISOString().slice(0, 10) as PlainDate;
  let planYear = $state(Number(today.slice(0, 4)));
  let date: PlainDate = $state(today);
  let paintVariety: Variety | null = $state(null);
  let pending: { bedId: string; cells: CellRef[]; conflicts: PlacementConflict[] } | null = $state(null);
  let lastPlanted: StoredPlanting | null = $state(null);

  const allVarieties = $derived<Variety[]>([...BUNDLED_CATALOG, ...customVarieties]);
  const varietyFor = (id: string): Variety | undefined => allVarieties.find((v) => v.id === id);

  /** What the seed box says about a variety — the filter that makes a
   *  suggestion actionable this weekend rather than aspirational. */
  function seedBoxOf(variety: Variety): SeedBoxState {
    if (plantings.some((p) => p.varietyId === variety.id && p.seasonYear === planYear)) return 'planted';
    const packet = packets.find((p) => p.varietyId === variety.id);
    if (packet === undefined) return 'none';
    return viabilityOf(packet, variety).status === 'past' ? 'haveStale' : 'have';
  }

  const armedSchedule = $derived.by(() => {
    if (paintVariety === null || site === null) return null;
    try {
      return planSpring(paintVariety, site, planYear);
    } catch (error) {
      return error instanceof UnschedulableError ? { error: error.message } : null;
    }
  });

  const suggestions = $derived(
    paintVariety === null ? [] : suggestCompanions(paintVariety, allVarieties, seedBoxOf).slice(0, 6),
  );
  let selectedId: string | null = $state(null);
  let selectedObstructionId: string | null = $state(null);
  let units: UnitSystem = $state('imperial');
  let snap: SnapSettings = $state(SNAP_DEFAULT);
  let reshape = $state(false);
  let persisted: boolean | null = $state(null);
  let loading = $state(true);
  let map: BedMap | undefined = $state();

  const selected = $derived(beds.find((b) => b.id === selectedId) ?? null);
  const selectedObstruction = $derived(
    obstructions.find((o) => o.id === selectedObstructionId) ?? null,
  );

  const MONTHS = ['—', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  async function updateObstruction(changes: Partial<Obstruction>): Promise<void> {
    if (garden === null || selectedObstruction === null) return;
    const saved = await garden.obstructions.update(
      $state.snapshot(selectedObstruction) as StoredObstruction,
      $state.snapshot(changes) as never,
    );
    obstructions = obstructions.map((o) => (o.id === saved.id ? saved : o));
  }

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
      // Frame the garden on load. Without this a cold launch shows empty grid
      // wherever the default view happens to sit, which reads as data loss.
      await tick();
      map?.fit();
    })();
  });

  async function reload(g: Garden, siteId: string): Promise<void> {
    beds = await g.activeBeds(siteId);
    obstructions = await g.activeObstructions(siteId);
    surfaces = await g.activeSurfaces(siteId);
    packets = await g.packetsInHand();
    plantings = await g.plantingsForSite(siteId);
    customVarieties = await g.customVarieties();
  }

  async function addPacket(variety: Variety): Promise<void> {
    if (garden === null) return;
    const fields: Omit<SeedPacket, 'id'> = {
      varietyId: variety.id,
      form: variety.sowMethod === 'bareRoot' ? 'bareRoot' : 'seed',
      purchasedYear: new Date().getFullYear(),
      usedUpAt: null,
    };
    const saved = await garden.seedPackets.save(garden.seedPackets.create(fields as never));
    packets = [...packets, saved];
    view = 'seeds';
  }

  async function updatePacket(
    packet: StoredSeedPacket,
    changes: Partial<StoredSeedPacket>,
  ): Promise<void> {
    if (garden === null) return;
    const saved = await garden.seedPackets.update(
      $state.snapshot(packet) as StoredSeedPacket,
      $state.snapshot(changes) as never,
    );
    packets = packets.map((p) => (p.id === saved.id ? saved : p));
  }

  async function removePacket(packet: StoredSeedPacket): Promise<void> {
    if (garden === null) return;
    await garden.seedPackets.update(
      $state.snapshot(packet) as StoredSeedPacket,
      { usedUpAt: Date.now() } as never,
    );
    packets = packets.filter((p) => p.id !== packet.id);
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
      dimensionsVerified: false,
      archivedAt: null,
    };
    const bed = await garden.beds.save(garden.beds.create(fields as never));
    beds = [...beds, bed];
    selectedId = bed.id;
    map?.fit();
  }

  /** Lay out an approximate garden from the photos. Every shape is flagged
   *  unverified, so the app says "estimated" until a tape measure says otherwise. */
  async function seed(): Promise<void> {
    if (garden === null || site === null) return;
    const layout = seedFromPhotos(site.id);
    for (const fields of layout.beds) {
      await garden.beds.save(garden.beds.create($state.snapshot(fields) as never));
    }
    for (const fields of layout.obstructions) {
      await garden.obstructions.save(garden.obstructions.create($state.snapshot(fields) as never));
    }
    for (const fields of layout.surfaces) {
      await garden.surfaces.save(garden.surfaces.create($state.snapshot(fields) as never));
    }
    await reload(garden, site.id);
    map?.fit();
  }

  async function handleDraw(drawTool: Exclude<DrawTool, 'select'>, ring: Ring): Promise<void> {
    if (garden === null || site === null) return;
    const plain = $state.snapshot(ring) as Ring;

    if (drawTool === 'surface') {
      const fields: Omit<Surface, 'id'> = {
        siteId: site.id,
        name: 'Surface',
        kind: 'mulch',
        outline: plain,
        archivedAt: null,
      };
      await garden.surfaces.save(garden.surfaces.create(fields as never));
    } else if (drawTool === 'obstruction') {
      const fields: Omit<Obstruction, 'id'> = {
        siteId: site.id,
        name: 'Obstruction',
        kind: 'structure',
        outline: plain,
        heightMm: 1828.8,
        opacity: 0,
        presentFrom: null,
        presentTo: null,
        archivedAt: null,
      };
      await garden.obstructions.save(garden.obstructions.create(fields as never));
    } else if (drawTool === 'hole' && selected !== null) {
      const bed = $state.snapshot(selected) as StoredBed;
      await garden.beds.update(bed, { holes: [...bed.holes, plain] } as never);
    }

    tool = 'select';
    await reload(garden, site.id);
  }

  async function handlePaint(bedId: string, cells: readonly CellRef[]): Promise<void> {
    if (paintVariety === null) return;
    const conflicts = placementConflicts(plantings, bedId, { mode: 'cells', cells }, date);
    if (conflicts.length > 0) {
      pending = { bedId, cells: [...cells], conflicts };
      return;
    }
    await commitPlanting(bedId, cells);
  }

  async function commitPlanting(bedId: string, cells: readonly CellRef[]): Promise<void> {
    if (garden === null || site === null || paintVariety === null) return;
    const variety = paintVariety;
    let schedule;
    try {
      schedule = planSpring(variety, site, planYear);
    } catch {
      return;
    }
    const fields: Omit<Planting, 'id'> = {
      bedId,
      varietyId: variety.id,
      seasonYear: planYear,
      footprint: { mode: 'cells', cells: [...cells] },
      method: variety.sowMethod === 'transplant' ? 'transplant' : 'directSow',
      plannedSowDate: schedule.sow,
      plannedTransplantDate: schedule.transplant ?? undefined,
      plannedFirstHarvest: schedule.firstHarvest,
      plannedEndDate: schedule.end,
      // A herbaceous perennial dies back to the ground and looks like bare soil
      // for five months of the year. Recording that is what lets a conflict say
      // "dormant right now" rather than leaving the gardener to disbelieve it
      // (D-036). Woody plants stay visible, so they get no window.
      ...(variety.lifecycle === 'perennial' || variety.lifecycle === 'bulb'
        ? { dormantFrom: 11, dormantTo: 3 }
        : {}),
      status: 'planned',
      notes: '',
    };
    const saved = await garden.plantings.save(garden.plantings.create($state.snapshot(fields) as never));
    plantings = [...plantings, saved];
    lastPlanted = saved;
    pending = null;
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
        <div class="seg views">
          {#each [['plan', 'Plan'], ['plants', 'Plants'], ['seeds', `Seeds${packets.length ? ` (${packets.length})` : ''}`]] as [id, label] (id)}
            <button type="button" aria-pressed={view === id} onclick={() => (view = id as View)}
              >{label}</button
            >
          {/each}
        </div>
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

    <aside class="rail" class:hidden={view !== 'plan'}>
      <span class="label">Beds</span>
      {#each TEMPLATES.filter((t) => t.group === 'bed') as template (template.id)}
        <button type="button" class="tool" onclick={() => addTemplate(template.id)}>
          <b>{template.label}</b>
          <i>{template.note}</i>
        </button>
      {/each}
      <span class="label">Containers</span>
      {#each TEMPLATES.filter((t) => t.group === 'container') as template (template.id)}
        <button type="button" class="tool" onclick={() => addTemplate(template.id)}>
          <b>{template.label}</b>
          <i>{template.note}</i>
        </button>
      {/each}
      <span class="label">Draw</span>
      {#each DRAW_TOOLS as draw (draw.id)}
        <button
          type="button"
          class="tool"
          aria-pressed={tool === draw.id}
          disabled={draw.id === 'hole' && selected === null}
          onclick={() => (tool = tool === draw.id ? 'select' : draw.id)}
        >
          <b>{draw.label}</b>
          <i>{draw.note}</i>
        </button>
      {/each}
      {#if beds.length === 0}
        <button type="button" class="tool seed" onclick={seed}>
          <b>Seed from photos</b>
          <i>Approximate layout, every shape flagged estimated</i>
        </button>
      {/if}
      {#if persisted === false}
        <p class="warnbox">
          Storage is not persistent — the browser may evict your garden. Installing to the home
          screen usually fixes it.
        </p>
      {/if}
    </aside>

    <main>
      {#if view === 'plants'}
        <Catalog
          {site}
          custom={customVarieties}
          {units}
          onadd={addPacket}
          onplant={(variety) => {
            paintVariety = variety;
            view = 'plan';
          }}
        />
      {:else if view === 'seeds'}
        <Seeds {packets} custom={customVarieties} onupdate={updatePacket} onremove={removePacket} />
      {:else}
      {#if pending !== null}
        <div class="conflict">
          <div>
            <b>Something is already there.</b>
            {#each pending.conflicts as conflict (conflict.with.id)}
              <p>
                {varietyFor(conflict.with.varietyId)?.commonName ?? 'A planting'}
                {#if conflict.dormant}
                  — <b>dormant right now</b>, so the ground looks empty and is not
                {/if}
                {#if conflict.cells}({conflict.cells.length} cells){/if}
              </p>
            {/each}
          </div>
          <div class="cbuttons">
            <button type="button" onclick={() => (pending = null)}>Cancel</button>
            <button
              type="button"
              class="danger"
              onclick={() => pending && commitPlanting(pending.bedId, pending.cells)}
              >Plant anyway</button
            >
          </div>
        </div>
      {/if}
      {#if tool !== 'select'}
        <p class="drawhint">
          Drag on the plan to draw. Nothing snaps — this is a sketch, not a measurement.
          <button type="button" onclick={() => (tool = 'select')}>Cancel</button>
        </p>
      {/if}
      <BedMap
        bind:this={map}
        {beds}
        {obstructions}
        {surfaces}
        {tool}
        {selectedId}
        {selectedObstructionId}
        {snap}
        {units}
        {reshape}
        onselect={(id) => {
          selectedId = id;
          if (id === null) reshape = false;
        }}
        onselectobstruction={(id) => (selectedObstructionId = id)}
        onchange={previewBed}
        oncommit={commitBed}
        ondraw={handleDraw}
        onpaint={handlePaint}
        {plantings}
        {date}
        {paintVariety}
      />
      {/if}
      {#if view === 'plan'}
        <DateScrubber
          {date}
          year={planYear}
          {site}
          onchange={(d) => (date = d)}
          onyear={(y) => {
            planYear = y;
            // Keep the day, move the year — scrubbing into next March should
            // land in next March, not jump to January.
            date = `${y}${date.slice(4)}` as PlainDate;
          }}
        />
      {/if}
    </main>

    <aside class="inspector" class:hidden={view !== 'plan'}>
      {#if paintVariety !== null}
        <div class="field">
          <span class="label">Planting</span>
          <b class="armed">{paintVariety.commonName}</b>
          <p class="note">Drag across cells in an annual bed to place it.</p>
          <button type="button" class="chip" onclick={() => (paintVariety = null)}>Done</button>
        </div>

        {#if armedSchedule !== null && 'sow' in armedSchedule}
          <div class="field">
            <span class="label">Derived schedule · {planYear}</span>
            <dl class="sched mono">
              {#if armedSchedule.startIndoors}
                <div><dt>Start indoors</dt><dd>{armedSchedule.startIndoors}</dd></div>
              {/if}
              <div><dt>{armedSchedule.transplant ? 'Transplant' : 'Sow'}</dt>
                <dd>{armedSchedule.transplant ?? armedSchedule.sow}</dd></div>
              <div><dt>First harvest</dt><dd>{armedSchedule.firstHarvest}</dd></div>
              <div><dt>Ends</dt><dd>{armedSchedule.end ?? 'never — perennial'}</dd></div>
            </dl>
            {#each armedSchedule.notes as note (note)}<p class="note">{note}</p>{/each}
            <p class="note">
              Every date computed from your frost profile at the
              <b>{site.frostRisk}</b> risk level. Nothing was typed.
            </p>
          </div>
        {:else if armedSchedule !== null}
          <p class="note warnbox">{armedSchedule.error}</p>
        {/if}

        {#if suggestions.length > 0}
          <div class="field">
            <span class="label">Plant it near</span>
            <ul class="suggest">
              {#each suggestions as suggestion (suggestion.variety.id)}
                {@const top = suggestion.findings[0]}
                <li>
                  <div class="srow">
                    <b>{suggestion.variety.commonName}</b>
                    <span class="box {suggestion.seedBox}">
                      {suggestion.seedBox === 'have'
                        ? 'in your box'
                        : suggestion.seedBox === 'haveStale'
                          ? 'have, past it'
                          : suggestion.seedBox === 'planted'
                            ? 'already planted'
                            : 'not in your box'}
                    </span>
                  </div>
                  {#if top}
                    <p class="why">
                      {MECHANISM_LABEL[top.mechanism]}
                      <span class="tier {top.evidence}">{top.evidence}</span>
                    </p>
                    <p class="src">{top.note}</p>
                  {/if}
                </li>
              {/each}
            </ul>
            <p class="note">
              Ordered by what's already in your seed box, then by evidence. The tier is on every
              row on purpose — a lot of companion advice has never survived a trial.
            </p>
          </div>
        {/if}
      {:else if selectedObstruction !== null}
        <label class="field">
          <span class="label">Shadow caster</span>
          <input
            value={selectedObstruction.name}
            onchange={(event) => updateObstruction({ name: event.currentTarget.value })}
          />
        </label>

        <div class="field">
          <span class="label">Kind</span>
          <div class="chips">
            {#each ['building', 'fence', 'shed', 'tree', 'shrub', 'shadeCloth', 'structure'] as kind (kind)}
              <button
                type="button"
                class="chip"
                aria-pressed={selectedObstruction.kind === kind}
                onclick={() => updateObstruction({ kind: kind as ObstructionKind })}
                >{kind === 'shadeCloth' ? 'shade cloth' : kind}</button
              >
            {/each}
          </div>
        </div>

        <div class="field">
          <span class="label">Height</span>
          <input
            type="range"
            min="1"
            max="60"
            step="0.5"
            value={selectedObstruction.heightMm / 304.8}
            oninput={(event) =>
              updateObstruction({ heightMm: Number(event.currentTarget.value) * 304.8 })}
          />
          <p class="note mono">{formatLength(selectedObstruction.heightMm, units)}</p>
          <p class="note">Height plus solar position is all Phase 4 needs to cast this shadow.</p>
        </div>

        <div class="field">
          <span class="label">Present</span>
          <div class="months">
            <select
              value={selectedObstruction.presentFrom ?? 0}
              onchange={(event) =>
                updateObstruction({
                  presentFrom: Number(event.currentTarget.value) || null,
                })}
            >
              {#each MONTHS as month, index (month)}<option value={index}>{month}</option>{/each}
            </select>
            <span class="note">to</span>
            <select
              value={selectedObstruction.presentTo ?? 0}
              onchange={(event) =>
                updateObstruction({ presentTo: Number(event.currentTarget.value) || null })}
            >
              {#each MONTHS as month, index (month)}<option value={index}>{month}</option>{/each}
            </select>
          </div>
          <p class="note">
            {selectedObstruction.presentFrom === null
              ? 'Present all year.'
              : 'A window, not a botanical fact — a deciduous canopy and shade cloth over the strawberries want the same field.'}
          </p>
        </div>
      {:else if selected === null}
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

        <div class="field">
          <span class="label">Dimensions</span>
          <button
            type="button"
            class="chip"
            aria-pressed={selected.dimensionsVerified}
            onclick={() => updateSelected({ dimensionsVerified: !selected.dimensionsVerified })}
            >{selected.dimensionsVerified ? 'Measured' : 'Estimated'}</button
          >
          <p class="note">
            {selected.dimensionsVerified
              ? 'A tape measure has been on this. The spacing maths can be trusted.'
              : 'Nobody has measured this yet. Tap once you have, so the plan stops hedging.'}
          </p>
        </div>

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
  .hidden {
    display: none !important;
  }
  .seg.views button {
    font-family: inherit;
    font-size: 13px;
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
    position: relative;
  }
  .drawhint {
    position: absolute;
    z-index: 4;
    inset-block-start: 10px;
    inset-inline: 10px;
    margin: 0;
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    background: var(--accent-wash);
    border: 1px solid var(--accent);
    color: var(--accent-ink);
    border-radius: var(--radius);
    padding: 8px 12px;
    font-size: 13px;
  }
  .armed {
    font-size: 16px;
  }
  .sched {
    display: grid;
    gap: 4px;
    margin: 0;
    font-size: 13px;
  }
  .sched div {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .sched dt {
    color: var(--muted);
  }
  .sched dd {
    margin: 0;
  }
  .suggest {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 7px;
  }
  .suggest li {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 7px 9px;
  }
  .srow {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
  }
  .srow b {
    font-size: 13.5px;
  }
  .box {
    font-size: 11px;
    border-radius: 20px;
    padding: 1px 8px;
    border: 1px solid var(--rule);
    color: var(--muted);
  }
  .box.have {
    border-color: var(--plant);
    color: var(--plant);
  }
  .box.haveStale {
    border-color: var(--warn);
    color: var(--warn);
  }
  .why {
    margin: 4px 0 0;
    font-size: 12.5px;
    display: flex;
    gap: 6px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .tier {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-radius: 20px;
    padding: 0 7px;
    border: 1px solid var(--rule);
    color: var(--muted);
  }
  .tier.trial {
    border-color: var(--plant);
    color: var(--plant);
  }
  .tier.traditional {
    border-color: var(--warn);
    color: var(--warn);
  }
  .src {
    margin: 3px 0 0;
    font-size: 11.5px;
    color: var(--muted);
  }
  .conflict {
    position: absolute;
    z-index: 5;
    inset-block-start: 10px;
    inset-inline: 10px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    background: var(--panel);
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    padding: 10px 13px;
    box-shadow: var(--shadow);
  }
  .conflict p {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .cbuttons {
    display: flex;
    gap: 7px;
  }
  .cbuttons button {
    min-block-size: var(--target);
    padding: 0 13px;
    border: 1px solid var(--rule);
    background: var(--ground);
    color: var(--ink);
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
  }
  .cbuttons .danger {
    border-color: var(--warn);
    color: var(--warn);
  }
  .drawhint button {
    min-block-size: var(--target);
    padding: 0 12px;
    border: 1px solid var(--accent);
    background: var(--panel);
    color: var(--ink);
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
  }
  .tool[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-wash);
  }
  .tool:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .tool.seed {
    border-style: dashed;
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
  .months {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .months select {
    font: inherit;
    min-block-size: var(--target);
    padding: 0 8px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
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
