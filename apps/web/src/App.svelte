<script lang="ts">
  import { onMount } from 'svelte';
  import { readViewport, type Viewport } from './lib/tier.js';
  import { requestPersistence } from './lib/registerSW.js';
  import { runStorageProbe, type ProbeResult } from './lib/storageProbe.js';
  import { formatLength, feet, gridCells, effectiveCapacity, MM_PER_FOOT } from '@gardentrack/core';

  let viewport: Viewport = $state(readViewport());
  let persisted: boolean | null = $state(null);
  let probe: ProbeResult | null = $state(null);
  let probing = $state(false);
  let probeError: string | null = $state(null);

  // A 4x8 bed through the real clipper — proof the domain package is wired up.
  const demoBed = [
    { x: 0, y: 0 },
    { x: feet(4), y: 0 },
    { x: feet(4), y: feet(8) },
    { x: 0, y: feet(8) },
  ];
  const cells = gridCells(demoBed, { cellMm: MM_PER_FOOT });

  onMount(() => {
    const onResize = () => (viewport = readViewport());
    window.addEventListener('resize', onResize);
    void requestPersistence().then((ok) => (persisted = ok));
    return () => window.removeEventListener('resize', onResize);
  });

  async function probeStorage(): Promise<void> {
    probing = true;
    probeError = null;
    try {
      probe = await runStorageProbe();
    } catch (error) {
      probeError = error instanceof Error ? error.message : String(error);
    } finally {
      probing = false;
    }
  }

  const mb = (bytes: number | null): string =>
    bytes === null ? '—' : `${(bytes / 1_048_576).toFixed(1)} MB`;
</script>

<div class="shell" data-tier={viewport.tier}>
  <header>
    <div class="brand">
      <b>GardenTrack</b>
      <span class="label">Phase 0 · foundation</span>
    </div>
    <div class="tierchip mono">
      {viewport.tier} · {viewport.coarsePointer ? 'touch' : 'pointer'}
    </div>
  </header>

  <nav aria-label="Sections">
    {#each ['Plan', 'Beds', 'Log', 'Seeds'] as section (section)}
      <button type="button" class="navitem" disabled>{section}</button>
    {/each}
  </nav>

  <main>
    <section class="card">
      <span class="label">Domain core</span>
      <p>
        A 4′ × 8′ bed through the real clipper: <b class="mono">{cells.length}</b> cells,
        <b class="mono">{effectiveCapacity(cells).toFixed(1)}</b> effective capacity, longest
        edge <b class="mono">{formatLength(feet(8))}</b>.
      </p>
      <p class="note">
        Shape reaches the app only as a per-cell coverage fraction (D-019), so spacing and
        capacity never learn that beds can be L-shaped.
      </p>
    </section>

    <section class="card">
      <span class="label">Offline storage</span>
      <p>
        Persistent storage:
        <b class="mono" class:good={persisted === true} class:warn={persisted === false}>
          {persisted === null ? 'asking…' : persisted ? 'granted' : 'not granted'}
        </b>
      </p>
      <p class="note">
        Local-first means eviction is data loss (D-002), so the answer is surfaced rather than
        assumed.
      </p>
    </section>

    <section class="card">
      <span class="label">P0-08 · storage measurement</span>
      <p class="note">
        Writes 40 downscaled photos to IndexedDB and reports what this browser actually does.
        Photos are ~95% of stored bytes, so the per-photo budget has to be measured.
      </p>
      <button type="button" class="action" onclick={probeStorage} disabled={probing}>
        {probing ? 'Measuring…' : 'Run the probe'}
      </button>

      {#if probeError}
        <p class="bad mono">{probeError}</p>
      {/if}

      {#if probe}
        <dl class="readout mono">
          <dt>Quota</dt><dd>{mb(probe.quotaBytes)}</dd>
          <dt>Used before</dt><dd>{mb(probe.usageBefore)}</dd>
          <dt>Used after</dt><dd>{mb(probe.usageAfter)}</dd>
          <dt>Mean photo</dt><dd>{(probe.meanPhotoBytes / 1024).toFixed(0)} KB</dd>
          <dt>Storage overhead</dt>
          <dd>{probe.overheadRatio === null ? '—' : `${probe.overheadRatio.toFixed(2)}×`}</dd>
          <dt>Photos that fit</dt>
          <dd>{probe.estimatedPhotoCapacity?.toLocaleString() ?? '—'}</dd>
          <dt>Write time</dt><dd>{probe.writeMsPerPhoto.toFixed(1)} ms each</dd>
        </dl>
      {/if}
    </section>
  </main>
</div>

<style>
  .shell {
    display: grid;
    min-height: 100dvh;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas: 'head' 'main' 'nav';
  }

  header {
    grid-area: head;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--rule);
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }
  .brand b {
    font-size: 16px;
    letter-spacing: -0.01em;
  }
  .tierchip {
    font-size: 12px;
    color: var(--accent-ink);
    background: var(--accent-wash);
    border: 1px solid var(--accent);
    border-radius: 20px;
    padding: 2px 10px;
  }

  nav {
    grid-area: nav;
    display: flex;
    gap: 2px;
    padding: 4px;
    background: var(--panel);
    border-top: 1px solid var(--rule);
  }
  .navitem {
    flex: 1;
    min-height: var(--target);
    border: 0;
    border-radius: var(--radius);
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .navitem:disabled {
    opacity: 0.55;
    cursor: default;
  }

  main {
    grid-area: main;
    overflow: auto;
    display: grid;
    gap: 12px;
    padding: 14px;
    align-content: start;
  }

  .card {
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 13px 15px;
  }
  .card p {
    margin: 8px 0 0;
  }
  .note {
    color: var(--muted);
    font-size: 13px;
  }
  .good {
    color: var(--plant);
  }
  .warn {
    color: var(--warn);
  }
  .bad {
    color: var(--bad);
  }

  .action {
    margin-top: 10px;
    min-height: var(--target);
    padding: 0 16px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: #fff;
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
  }
  .action:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .readout {
    margin: 12px 0 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 5px 14px;
    font-size: 13px;
  }
  .readout dt {
    color: var(--muted);
  }
  .readout dd {
    margin: 0;
    text-align: right;
  }

  /* Tablet: the nav becomes a side rail, content gets two columns. */
  .shell[data-tier='tablet'] {
    grid-template-columns: 148px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'head head' 'nav main';
  }
  .shell[data-tier='tablet'] nav,
  .shell[data-tier='desktop'] nav {
    flex-direction: column;
    border-top: 0;
    border-right: 1px solid var(--rule);
    padding: 8px 6px;
  }
  .shell[data-tier='tablet'] .navitem,
  .shell[data-tier='desktop'] .navitem {
    flex: 0 0 auto;
    text-align: left;
    padding: 0 10px;
  }
  .shell[data-tier='tablet'] main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* Desktop: wider rail, three columns, and it has to earn the width (D-018). */
  .shell[data-tier='desktop'] {
    grid-template-columns: 200px minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'head head' 'nav main';
  }
  .shell[data-tier='desktop'] main {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 18px;
  }
</style>
