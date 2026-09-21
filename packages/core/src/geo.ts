/**
 * Location minimisation (D-028).
 *
 * GardenTrack has no type that can hold a precise position. A `GeoCell` is
 * coordinates rounded onto a shared grid, and `coarsen` is the only way to make
 * one — raw coordinates exist as arguments for the length of that call and are
 * never returned or stored.
 *
 * Rounded, never jittered: a random offset averages back toward the true point
 * under repeated observation and makes every computation irreproducible.
 */

/** ~11 km of latitude; ~8.6 km of longitude at 40°N. Costs a minute or two a
 *  day of computed sun-hours near the solstices — see PRIVACY.md §2. */
export const DEFAULT_PRECISION_DEG = 0.1;

export interface GeoCell {
  readonly lat: number;
  readonly lon: number;
  readonly precisionDeg: number;
  readonly method: 'rounded';
}

export class InvalidCoordinateError extends Error {}

/** Round a position onto the shared grid. The only constructor for a GeoCell. */
export function coarsen(
  lat: number,
  lon: number,
  precisionDeg: number = DEFAULT_PRECISION_DEG,
): GeoCell {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new InvalidCoordinateError(`latitude out of range: ${lat}`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new InvalidCoordinateError(`longitude out of range: ${lon}`);
  }
  if (!Number.isFinite(precisionDeg) || precisionDeg <= 0) {
    throw new InvalidCoordinateError(`precision must be positive: ${precisionDeg}`);
  }
  return {
    lat: snapToGrid(lat, precisionDeg),
    lon: snapToGrid(lon, precisionDeg),
    precisionDeg,
    method: 'rounded',
  };
}

/**
 * Round onto a grid anchored at zero, then re-round the result to kill binary
 * floating-point tails — a stored value of 39.400000000000006 would leak that
 * the input was not exactly 39.4.
 */
function snapToGrid(value: number, step: number): number {
  const snapped = Math.round(value / step) * step;
  const decimals = Math.min(12, Math.max(0, Math.ceil(-Math.log10(step)) + 1));
  return Number.parseFloat(snapped.toFixed(decimals));
}

/** Worst-case metres between a cell's stored value and any point inside it. */
export function cellRadiusMetres(cell: GeoCell): number {
  const halfDeg = cell.precisionDeg / 2;
  const latMetres = halfDeg * 111_320;
  const lonMetres = halfDeg * 111_320 * Math.cos((cell.lat * Math.PI) / 180);
  return Math.hypot(latMetres, lonMetres);
}

/** True when a value carries more precision than the cell claims to. */
export function exceedsPrecision(value: number, precisionDeg: number): boolean {
  const onGrid = Math.round(value / precisionDeg) * precisionDeg;
  return Math.abs(value - onGrid) > precisionDeg * 1e-6;
}
