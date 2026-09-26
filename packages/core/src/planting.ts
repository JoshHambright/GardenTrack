import { polygonArea, type Vec } from './geometry.js';
import { samplePolygon, type Ring } from './spline.js';
import { withinRange, type PlainDate } from './dates.js';
import { isPerennial } from './schedule.js';
import type { Bed } from './model.js';
import type { Variety } from './variety.js';

/**
 * A Planting is `{ variety, bed, footprint, dateRange }` — an instance of a
 * variety occupying a place for a span of time (D-003). A span, not a point.
 */

export interface CellRef {
  readonly col: number;
  readonly row: number;
}

export type Footprint =
  | { readonly mode: 'cells'; readonly cells: readonly CellRef[] }
  | { readonly mode: 'drift'; readonly ring: Ring; readonly count: number; readonly spacingMm: number }
  | { readonly mode: 'point'; readonly x: number; readonly y: number; readonly radiusMm: number };

export type PlantingStatus =
  | 'planned'
  | 'sown'
  | 'germinated'
  | 'transplanted'
  | 'growing'
  | 'harvesting'
  | 'established'
  | 'dormant'
  | 'finished'
  | 'failed';

export type PlantingMethod =
  | 'directSow'
  | 'transplant'
  | 'purchasedStart'
  | 'bulbPlant'
  | 'bareRoot'
  | 'division';

export interface Planting {
  readonly id: string;
  bedId: string;
  varietyId: string;
  seedPacketId?: string | undefined;
  seasonYear: number;
  footprint: Footprint;
  method: PlantingMethod;

  /** Planned and actual are separate on purpose — comparing them is the learning. */
  plannedSowDate: PlainDate;
  plannedTransplantDate?: PlainDate | undefined;
  plannedFirstHarvest?: PlainDate | undefined;
  /** Null means perennial: this bed never frees up. */
  plannedEndDate: PlainDate | null;

  actualSowDate?: PlainDate | undefined;
  actualTransplantDate?: PlainDate | undefined;
  actualFirstHarvest?: PlainDate | undefined;
  actualEndDate?: PlainDate | undefined;

  establishedYear?: number | undefined;
  currentSpreadMm?: number | undefined;
  dividedFromPlantingId?: string | undefined;
  /** Month-of-year window in which it is above ground. Display only — see below. */
  dormantFrom?: number | undefined;
  dormantTo?: number | undefined;

  status: PlantingStatus;
  notes: string;
}

export const effectiveStart = (p: Planting): PlainDate => p.actualSowDate ?? p.plannedSowDate;
export const effectiveEnd = (p: Planting): PlainDate | null =>
  p.actualEndDate ?? p.plannedEndDate;

/**
 * **The dormancy trap** (D-013), and the single most likely bug in this app.
 *
 * A dormant coneflower in March is bare soil that is *already occupied*. If
 * occupancy asked "is there a planting whose range covers today", the planner
 * would offer those cells for lettuce every single spring.
 *
 * So a perennial — a planting with no end date — occupies its ground from the
 * day it goes in, **for ever, including while dormant**. Dormancy changes how it
 * is drawn, never whether the ground is free.
 */
export function occupiesOn(planting: Planting, date: PlainDate): boolean {
  const start = effectiveStart(planting);
  const end = effectiveEnd(planting);
  if (planting.status === 'failed') return false;
  return withinRange(date, start, end);
}

/** Purely cosmetic: it is occupied either way. */
export function isDormantOn(planting: Planting, date: PlainDate): boolean {
  if (planting.dormantFrom === undefined || planting.dormantTo === undefined) return false;
  if (!occupiesOn(planting, date)) return false;
  const month = Number(date.slice(5, 7));
  return planting.dormantFrom <= planting.dormantTo
    ? month >= planting.dormantFrom && month <= planting.dormantTo
    : month >= planting.dormantFrom || month <= planting.dormantTo;
}

export const cellKey = (cell: CellRef): string => `${cell.col}:${cell.row}`;

export function occupiedCells(
  plantings: readonly Planting[],
  bedId: string,
  date: PlainDate,
): Map<string, Planting> {
  const taken = new Map<string, Planting>();
  for (const planting of plantings) {
    if (planting.bedId !== bedId) continue;
    if (!occupiesOn(planting, date)) continue;
    if (planting.footprint.mode !== 'cells') continue;
    for (const cell of planting.footprint.cells) taken.set(cellKey(cell), planting);
  }
  return taken;
}

export interface PlacementConflict {
  readonly with: Planting;
  readonly reason: 'cellTaken' | 'overlaps';
  readonly cells?: readonly string[] | undefined;
  readonly dormant: boolean;
}

/**
 * Can this go here, on this date? Conflicts name the planting in the way and
 * whether it happens to be dormant — because "there is nothing there" is exactly
 * what the gardener will believe when they look.
 */
