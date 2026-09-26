<script lang="ts">
  import {
    boundingBox,
    cellIndexAt,
    classifyOutline,
    effectiveCapacity,
    formatLength,
    gridCells,
    moveSnapped,
    outlineBox,
    parseLength,
    ringPath,
    rotateSnapped,
    samplePolygon,
    scaleFromHandle,
    isDormantOn,
    occupiesOn,
    setDimension,
    setEdgeLength,
    simplify,
    setVertex,
    scaleHandles,
    SNAP_DEFAULT,
    type Box,
    type ScaleHandle,
    type SnapSettings,
    type UnitSystem,
    type Vec,
  } from '@gardentrack/core';
  import type { StoredBed, StoredObstruction, StoredPlanting, StoredSurface } from '@gardentrack/store';
  import type { CellRef, PlainDate, Variety } from '@gardentrack/core';
  import type { Ring } from '@gardentrack/core';
  import type { DrawTool } from './tools.js';
  import Handle from './Handle.svelte';
  import { fitTo, mmPerPixel, toWorld, viewBox, zoomAt, type View } from './viewport.js';

  interface Props {
    beds: StoredBed[];
    obstructions: StoredObstruction[];
    surfaces: StoredSurface[];
    plantings: StoredPlanting[];
    date: PlainDate;
    /** When set, dragging paints cells with this variety instead of panning. */
    paintVariety: Variety | null;
    tool: DrawTool;
    selectedId: string | null;
    snap: SnapSettings;
    units: UnitSystem;
    reshape: boolean;
    selectedObstructionId: string | null;
    onselect: (id: string | null) => void;
    onselectobstruction: (id: string | null) => void;
    onchange: (bed: StoredBed) => void;
    oncommit: (bed: StoredBed) => void;
    ondraw: (tool: Exclude<DrawTool, 'select'>, ring: Ring) => void;
    onpaint: (bedId: string, cells: readonly CellRef[]) => void;
  }

  let {
    beds,
    obstructions,
    surfaces,
    plantings,
    date,
    paintVariety,
    tool,
    selectedId,
    selectedObstructionId,
    snap = SNAP_DEFAULT,
    units,
    reshape,
    onselect,
    onselectobstruction,
    onchange,
    oncommit,
    ondraw,
    onpaint,
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
  let stroke: Vec[] = $state([]);
  let editingChip: Chip | null = $state(null);
  let edgeValue = $state('');
  let edgePopover: { x: number; y: number } | null = $state(null);
  let painting: { bedId: string; cells: Map<string, CellRef> } | null = $state(null);

  const livePlantings = $derived(plantings.filter((p) => occupiesOn(p, date)));

  function plantingsFor(bedId: string): StoredPlanting[] {
    return livePlantings.filter((p) => p.bedId === bedId);
  }

  /** Paint uses the same lattice the cells are rendered from, so the two
   *  cannot disagree about which square was touched. */
  function cellUnder(bed: StoredBed, world: Vec): CellRef | null {
    return cellIndexAt(samplePolygon(bed.outline), {
      cellMm: bed.cellMm,
      rotationDeg: bed.gridRotationDeg,
    }, world);
  }

  function extendPaint(world: Vec): void {
    if (painting === null) return;
    const bed = beds.find((b) => b.id === painting?.bedId);
    if (bed === undefined) return;
    const cell = cellUnder(bed, world);
    if (cell === null) return;
    const key = `${cell.col}:${cell.row}`;
    if (painting.cells.has(key)) return;
    painting.cells.set(key, cell);
    painting = { ...painting };
  }
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
    if (tool !== 'select') {
      if (svg === undefined) return;
      stroke = [toWorld(svg, event.clientX, event.clientY)];
      return;
    }
    if (drag === null) {
      onselect(null);
      onselectobstruction(null);
      closeEdgeEditor();
      beginPan(event);
    }
  }

  function onBedPointerDown(event: PointerEvent, bed: StoredBed): void {
    event.stopPropagation();
    svg?.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (paintVariety !== null && bed.layoutMode === 'grid' && svg !== undefined) {
      painting = { bedId: bed.id, cells: new Map() };
      extendPaint(toWorld(svg, event.clientX, event.clientY));
      return;
    }
    onselect(bed.id);
    onselectobstruction(null);
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
    if (painting !== null && svg !== undefined) {
      extendPaint(toWorld(svg, event.clientX, event.clientY));
      return;
    }
    if (stroke.length > 0 && svg !== undefined) {
      stroke = [...stroke, toWorld(svg, event.clientX, event.clientY)];
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

    if (painting !== null) {
      const finished = painting;
      painting = null;
      if (finished.cells.size > 0) onpaint(finished.bedId, [...finished.cells.values()]);
      return;
    }

    if (stroke.length > 0) {
      const drawn = stroke;
      stroke = [];
      // Simplify at a fixed screen distance, so the tolerance feels the same
      // however far you are zoomed in.
      const simplified = simplify(drawn, 9 * mmPerPx);
      if (simplified.length >= 3 && tool !== 'select') {
        ondraw(tool, { points: simplified, curved: true });
      }
      return;
    }
    const finished = drag;
    drag = null;
    readout = '';
    if (finished !== null && finished.mode !== 'pan') {
      const latest = beds.find((b) => b.id === finished.bed.id);
      if (latest !== undefined) oncommit(latest);
    }
  }

  /**
   * A chip is an editable *dimension*, not a polygon segment — which is not the
   * same thing, and conflating them gets both cases wrong:
   *
   * - a curved bed has no edges at all, only spline control points, so offering
   *   to set the "length" of one would edit something meaningless;
   * - a rounded metal bed has 28 points and four of them are edges, so per-point
   *   chips would bury the two numbers anyone actually wants.
   *
   * So: real edges where the outline has them, overall width and height where it
   * doesn't.
   */
  type Chip =
    | { kind: 'edge'; index: number; at: Vec; normal: Vec; length: number }
    | { kind: 'axis'; axis: 'w' | 'h'; at: Vec; normal: Vec; length: number };

  function chipsFor(bed: StoredBed, box: Box): Chip[] {
    const outline = classifyOutline(bed.outline);
    const points = bed.outline.points;
    const perEdge =
      (outline.kind === 'rectangle' || outline.kind === 'polygon') && points.length <= 12;

    if (perEdge) {
      const chips: Chip[] = [];
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        if (a === undefined || b === undefined) continue;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length <= 26 * mmPerPx) continue;
        chips.push({
          kind: 'edge',
          index,
          at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          normal: { x: -(b.y - a.y) / length, y: (b.x - a.x) / length },
          length,
        });
      }
      return chips;
    }

    return [
      {
        kind: 'axis',
        axis: 'w',
        at: { x: (box.x0 + box.x1) / 2, y: box.y1 },
        normal: { x: 0, y: 1 },
        length: box.x1 - box.x0,
      },
      {
        kind: 'axis',
        axis: 'h',
        at: { x: box.x0, y: (box.y0 + box.y1) / 2 },
        normal: { x: -1, y: 0 },
        length: box.y1 - box.y0,
      },
    ];
  }

  function openEdgeEditor(chip: Chip, event: PointerEvent): void {
    event.stopPropagation();
    if (selected === null || host === undefined) return;
    editingChip = chip;
    edgeValue = formatLength(chip.length, units).replace(/[′″]/g, (m) => (m === '′' ? "'" : '"'));
    const rect = host.getBoundingClientRect();
    edgePopover = {
      x: Math.min(Math.max(event.clientX - rect.left - 80, 8), rect.width - 200),
      y: Math.min(Math.max(event.clientY - rect.top - 56, 8), rect.height - 60),
    };
  }

  function closeEdgeEditor(): void {
    editingChip = null;
    edgePopover = null;
  }

  function applyEdgeLength(): void {
    if (selected === null || editingChip === null) return;
    const wanted = parseLength(edgeValue, units);
    // Reject rather than guess: a silently wrong bed dimension is worse than a
    // rejected one, and this number feeds the spacing maths.
    if (wanted === null || wanted < 25) {
      closeEdgeEditor();
      return;
    }
    const chip = editingChip;
    const outline =
      chip.kind === 'edge'
        ? setEdgeLength(selected.outline, chip.index, wanted)
        : { ...selected.outline, points: setDimension(selected.outline.points, chip.axis, wanted) };
    closeEdgeEditor();
    onchange({ ...selected, outline });
    oncommit({ ...selected, outline });
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
    class:drawing={tool !== 'select'}
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

    {#each surfaces as surface (surface.id)}
      <path d={ringPath(surface.outline)} class="surface {surface.kind}" />
    {/each}

    {#each obstructions as obstruction (obstruction.id)}
      <path
        d={ringPath(obstruction.outline)}
        class="obstruction"
        class:selected={obstruction.id === selectedObstructionId}
        role="button"
        tabindex="0"
        aria-label={obstruction.name}
        onpointerdown={(event) => {
          event.stopPropagation();
          onselectobstruction(obstruction.id);
          onselect(null);
        }}
      />
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
      {#each plantingsFor(bed.id) as planting (planting.id)}
        {@const dormant = isDormantOn(planting, date)}
        {#if planting.footprint.mode === 'cells'}
          {@const cells = cellsFor(bed)}
          <g
            transform="rotate({bed.gridRotationDeg} {(box.x0 + box.x1) / 2} {(box.y0 + box.y1) / 2})"
            class="planting"
            class:dormant
          >
            {#each planting.footprint.cells as ref (`${ref.col}:${ref.row}`)}
              {@const cell = cells.find((c) => c.col === ref.col && c.row === ref.row)}
              {#if cell}
                <rect
                  x={cell.box.x0 + (cell.box.x1 - cell.box.x0) * 0.12}
                  y={cell.box.y0 + (cell.box.y1 - cell.box.y0) * 0.12}
                  width={(cell.box.x1 - cell.box.x0) * 0.76}
                  height={(cell.box.y1 - cell.box.y0) * 0.76}
                  rx={(cell.box.x1 - cell.box.x0) * 0.1}
                  class="plantcell"
                />
              {/if}
            {/each}
          </g>
        {:else if planting.footprint.mode === 'drift'}
          <path
            d={ringPath(planting.footprint.ring)}
            class="drift"
            class:dormant
          />
        {:else}
          <circle
            cx={planting.footprint.x}
            cy={planting.footprint.y}
            r={planting.footprint.radiusMm}
            class="specimen"
            class:dormant
          />
        {/if}
      {/each}

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
      {#if !reshape}
        {#each chipsFor(selected, selectedBox) as chip, i (`${chip.kind}-${i}`)}
          {@const label = formatLength(chip.length, units)}
          {@const cxp = chip.at.x + chip.normal.x * 17 * mmPerPx}
          {@const cyp = chip.at.y + chip.normal.y * 17 * mmPerPx}
          <g
            class="edgechip"
            role="button"
            tabindex="0"
            aria-label={`Set ${chip.kind === 'axis' ? (chip.axis === 'w' ? 'width' : 'height') : `edge ${chip.index + 1}`}, currently ${label}`}
            onpointerdown={(event) => openEdgeEditor(chip, event)}
          >
            <rect
              x={cxp - (label.length * 6.6 + 12) * mmPerPx * 0.5}
              y={cyp - 11 * mmPerPx}
              width={(label.length * 6.6 + 12) * mmPerPx}
              height={22 * mmPerPx}
              rx={3 * mmPerPx}
              class="chipbox"
            />
            <text x={cxp} y={cyp + 4 * mmPerPx} class="chiptext" text-anchor="middle" font-size={11 * mmPerPx}
              >{label}</text
            >
          </g>
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
    {#if painting !== null}
      {@const bed = beds.find((b) => b.id === painting?.bedId)}
      {#if bed}
        {@const cells = cellsFor(bed)}
        {@const pbox = outlineBox(bed.outline)}
        <g transform="rotate({bed.gridRotationDeg} {(pbox.x0 + pbox.x1) / 2} {(pbox.y0 + pbox.y1) / 2})">
          {#each [...painting.cells.values()] as ref (`${ref.col}:${ref.row}`)}
            {@const cell = cells.find((c) => c.col === ref.col && c.row === ref.row)}
            {#if cell}
              <rect
                x={cell.box.x0}
                y={cell.box.y0}
                width={cell.box.x1 - cell.box.x0}
                height={cell.box.y1 - cell.box.y0}
                class="paint"
              />
            {/if}
          {/each}
        </g>
      {/if}
    {/if}
    {#if stroke.length > 1}
      <path d={`M ${stroke.map((p) => `${p.x} ${p.y}`).join(' L ')}`} class="stroke" />
    {/if}
  </svg>

  {#if edgePopover !== null}
    <div class="edgeedit" style="left:{edgePopover.x}px; top:{edgePopover.y}px">
      <input
        class="mono"
        bind:value={edgeValue}
        inputmode="decimal"
        aria-label="Edge length"
        onkeydown={(event) => {
          if (event.key === 'Enter') applyEdgeLength();
          if (event.key === 'Escape') closeEdgeEditor();
        }}
      />
      <button type="button" onclick={applyEdgeLength}>Set</button>
    </div>
  {/if}

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
      {#if !selected.dimensionsVerified}
        <span class="estimate" title="Nothing has been measured yet">estimated</span>
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
  /* While a draw tool is live the stroke must be able to start anywhere,
     including on top of a bed — otherwise the bed's own handler grabs it and
     you move a bed when you meant to draw. */
  svg.drawing .bed,
  svg.drawing .obstruction,
  svg.drawing .edgechip {
    pointer-events: none;
  }
  svg.drawing {
    cursor: crosshair;
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
    cursor: pointer;
  }
  .obstruction.selected {
    stroke: var(--accent);
    stroke-width: 2.5px;
  }
  .plantcell {
    fill: var(--plant);
    fill-opacity: 0.55;
    pointer-events: none;
  }
  .drift {
    fill: var(--plant);
    fill-opacity: 0.18;
    stroke: var(--plant);
    stroke-width: 1.5px;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .specimen {
    fill: var(--plant);
    fill-opacity: 0.2;
    stroke: var(--plant);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  /* Dormant is a drawing state, never an occupancy one (D-036). The ground is
     still taken; it just does not look it, which is the whole problem. */
  .dormant {
    fill-opacity: 0.12;
    stroke-dasharray: 3 5;
  }
  .paint {
    fill: var(--accent);
    fill-opacity: 0.45;
    stroke: var(--accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
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
  .measure .estimate {
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 20px;
    padding: 0 8px;
    font-size: 11.5px;
  }
  .surface {
    stroke: none;
    pointer-events: none;
  }
  .surface.gravel {
    fill: var(--panel-2);
  }
  .surface.mulch {
    fill: var(--warn);
    fill-opacity: 0.16;
  }
  .surface.deck,
  .surface.paver,
  .surface.stone {
    fill: var(--muted);
    fill-opacity: 0.18;
  }
  .surface.grass {
    fill: var(--plant);
    fill-opacity: 0.1;
  }
  .stroke {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2px;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .chipbox {
    fill: var(--panel);
    stroke: var(--accent);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
  .chiptext {
    font-family: 'IBM Plex Mono', monospace;
    fill: var(--accent-ink);
    pointer-events: none;
  }
  .edgechip {
    cursor: pointer;
  }
  .edgeedit {
    position: absolute;
    z-index: 5;
    display: flex;
    gap: 6px;
    align-items: center;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 7px;
    box-shadow: var(--shadow);
  }
  .edgeedit input {
    inline-size: 96px;
    font: inherit;
    font-size: 13px;
    min-block-size: var(--target);
    padding: 0 8px;
    border: 1px solid var(--rule);
    border-radius: 4px;
    background: var(--ground);
    color: var(--ink);
  }
  .edgeedit button {
    min-block-size: var(--target);
    padding: 0 12px;
    border: 0;
    background: var(--accent);
    color: #fff;
    border-radius: 4px;
    font: inherit;
    cursor: pointer;
  }
</style>
