<!--
  The control that makes the time-ranged model visible (D-003).

  A bed is a strip of time, not a snapshot. Drag this and the beds fill and
  empty through the year — a bed turning over mid-summer becomes something you
  watch rather than something you infer from two date fields.
-->
<script lang="ts">
  import { fromMonthDay, makeDate, type PlainDate, type Site } from '@gardentrack/core';

  interface Props {
    date: PlainDate;
    year: number;
    site: Site;
    onchange: (date: PlainDate) => void;
    onyear: (year: number) => void;
  }
  const { date, year, site, onchange, onyear }: Props = $props();

  const dayOf = (d: PlainDate): number => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number];
    return Math.round((Date.UTC(y, m - 1, day) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  };
  const fromDay = (n: number): PlainDate =>
    new Date(Date.UTC(year, 0, Math.min(Math.max(n, 1), 365))).toISOString().slice(0, 10);

  const current = $derived(dayOf(date));
  const key = $derived(site.frostRisk === 'cautious' ? 'p10' : 'p50');
  const lastFrost = $derived(dayOf(fromMonthDay(year, site.frost.lastSpring[key])));
  const firstFrost = $derived(dayOf(fromMonthDay(year, site.frost.firstFall[key])));

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStarts = MONTHS.map((_, i) => dayOf(makeDate(year, i + 1, 1)));

  const label = $derived(
    new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    }),
  );
  const inSeason = $derived(current > lastFrost && current < firstFrost);
</script>

<div class="scrubber">
  <div class="readout">
    <div class="year">
      <button type="button" aria-label="Previous year" onclick={() => onyear(year - 1)}>‹</button>
      <b class="mono">{year}</b>
      <button type="button" aria-label="Next year" onclick={() => onyear(year + 1)}>›</button>
    </div>
    <b class="mono">{label}</b>
    <span class="season {inSeason ? 'in' : 'out'}">
      {inSeason ? 'frost-free' : current <= lastFrost ? 'before last frost' : 'after first frost'}
    </span>
  </div>

  <div class="track">
    <!-- The frost-free window, which is what the whole schedule hangs off. -->
    <div
      class="window"
      style="left:{(lastFrost / 365) * 100}%; width:{((firstFrost - lastFrost) / 365) * 100}%"
    ></div>
    {#each monthStarts as start, i (i)}
      <span class="tick" style="left:{(start / 365) * 100}%"><i>{MONTHS[i]}</i></span>
    {/each}
    <input
      type="range"
      min="1"
      max="365"
      value={current}
      aria-label="Date"
      oninput={(e) => onchange(fromDay(Number(e.currentTarget.value)))}
    />
  </div>

  <div class="jumps">
    {#each [['Last frost', lastFrost], ['Midsummer', 196], ['First frost', firstFrost], ['Today', dayOf(new Date().toISOString().slice(0, 10) as PlainDate)]] as [name, day] (name)}
      <button type="button" onclick={() => onchange(fromDay(day as number))}>{name}</button>
    {/each}
  </div>
</div>

<style>
  .scrubber {
    display: grid;
    gap: 6px;
    padding: 8px 14px 10px;
    background: var(--panel);
    border-block-start: 1px solid var(--rule);
  }
  .readout {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .readout b {
    font-size: 15px;
  }
  /* Perennials are the reason this steps years: a coneflower planted this
     spring is not in the ground last March, and its second spring is the case
     the whole occupancy model exists for. */
  .year {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .year button {
    inline-size: 28px;
    min-block-size: 28px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    line-height: 1;
  }
  .season {
    font-size: 12px;
    border-radius: 20px;
    padding: 1px 9px;
    border: 1px solid var(--rule);
    color: var(--muted);
  }
  .season.in {
    border-color: var(--plant);
    color: var(--plant);
  }
  .track {
    position: relative;
    block-size: 34px;
  }
  .window {
    position: absolute;
    inset-block: 13px auto;
    block-size: 8px;
    background: var(--plant);
    opacity: 0.22;
    border-radius: 4px;
    pointer-events: none;
  }
  .tick {
    position: absolute;
    inset-block-start: 0;
    inline-size: 0;
    border-inline-start: 1px solid var(--rule);
    block-size: 10px;
    pointer-events: none;
  }
  .tick i {
    position: absolute;
    inset-block-start: -2px;
    inset-inline-start: 3px;
    font-style: normal;
    font-size: 9.5px;
    color: var(--muted);
    font-family: 'Barlow Condensed', sans-serif;
    letter-spacing: 0.05em;
  }
  input[type='range'] {
    position: absolute;
    inset-block-end: 0;
    inline-size: 100%;
    margin: 0;
    accent-color: var(--accent);
    min-block-size: var(--target);
  }
  .jumps {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .jumps button {
    min-block-size: 30px;
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: 20px;
    background: var(--ground);
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
</style>
