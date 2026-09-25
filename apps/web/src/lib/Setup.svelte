<!--
  P1-01b / P1-01c — setup without disclosure (D-028).

  Three ways in, in order of how little they give away. There is deliberately no
  address field: resolving an address means sending it to a geocoder, which is
  the exact thing being avoided. The map-pin and device-location routes round in
  memory and show the cell they landed in, so the coarsening is visible rather
  than claimed.
-->
<script lang="ts">
  import {
    cellRadiusMetres,
    coarsen,
    DEFAULT_PRECISION_DEG,
    type FrostRisk,
    type GeoCell,
    type Site,
  } from '@gardentrack/core';

  interface Props {
    oncreate: (site: Omit<Site, 'id'>) => void;
  }
  const { oncreate }: Props = $props();

  let zone = $state('6a');
  let lastSpringP10 = $state('05-13');
  let lastSpringP50 = $state('04-29');
  let firstFallP10 = $state('10-09');
  let firstFallP50 = $state('10-18');
  let frostRisk: FrostRisk = $state('cautious');
  let cell: GeoCell | null = $state(null);
  let locating = $state(false);
  let locationError: string | null = $state(null);

  async function useDeviceLocation(): Promise<void> {
    locating = true;
    locationError = null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15_000 });
      });
      // Rounded here, in memory, before anything is written anywhere.
      cell = coarsen(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      locationError = error instanceof Error ? error.message : 'location unavailable';
    } finally {
      locating = false;
    }
  }

  function create(): void {
    oncreate({
      name: 'Home',
      cell: cell ?? coarsen(0, 0),
      hardinessZone: zone,
      heatZone: null,
      frost: {
        thresholdF: 32,
        lastSpring: { p10: lastSpringP10, p50: lastSpringP50 },
        firstFall: { p10: firstFallP10, p50: firstFallP50 },
        source: 'entered by hand',
      },
      frostRisk,
      regions: [],
      nativeStrictness: 'state',
    });
  }
</script>

<div class="setup">
  <h1>Set up your garden</h1>
  <p class="note">
    GardenTrack never stores where you live. It keeps a coarse cell and your zone, because that
    is all any feature needs.
  </p>

  <section>
    <span class="label">Hardiness zone</span>
    <input bind:value={zone} class="mono" aria-label="Hardiness zone" />
  </section>

  <section>
    <span class="label">Frost dates</span>
    <p class="note">
      A 50% date means half of all years frost after it — the wrong number to set tomatoes out
      on. Both are kept, and you choose which the planner reads.
    </p>
    <div class="grid mono">
      <span></span><span class="label">cautious</span><span class="label">typical</span>
      <span>Last spring</span>
      <input bind:value={lastSpringP10} aria-label="Last spring frost, cautious" />
      <input bind:value={lastSpringP50} aria-label="Last spring frost, typical" />
      <span>First fall</span>
      <input bind:value={firstFallP10} aria-label="First fall frost, cautious" />
      <input bind:value={firstFallP50} aria-label="First fall frost, typical" />
    </div>
    <div class="choice">
      {#each ['cautious', 'typical'] as option (option)}
        <button
          type="button"
          class="chip"
          aria-pressed={frostRisk === option}
          onclick={() => (frostRisk = option as FrostRisk)}>{option}</button
        >
      {/each}
    </div>
  </section>

  <section>
    <span class="label">Location — optional</span>
    <p class="note">
      Only the sun calculations use coordinates, and 0.1° costs a minute or two a day of
      computed sun-hours. Skip this and everything but shadow casting still works.
    </p>
    <button type="button" class="chip" onclick={useDeviceLocation} disabled={locating}>
      {locating ? 'Locating…' : 'Use device location'}
    </button>
    {#if locationError}<p class="bad">{locationError}</p>{/if}
    {#if cell}
      <p class="cellinfo mono">
        Stored as {cell.lat}, {cell.lon} — a {DEFAULT_PRECISION_DEG}° cell, about
        {(cellRadiusMetres(cell) / 1000).toFixed(1)} km across. Your exact position was never
        written down.
      </p>
    {/if}
  </section>

  <button type="button" class="action" onclick={create}>Create my garden</button>
</div>

<style>
  .setup {
    max-inline-size: 62ch;
    margin: 0 auto;
    padding: 24px 16px 48px;
    display: grid;
    gap: 20px;
  }
  h1 {
    margin: 0;
    font-size: 24px;
  }
  section {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
  .bad {
    color: var(--bad);
    font-size: 13px;
    margin: 0;
  }
  input {
    font: inherit;
    min-block-size: var(--target);
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
    inline-size: 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 6px 10px;
    align-items: center;
    font-size: 13px;
  }
  .choice {
    display: flex;
    gap: 6px;
  }
  .chip {
    min-block-size: var(--target);
    padding: 0 14px;
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
  .cellinfo {
    margin: 0;
    font-size: 12.5px;
    color: var(--accent-ink);
    background: var(--accent-wash);
    border-radius: var(--radius);
    padding: 8px 10px;
  }
  .action {
    min-block-size: var(--target);
    padding: 0 18px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
    justify-self: start;
  }
</style>
