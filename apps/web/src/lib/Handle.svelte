<!--
  P1-14 — the handle primitive.

  D-018 says layout follows width and hit targets follow input. Spike A restated
  that rule in its own docs and then drew 12px scale handles that no thumb could
  hit, so resize looked implemented and did nothing. A rule in prose gets broken
  by the first component built against it.

  So the relationship between what you see and what you can hit lives here, once:
  a small visible mark, and a separate transparent pad sized from `pointer:
  coarse`. No caller can get it wrong because no caller decides.
-->
<script lang="ts">
  interface Props {
    /** World position, millimetres. */
    x: number;
    y: number;
    /** World millimetres per CSS pixel, so handles stay a constant screen size. */
    mmPerPx: number;
    kind?: 'scale' | 'vertex' | 'rotate';
    label: string;
    onpick: (event: PointerEvent) => void;
  }

  const { x, y, mmPerPx, kind = 'scale', label, onpick }: Props = $props();

  const coarse = $derived(
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  const visiblePx = $derived(kind === 'vertex' ? (coarse ? 9 : 7) : coarse ? 8 : 6);
  // 48px on touch is the whole point of this component existing.
  const hitPx = $derived(coarse ? 24 : 11);

  const visible = $derived(visiblePx * mmPerPx);
  const hit = $derived(hitPx * mmPerPx);
</script>

{#if kind === 'scale'}
  <rect
    x={x - visible}
    y={y - visible}
    width={visible * 2}
    height={visible * 2}
    rx={1.5 * mmPerPx}
    class="mark scale"
  />
{:else}
  <circle cx={x} cy={y} r={visible} class="mark {kind}" />
{/if}

<rect
  x={x - hit}
  y={y - hit}
  width={hit * 2}
  height={hit * 2}
  class="pad"
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuenow={0}
  onpointerdown={onpick}
/>

<style>
  .mark {
    fill: var(--panel);
    stroke: var(--accent);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .mark.rotate {
    fill: var(--accent);
    stroke: var(--panel);
    stroke-width: 1.5px;
  }
  .pad {
    fill: none;
    pointer-events: all;
    cursor: pointer;
    touch-action: none;
  }
  .pad:focus-visible {
    outline: 2px solid var(--accent);
  }
</style>
