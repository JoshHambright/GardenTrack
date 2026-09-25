<script lang="ts">
  import {
    BUNDLED_CATALOG,
    filterCatalog,
    formatLength,
    nativeTo,
    NATIVITY_PROVENANCE,
    zoneFit,
    type CatalogFilter,
    type Lifecycle,
    type Moisture,
    type Site,
    type SunRequirement,
    type UnitSystem,
    type Variety,
  } from '@gardentrack/core';
  import type { StoredVariety } from '@gardentrack/store';

  interface Props {
    site: Site;
    custom: StoredVariety[];
    units: UnitSystem;
    onadd: (variety: Variety) => void;
  }
  const { site, custom, units, onadd }: Props = $props();

  let search = $state('');
  let nativeOnly = $state(false);
  let hardyOnly = $state(true);
  let sun: SunRequirement | undefined = $state(undefined);
  let moisture: Moisture | undefined = $state(undefined);
  let lifecycle: Lifecycle | undefined = $state(undefined);

  const all = $derived<Variety[]>([...BUNDLED_CATALOG, ...custom]);
  const filter = $derived<CatalogFilter>({
    search,
    nativeOnly,
    hardyOnly,
    sun,
    moisture,
    lifecycles: lifecycle === undefined ? undefined : [lifecycle],
  });
  const results = $derived(filterCatalog(all, site, filter));

  const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const cycle = (current: string | undefined, options: readonly string[]): string | undefined => {
    const index = current === undefined ? -1 : options.indexOf(current);
    return index + 1 >= options.length ? undefined : options[index + 1];
  };
</script>

<div class="catalog">
  <div class="controls">
    <input
      class="search"
      bind:value={search}
      placeholder="Search {all.length} plants…"
      aria-label="Search the catalog"
    />
    <div class="chips">
      <button type="button" class="chip" aria-pressed={nativeOnly} onclick={() => (nativeOnly = !nativeOnly)}>
        Native here
      </button>
      <button type="button" class="chip" aria-pressed={hardyOnly} onclick={() => (hardyOnly = !hardyOnly)}>
        Survives zone {site.hardinessZone}
      </button>
      <button
        type="button"
        class="chip"
        aria-pressed={sun !== undefined}
        onclick={() => (sun = cycle(sun, ['full', 'partial', 'shade']) as SunRequirement | undefined)}
      >{sun === undefined ? 'Any sun' : `${sun} sun`}</button>
      <button
        type="button"
        class="chip"
        aria-pressed={moisture !== undefined}
        onclick={() => (moisture = cycle(moisture, ['dry', 'medium', 'moist', 'wet']) as Moisture | undefined)}
      >{moisture === undefined ? 'Any moisture' : moisture}</button>
      <button
        type="button"
        class="chip"
        aria-pressed={lifecycle !== undefined}
        onclick={() =>
          (lifecycle = cycle(lifecycle, ['annual', 'biennial', 'perennial', 'shrub', 'tree', 'bulb']) as
            | Lifecycle
            | undefined)}
      >{lifecycle ?? 'Any lifecycle'}</button>
    </div>
    <p class="count mono">{results.length} of {all.length}</p>
  </div>

  <ul class="results">
    {#each results as variety (variety.id)}
      {@const native = nativeTo(variety, site)}
      {@const fit = zoneFit(variety, site.hardinessZone)}
      <li>
        <div class="head">
          <div>
            <b>{variety.commonName}</b>
            {#if variety.scientificName}<i>{variety.scientificName}</i>{/if}
          </div>
          <button type="button" class="chip add" onclick={() => onadd(variety)}>Add seed</button>
        </div>

        <div class="badges">
          {#if native.native && native.region}
            <span class="badge native" title="Claim is relative to a stated region">
              native to {native.region.name}
            </span>
          {/if}
          {#if fit === 'marginal'}
            <span class="badge marginal">marginal here</span>
          {:else if fit === 'tooCold' || fit === 'tooWarm'}
            <span class="badge bad">{fit === 'tooCold' ? 'too cold here' : 'too warm here'}</span>
          {/if}
          <span class="badge">{variety.lifecycle}</span>
          <span class="badge">{variety.sunRequirement} sun</span>
          {#if variety.bloomStartMonth && variety.bloomEndMonth}
            <span class="badge bloom">
              blooms {MONTHS[variety.bloomStartMonth]}–{MONTHS[variety.bloomEndMonth]}
            </span>
          {/if}
          {#if variety.hostGenera.length > 0}
            <span class="badge host">host: {variety.hostGenera.join(', ')}</span>
          {/if}
          {#if variety.isCustom}<span class="badge">yours</span>{/if}
        </div>

        <dl class="facts mono">
          <div><dt>Spacing</dt><dd>{formatLength(variety.spacingMm, units)}</dd></div>
          {#if variety.daysToMaturity}
            <div>
              <dt>Days</dt>
              <dd>{variety.daysToMaturity} from {variety.dtmFrom}</dd>
            </div>
          {/if}
          {#if variety.plantsPerCell}
            <div><dt>Per sq ft</dt><dd>{variety.plantsPerCell}</dd></div>
          {/if}
          <div><dt>Seed life</dt><dd>{variety.seedLongevityYears} yr</dd></div>
        </dl>

        {#if variety.notes}<p class="note">{variety.notes}</p>{/if}
      </li>
    {/each}
    {#if results.length === 0}
      <li class="empty">
        Nothing matches. The bundled catalog is deliberately small and curated —
        add your own variety rather than expecting everything to be here.
      </li>
    {/if}
  </ul>

  <p class="provenance">Nativity: {NATIVITY_PROVENANCE}.</p>
</div>

<style>
  .catalog {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    block-size: 100%;
    min-block-size: 0;
  }
  .controls {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-block-end: 1px solid var(--rule);
    background: var(--panel);
  }
  .search {
    font: inherit;
    min-block-size: var(--target);
    padding: 0 12px;
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
  .chip.add {
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  .count {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .results {
    list-style: none;
    margin: 0;
    padding: 12px 14px;
    overflow-y: auto;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .results li {
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 11px 13px;
    background: var(--panel);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: start;
  }
  .head b {
    font-size: 15px;
  }
  .head i {
    display: block;
    color: var(--muted);
    font-size: 12.5px;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-block-start: 7px;
  }
  .badge {
    font-size: 11.5px;
    border: 1px solid var(--rule);
    border-radius: 20px;
    padding: 1px 9px;
    color: var(--muted);
  }
  .badge.native {
    border-color: var(--plant);
    color: var(--plant);
  }
  .badge.marginal,
  .badge.bad {
    border-color: var(--warn);
    color: var(--warn);
  }
  .badge.bad {
    border-color: var(--bad);
    color: var(--bad);
  }
  .badge.bloom,
  .badge.host {
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin: 9px 0 0;
    font-size: 12.5px;
  }
  .facts div {
    display: flex;
    gap: 6px;
  }
  .facts dt {
    color: var(--muted);
  }
  .facts dd {
    margin: 0;
  }
  .note {
    margin: 8px 0 0;
    font-size: 12.5px;
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
  }
  .provenance {
    margin: 0;
    padding: 9px 14px;
    border-block-start: 1px solid var(--rule);
    background: var(--panel);
    color: var(--muted);
    font-size: 12px;
  }
</style>
