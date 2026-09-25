<script lang="ts">
  import {
    boundingBox,
    classifyOutline,
    effectiveCapacity,
    formatLength,
    gridCells,
    moveSnapped,
    outlineBox,
    ringPath,
    rotateSnapped,
    samplePolygon,
    scaleFromHandle,
    setVertex,
    scaleHandles,
    SNAP_DEFAULT,
    type Box,
    type ScaleHandle,
    type SnapSettings,
    type UnitSystem,
    type Vec,
  } from '@gardentrack/core';
  import type { StoredBed, StoredObstruction } from '@gardentrack/store';
  import Handle from './Handle.svelte';
  import { fitTo, mmPerPixel, toWorld, viewBox, zoomAt, type View } from './viewport.js';

  interface Props {
    beds: StoredBed[];
    obstructions: StoredObstruction[];
    selectedId: string | null;
    snap: SnapSettings;
    units: UnitSystem;
    reshape: boolean;
    onselect: (id: string | null) => void;
    onchange: (bed: StoredBed) => void;
    oncommit: (bed: StoredBed) => void;
  }

  let {
    beds,
    obstructions,
    selectedId,
    snap = SNAP_DEFAULT,
    units,
    reshape,
    onselect,
    onchange,
    oncommit,
  }: Props = $props();

  let svg: SVGSVGElement | undefined = $state();
  let host: HTMLDivElement | undefined = $state();
  let width = $state(800);
  let height = $state(600);
  let view: View = $state({ x: -1000, y: -1000, w: 9000 });

  const aspect = $derived(height / Math.max(width, 1));
  const mmPerPx = $derived(mmPerPixel(view, width));
  const selected = $derived(beds.find((b) => b.id === selectedId) ?? null);
  const selectedBox = $derived<Box | null>(selected === null ? null : outlineBox(selected.outline));
  const shape = $derived(selected === null ? null : classifyOutline(selected.outline));

  type Drag =
    | { mode: 'pan'; startClient: Vec; startView: Vec }
    | { mode: 'move'; bed: StoredBed; start: Vec; origin: readonly Vec[] }
    | { mode: 'scale'; bed: StoredBed; handle: ScaleHandle; box: Box; origin: readonly Vec[] }
    | { mode: 'rotate'; bed: StoredBed; centre: Vec; from: number; origin: readonly Vec[] }
    | { mode: 'vertex'; bed: StoredBed; index: number; liftMm: number };
  let drag: Drag | null = $state(null);
  let readout = $state('');
  const pointers = new Map<number, Vec>();
  let pinch: { distance: number; w: number } | null = null;

  export function fit(): void {
    const boxes = [
      ...beds.map((b) => outlineBox(b.outline)),
      ...obstructions.map((o) => outlineBox(o.outline)),
    ];
    view = fitTo(boxes, aspect, 900);
  }

  $effect(() => {
    if (host === undefined) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  function cellsFor(bed: StoredBed) {
    if (bed.layoutMode !== 'grid') return [];
    return gridCells(samplePolygon(bed.outline), {
      cellMm: bed.cellMm,
      holes: bed.holes.map((h) => samplePolygon(h)),
      rotationDeg: bed.gridRotationDeg,
    });
  }

  function handlePositions(box: Box): ReadonlyArray<readonly [ScaleHandle, number, number]> {
    const pad = 11 * mmPerPx;
    const x0 = box.x0 - pad;
    const y0 = box.y0 - pad;
    const x1 = box.x1 + pad;
    const y1 = box.y1 + pad;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const coarse = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const tight = coarse && Math.min(x1 - x0, y1 - y0) / mmPerPx < 150;
    return tight
      ? scaleHandles.corners.map((h) => [h, h.includes('w') ? x0 : x1, h.includes('n') ? y0 : y1])
      : ([
          ['nw', x0, y0],
          ['n', cx, y0],
          ['ne', x1, y0],
          ['e', x1, cy],
          ['se', x1, y1],
          ['s', cx, y1],
          ['sw', x0, y1],
          ['w', x0, cy],
        ] as const);
  }

  function beginPan(event: PointerEvent): void {
    drag = {
      mode: 'pan',
      startClient: { x: event.clientX, y: event.clientY },
      startView: { x: view.x, y: view.y },
    };
  }

  function onSvgPointerDown(event: PointerEvent): void {
    svg?.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Vec, Vec];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), w: view.w };
      drag = null;
      return;
    }
    if (drag === null) {
      onselect(null);
      beginPan(event);
    }
  }

  function onBedPointerDown(event: PointerEvent, bed: StoredBed): void {
    event.stopPropagation();
    svg?.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    onselect(bed.id);
    if (svg === undefined) return;
    drag = {
      mode: 'move',
      bed,
      start: toWorld(svg, event.clientX, event.clientY),
      origin: bed.outline.points,
    };
  }

  function onScaleDown(event: PointerEvent, handle: ScaleHandle): void {
    event.stopPropagation();
    if (selected === null || selectedBox === null) return;
    svg?.setPointerCapture(event.pointerId);
    drag = { mode: 'scale', bed: selected, handle, box: selectedBox, origin: selected.outline.points };
  }

  function onRotateDown(event: PointerEvent): void {
    event.stopPropagation();
    if (selected === null || selectedBox === null || svg === undefined) return;
    svg.setPointerCapture(event.pointerId);
    const centre = {
      x: (selectedBox.x0 + selectedBox.x1) / 2,
      y: (selectedBox.y0 + selectedBox.y1) / 2,
    };
    const p = toWorld(svg, event.clientX, event.clientY);
    drag = {
      mode: 'rotate',
      bed: selected,
      centre,
      from: Math.atan2(p.y - centre.y, p.x - centre.x),
      origin: selected.outline.points,
    };
  }

  function onVertexDown(event: PointerEvent, index: number): void {
    event.stopPropagation();
    if (selected === null) return;
    svg?.setPointerCapture(event.pointerId);
    // Lift the vertex clear of the finger that is dragging it.
    drag = { mode: 'vertex', bed: selected, index, liftMm: 46 * mmPerPx };
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinch !== null && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [Vec, Vec];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > 4) view = { ...view, w: (pinch.w * pinch.distance) / distance };
      return;
    }
    if (drag === null || svg === undefined) return;
    const world = toWorld(svg, event.clientX, event.clientY);

    if (drag.mode === 'pan') {
      const k = view.w / Math.max(width, 1);
      view = {
        ...view,
        x: drag.startView.x - (event.clientX - drag.startClient.x) * k,
        y: drag.startView.y - (event.clientY - drag.startClient.y) * k,
      };
      return;
    }

    if (drag.mode === 'move') {
      const points = moveSnapped(drag.origin, world.x - drag.start.x, world.y - drag.start.y, snap);
      readout = 'moving';
      onchange({ ...drag.bed, outline: { ...drag.bed.outline, points } });
      return;
    }

    if (drag.mode === 'scale') {
      const result = scaleFromHandle(drag.origin, drag.box, drag.handle, world, snap);
      readout = `${formatLength(result.widthMm, units)} × ${formatLength(result.heightMm, units)}`;
      onchange({ ...drag.bed, outline: { ...drag.bed.outline, points: result.points } });
      return;
    }

    if (drag.mode === 'rotate') {
      const angle =
        ((Math.atan2(world.y - drag.centre.y, world.x - drag.centre.x) - drag.from) * 180) / Math.PI;
      const points = rotateSnapped(drag.origin, drag.centre, angle, snap);
      readout = `${angle > 0 ? '+' : ''}${angle.toFixed(0)}°`;
      onchange({ ...drag.bed, outline: { ...drag.bed.outline, points } });
      return;
    }

    if (drag.mode === 'vertex') {
      // Capture before the closure — `drag` is reactive state and TypeScript
      // cannot know it is still a vertex drag by the time the callback runs.
      const { bed: dragged, index, liftMm } = drag;
      const lifted = { x: world.x, y: world.y - liftMm };
      const bed = beds.find((b) => b.id === dragged.id) ?? dragged;
      onchange({ ...bed, outline: setVertex(bed.outline, index, lifted) });
    }
  }

  function endPointer(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    const finished = drag;
    drag = null;
    readout = '';
    if (finished !== null && finished.mode !== 'pan') {
      const latest = beds.find((b) => b.id === finished.bed.id);
      if (latest !== undefined) oncommit(latest);
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (svg === undefined) return;
    view = zoomAt(view, toWorld(svg, event.clientX, event.clientY), event.deltaY > 0 ? 1.12 : 0.89, aspect);
  }
</script>

<div class="plan" bind:this={host}>
  <svg
    bind:this={svg}
    viewBox={viewBox(view, aspect)}
    role="application"
    aria-label="Garden plan"
    onpointerdown={onSvgPointerDown}
    onpointermove={onPointerMove}
    onpointerup={endPointer}
    onpointercancel={endPointer}
    onwheel={onWheel}
  >
    <defs>
      <pattern id="fineGrid" width="304.8" height="304.8" patternUnits="userSpaceOnUse">
        <path d="M 304.8 0 L 0 0 0 304.8" fill="none" class="gridline fine" />
      </pattern>
      <pattern id="coarseGrid" width="1524" height="1524" patternUnits="userSpaceOnUse">
        <path d="M 1524 0 L 0 0 0 1524" fill="none" class="gridline coarse" />
      </pattern>
    </defs>

    <rect x={view.x} y={view.y} width={view.w} height={view.w * aspect} fill="url(#fineGrid)" />
    <rect x={view.x} y={view.y} width={view.w} height={view.w * aspect} fill="url(#coarseGrid)" />

    {#each obstructions as obstruction (obstruction.id)}
      <path d={ringPath(obstruction.outline)} class="obstruction" />
    {/each}

    {#each beds as bed (bed.id)}
      {@const box = outlineBox(bed.outline)}
      <path
        d={ringPath(bed.outline)}
        class="bed {bed.purpose}"
        class:selected={bed.id === selectedId}
        role="button"
        tabindex="0"
        aria-label={bed.name}
        onpointerdown={(event) => onBedPointerDown(event, bed)}
      />
      {#each bed.holes as hole, index (index)}
        <path d={ringPath(hole)} class="hole" />
      {/each}
      {#if bed.layoutMode === 'grid'}
        {@const cells = cellsFor(bed)}
        <g transform="rotate({bed.gridRotationDeg} {(box.x0 + box.x1) / 2} {(box.y0 + box.y1) / 2})">
          {#each cells as cell (`${cell.col}:${cell.row}`)}
            <rect
              x={cell.box.x0}
              y={cell.box.y0}
              width={cell.box.x1 - cell.box.x0}
              height={cell.box.y1 - cell.box.y0}
              class="cell"
              fill-opacity={cell.coverage >= 0.85 ? 0.09 : 0.04 + cell.coverage * 0.05}
              stroke-opacity={cell.coverage >= 0.3 ? 0.4 : 0.12}
            />
          {/each}
        </g>
      {/if}
      <text
        x={(box.x0 + box.x1) / 2}
        y={box.y0 - 26 * mmPerPx}
        class="bedname"
        text-anchor="middle"
        font-size={12 * mmPerPx}>{bed.name}</text
      >
    {/each}

    {#if selected !== null && selectedBox !== null}
      {@const pad = 11 * mmPerPx}
      {@const cx = (selectedBox.x0 + selectedBox.x1) / 2}
      {#if reshape}
        {#each selected.outline.points as point, index (index)}
          <Handle
            x={point.x}
            y={point.y}
            {mmPerPx}
            kind="vertex"
            label={`Corner ${index + 1} of ${selected.name}`}
            onpick={(event) => onVertexDown(event, index)}
          />
        {/each}
      {:else}
        <rect
          x={selectedBox.x0 - pad}
          y={selectedBox.y0 - pad}
          width={selectedBox.x1 - selectedBox.x0 + pad * 2}
          height={selectedBox.y1 - selectedBox.y0 + pad * 2}
          class="transformBox"
        />
        <line
          x1={cx}
          y1={selectedBox.y0 - pad}
          x2={cx}
          y2={selectedBox.y0 - pad - 30 * mmPerPx}
          class="rotateStem"
        />
        <Handle
          x={cx}
          y={selectedBox.y0 - pad - 30 * mmPerPx}
          {mmPerPx}
          kind="rotate"
          label={`Rotate ${selected.name}`}
          onpick={onRotateDown}
        />
        {#each handlePositions(selectedBox) as [handle, hx, hy] (handle)}
          <Handle
            x={hx}
            y={hy}
            {mmPerPx}
            kind="scale"
            label={`Resize ${selected.name} from ${handle}`}
            onpick={(event) => onScaleDown(event, handle)}
          />
        {/each}
      {/if}
      {#if readout !== ''}
        <text
          x={cx}
          y={selectedBox.y0 - 46 * mmPerPx}
          class="readout"
          text-anchor="middle"
          font-size={13 * mmPerPx}>{readout}</text
        >
      {/if}
    {/if}
  </svg>

  {#if selected !== null && selectedBox !== null}
    <div class="measure mono">
      <b>{selected.name}</b>
      <span>
        {formatLength(selectedBox.x1 - selectedBox.x0, units)} ×
        {formatLength(selectedBox.y1 - selectedBox.y0, units)}
      </span>
      {#if selected.layoutMode === 'grid'}
        <span>{effectiveCapacity(cellsFor(selected)).toFixed(1)} cells</span>
      {/if}
      {#if shape !== null}
        <span class="shape">{shape.kind}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .plan {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    background: var(--ground);
  }
  svg {
    inline-size: 100%;
    block-size: 100%;
    display: block;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }
  .gridline {
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .gridline.fine {
    stroke: var(--rule);
    opacity: 0.55;
  }
  .gridline.coarse {
    stroke: var(--rule);
  }
  .bed {
    fill: var(--panel);
    stroke: var(--accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    cursor: move;
  }
  .bed.native,
  .bed.perennial {
    stroke: var(--plant);
  }
  .bed.selected {
    stroke-width: 2.5px;
  }
  .hole {
    fill: var(--ground);
    stroke: var(--muted);
    stroke-width: 1.2px;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .obstruction {
    fill: var(--panel-2);
    stroke: var(--muted);
    stroke-width: 1.2px;
    vector-effect: non-scaling-stroke;
  }
  .cell {
    fill: var(--accent);
    stroke: var(--accent);
    stroke-width: 0.6px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .transformBox {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1px;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
    opacity: 0.65;
    pointer-events: none;
  }
  .rotateStem {
    stroke: var(--accent);
    stroke-width: 1px;
    stroke-dasharray: 3 3;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .bedname,
  .readout {
    font-family: 'Barlow Condensed', sans-serif;
    fill: var(--muted);
    pointer-events: none;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .readout {
    fill: var(--accent-ink);
    font-family: 'IBM Plex Mono', monospace;
    text-transform: none;
  }
  .measure {
    position: absolute;
    inset-block-end: 12px;
    inset-inline-start: 12px;
    display: flex;
    gap: 14px;
    align-items: baseline;
    background: var(--panel);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 7px 12px;
    font-size: 13px;
    box-shadow: var(--shadow);
    pointer-events: none;
  }
  .measure .shape {
    color: var(--muted);
  }
</style>
