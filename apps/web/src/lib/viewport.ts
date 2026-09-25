import type { Box, Vec } from '@gardentrack/core';

/** Pan/zoom state for the plan, expressed as an SVG viewBox in millimetres. */
export interface View {
  x: number;
  y: number;
  /** Width in world millimetres. Height follows the element's aspect ratio. */
  w: number;
}

export const MIN_VIEW_MM = 400;
export const MAX_VIEW_MM = 200_000;

export function viewBox(view: View, aspect: number): string {
  return `${view.x} ${view.y} ${view.w} ${view.w * aspect}`;
}

/** World millimetres per CSS pixel — what keeps handles a constant screen size. */
export const mmPerPixel = (view: View, elementWidthPx: number): number =>
  view.w / Math.max(elementWidthPx, 1);

export function fitTo(boxes: readonly Box[], aspect: number, padMm: number): View {
  if (boxes.length === 0) return { x: -1000, y: -1000, w: 8000 };
  const x0 = Math.min(...boxes.map((b) => b.x0)) - padMm;
  const y0 = Math.min(...boxes.map((b) => b.y0)) - padMm;
  const x1 = Math.max(...boxes.map((b) => b.x1)) + padMm;
  const y1 = Math.max(...boxes.map((b) => b.y1)) + padMm;
  const width = Math.max(x1 - x0, MIN_VIEW_MM);
  const height = Math.max(y1 - y0, MIN_VIEW_MM);
  const w = Math.max(width, height / Math.max(aspect, 0.001));
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * aspect) / 2, w };
}

export function zoomAt(view: View, focus: Vec, factor: number, aspect: number): View {
  const w = Math.min(Math.max(view.w * factor, MIN_VIEW_MM), MAX_VIEW_MM);
  const k = w / view.w;
  void aspect;
  return { x: focus.x - (focus.x - view.x) * k, y: focus.y - (focus.y - view.y) * k, w };
}

/** Convert a pointer event to world millimetres via the SVG's own matrix. */
export function toWorld(svg: SVGSVGElement, clientX: number, clientY: number): Vec {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  if (matrix === null) return { x: 0, y: 0 };
  const world = point.matrixTransform(matrix.inverse());
  return { x: world.x, y: world.y };
}