export function placementConflicts(
  plantings: readonly Planting[],
  bedId: string,
  candidate: Footprint,
  date: PlainDate,
): PlacementConflict[] {
  const conflicts: PlacementConflict[] = [];

  if (candidate.mode === 'cells') {
    const taken = occupiedCells(plantings, bedId, date);
    const byPlanting = new Map<Planting, string[]>();
    for (const cell of candidate.cells) {
      const holder = taken.get(cellKey(cell));
      if (holder === undefined) continue;
      const list = byPlanting.get(holder) ?? [];
      list.push(cellKey(cell));
      byPlanting.set(holder, list);
    }
    for (const [holder, cells] of byPlanting) {
      conflicts.push({ with: holder, reason: 'cellTaken', cells, dormant: isDormantOn(holder, date) });
    }
    return conflicts;
  }

  const candidateArea = footprintPolygon(candidate);
  for (const planting of plantings) {
    if (planting.bedId !== bedId) continue;
    if (!occupiesOn(planting, date)) continue;
    if (planting.footprint.mode === 'cells') continue;
    if (overlaps(candidateArea, footprintPolygon(planting.footprint))) {
      conflicts.push({ with: planting, reason: 'overlaps', dormant: isDormantOn(planting, date) });
    }
  }
  return conflicts;
}

function footprintPolygon(footprint: Footprint): Vec[] {
  if (footprint.mode === 'drift') return [...samplePolygon(footprint.ring)];
  if (footprint.mode === 'point') {
    const points: Vec[] = [];
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      points.push({
        x: footprint.x + Math.cos(a) * footprint.radiusMm,
        y: footprint.y + Math.sin(a) * footprint.radiusMm,
      });
    }
    return points;
  }
  return [];
}

/** Cheap bounding-box overlap. Exact clipping is not worth it for a warning. */
function overlaps(a: readonly Vec[], b: readonly Vec[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const box = (p: readonly Vec[]) => ({
    x0: Math.min(...p.map((v) => v.x)),
    y0: Math.min(...p.map((v) => v.y)),
    x1: Math.max(...p.map((v) => v.x)),
    y1: Math.max(...p.map((v) => v.y)),
  });
  const A = box(a);
  const B = box(b);
  return A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0;
}

/* ------------------------------------------------------------- spacing */

export interface SpacingCheck {
  readonly planned: number;
  readonly capacity: number;
  readonly overcrowdedBy: number;
  readonly ok: boolean;
  readonly explanation: string;
}

/**
 * Spacing validation across all three footprint modes (D-020), because "nine
 * carrots per square foot, you have drawn twenty" is the thing a plan is for.
 */
export function checkSpacing(
  footprint: Footprint,
  variety: Variety,
  bed: Pick<Bed, 'cellMm'>,
  cellCoverage?: (cell: CellRef) => number,
): SpacingCheck {
  if (footprint.mode === 'cells') {
    const perCell = variety.plantsPerCell ?? plantsPerCellFrom(variety.spacingMm, bed.cellMm);
    const capacity = footprint.cells.reduce(
      (sum, cell) => sum + perCell * (cellCoverage?.(cell) ?? 1),
      0,
    );
    const planned = Math.round(capacity);
    return {
      planned,
      capacity,
      overcrowdedBy: 0,
      ok: true,
      explanation: `${capacity.toFixed(1)} plants at ${perCell} per cell across ${footprint.cells.length} cells.`,
    };
  }

  if (footprint.mode === 'drift') {
    const area = polygonArea(samplePolygon(footprint.ring));
    // Square packing, deliberately conservative: hexagonal would allow ~15%
    // more, and a drift that is slightly too sparse is a much smaller problem
    // than one that is too dense.
    const spacing = footprint.spacingMm > 0 ? footprint.spacingMm : variety.spacingMm;
    const capacity = area / (spacing * spacing);
    const over = Math.max(footprint.count - capacity, 0);
    return {
      planned: footprint.count,
      capacity,
      overcrowdedBy: over,
      ok: over < 1,
      explanation:
        over < 1
          ? `${footprint.count} plants in room for about ${capacity.toFixed(0)}.`
          : `${footprint.count} plants in room for about ${capacity.toFixed(0)} — ${Math.ceil(over)} too many.`,
    };
  }

  const needed = (variety.matureSpreadMm ?? variety.spacingMm) / 2;
  const ok = footprint.radiusMm + 1 >= needed;
  return {
    planned: 1,
    capacity: 1,
    overcrowdedBy: 0,
    ok,
    explanation: ok
      ? `One specimen with room for its mature spread.`
      : `Drawn at ${Math.round(footprint.radiusMm * 2)}mm across, but matures to ${Math.round(needed * 2)}mm.`,
  };
}

const plantsPerCellFrom = (spacingMm: number, cellMm: number): number =>
  Math.max(Math.floor(cellMm / spacingMm) ** 2, 0.25);

/**
 * A shrub's footprint is a function of its age, so planting one 3ft from a bed
 * is fine in year one and wrong in year six. Approaches mature spread on a
 * decelerating curve rather than linearly, which is how woody plants actually
 * fill out.
 */
export function projectedSpreadMm(
  variety: Variety,
  yearsInGround: number,
  yearsToMaturity = 8,
): number {
  const mature = variety.matureSpreadMm ?? variety.spacingMm;
  if (yearsInGround >= yearsToMaturity) return mature;
  const t = Math.max(yearsInGround, 0) / yearsToMaturity;
  return mature * (0.25 + 0.75 * Math.sqrt(t));
}

export const needsPerennialOccupancy = (variety: Variety): boolean => isPerennial(variety);
