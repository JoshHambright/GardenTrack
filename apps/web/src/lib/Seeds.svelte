<script lang="ts">
  import {
    BUNDLED_CATALOG,
    viabilityOf,
    type SeedForm,
    type Variety,
  } from '@gardentrack/core';
  import type { StoredSeedPacket, StoredVariety } from '@gardentrack/store';

  interface Props {
    packets: StoredSeedPacket[];
    custom: StoredVariety[];
    onupdate: (packet: StoredSeedPacket, changes: Partial<StoredSeedPacket>) => void;
    onremove: (packet: StoredSeedPacket) => void;
  }
  const { packets, custom, onupdate, onremove }: Props = $props();

  const all = $derived<Variety[]>([...BUNDLED_CATALOG, ...custom]);
  const varietyFor = (id: string): Variety | undefined => all.find((v) => v.id === id);
  const year = new Date().getFullYear();

  const FORMS: readonly SeedForm[] = ['seed', 'bulb', 'tuber', 'rhizome', 'bareRoot', 'plug', 'potted'];

  /** Worst first: the box is read to find what needs replacing. */
  const ORDER: Record<string, number> = { past: 0, test: 1, good: 2, fresh: 3, unknown: 4 };
  const rows = $derived(
    packets
      .map((packet) => {
        const variety = varietyFor(packet.varietyId);
        return {
          packet,
          variety,
          viability:
            variety === undefined
              ? null
              : viabilityOf(packet, variety, year),
        };
      })
      .sort((a, b) => (ORDER[a.viability?.status ?? 'unknown'] ?? 9) - (ORDER[b.viability?.status ?? 'unknown'] ?? 9)),
  );

  const counts = $derived({
    past: rows.filter((r) => r.viability?.status === 'past').length,
    test: rows.filter((r) => r.viability?.status === 'test').length,
  });
</script>

<div class="seeds">
  <header>
    <div>
      <span class="label">Seed box</span>
      <b class="mono">{packets.length} packets</b>
    </div>
    {#if counts.past > 0 || counts.test > 0}
      <p class="summary">
        {#if counts.past > 0}<span class="bad">{counts.past} past it</span>{/if}
        {#if counts.test > 0}<span class="warn">{counts.test} worth testing</span>{/if}
      </p>
    {/if}
  </header>

  <ul>
    {#each rows as row (row.packet.id)}
      <li class={row.viability?.status ?? 'unknown'}>
        <div class="top">
          <div>
            <b>{row.variety?.commonName ?? 'Unknown variety'}</b>
            <span class="meta mono">
              {row.packet.form} · {row.packet.lotYear ?? row.packet.purchasedYear}
              {#if row.viability}· {row.viability.ageYears} yr old{/if}
            </span>
          </div>
          {#if row.viability}
            <span class="status {row.viability.status}">{row.viability.status}</span>
          {/if}
        </div>

        {#if row.viability}<p class="advice">{row.viability.advice}</p>{/if}

        <div class="actions">
          <label class="mini">
            <span>Year</span>
            <input
              type="number"
              value={row.packet.lotYear ?? row.packet.purchasedYear}
              onchange={(e) => onupdate(row.packet, { lotYear: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="mini">
            <span>Form</span>
            <select
              value={row.packet.form}
              onchange={(e) => onupdate(row.packet, { form: e.currentTarget.value as SeedForm })}
            >
              {#each FORMS as form (form)}<option value={form}>{form}</option>{/each}
            </select>
          </label>
          <label class="mini">
            <span>Tested %</span>
            <input
              type="number"
              min="0"
              max="100"
              value={row.packet.germinationTest?.percent ?? ''}
              placeholder="—"
              onchange={(e) => {
                const percent = Number(e.currentTarget.value);
                onupdate(row.packet, {
                  germinationTest: Number.isFinite(percent) && percent > 0 ? { year, percent } : undefined,
                });
              }}
            />
          </label>
          <button type="button" class="drop" onclick={() => onremove(row.packet)}>Used up</button>
        </div>
      </li>
    {/each}
    {#if packets.length === 0}
      <li class="empty">
        <b>Nothing in the box yet</b>
        Add packets from the Plants tab. Viability is computed from the species' typical seed
        life — a recorded germination test always beats that estimate.
      </li>
    {/if}
  </ul>
</div>

<style>
  .seeds {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    block-size: 100%;
    min-block-size: 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 14px;
    background: var(--panel);
    border-block-end: 1px solid var(--rule);
  }
  header b {
    display: block;
    font-size: 15px;
  }
  .summary {
    margin: 0;
    display: flex;
    gap: 12px;
    font-size: 13px;
  }
  .bad {
    color: var(--bad);
  }
  .warn {
    color: var(--warn);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 12px 14px;
    display: grid;
    gap: 9px;
    align-content: start;
    overflow-y: auto;
  }
  li {
    border: 1px solid var(--rule);
    border-inline-start-width: 3px;
    border-radius: var(--radius);
    padding: 10px 13px;
    background: var(--panel);
  }
  li.past {
    border-inline-start-color: var(--bad);
  }
  li.test {
    border-inline-start-color: var(--warn);
  }
  li.good,
  li.fresh {
    border-inline-start-color: var(--plant);
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
  }
  .top b {
    font-size: 14.5px;
  }
  .meta {
    display: block;
    color: var(--muted);
    font-size: 12px;
  }
  .status {
    font-size: 11.5px;
    border-radius: 20px;
    padding: 1px 9px;
    border: 1px solid var(--rule);
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .status.past {
    border-color: var(--bad);
    color: var(--bad);
  }
  .status.test {
    border-color: var(--warn);
    color: var(--warn);
  }
  .status.fresh,
  .status.good {
    border-color: var(--plant);
    color: var(--plant);
  }
  .advice {
    margin: 7px 0 0;
    font-size: 12.5px;
    color: var(--muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: end;
    margin-block-start: 9px;
  }
  .mini {
    display: grid;
    gap: 2px;
    font-size: 11px;
    color: var(--muted);
  }
  .mini input,
  .mini select {
    font: inherit;
    font-size: 13px;
    min-block-size: var(--target);
    inline-size: 92px;
    padding: 0 8px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
  }
  .drop {
    min-block-size: var(--target);
    padding: 0 12px;
    border: 1px solid var(--rule);
    background: transparent;
    color: var(--muted);
    border-radius: var(--radius);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    border-inline-start-color: var(--rule);
  }
  .empty b {
    display: block;
    color: var(--ink);
    margin-block-end: 4px;
  }
</style>
