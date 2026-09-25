/** What a pointer drag on the plan means right now. */
export type DrawTool = 'select' | 'surface' | 'obstruction' | 'hole';

export const DRAW_TOOLS: ReadonlyArray<{
  readonly id: Exclude<DrawTool, 'select'>;
  readonly label: string;
  readonly note: string;
}> = [
  { id: 'surface', label: 'Surface', note: 'Gravel, mulch, deck — cosmetic only' },
  { id: 'obstruction', label: 'Shadow caster', note: 'House, fence, tree, shade cloth' },
  { id: 'hole', label: 'Hole in bed', note: 'A tree or stump inside a bed' },
];
