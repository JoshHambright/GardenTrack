# Spike A — the bed editor

**Published:** https://claude.ai/code/artifact/098d285d-06da-456b-936b-49dc85803e87

A working prototype, not a mockup. It runs the same SVG and CSS the phone will,
with real geometry underneath — the clipping, snapping and simplification are the
actual algorithms, not stand-ins.

Open it on a **landscape tablet first** — that's where the editor is designed to
live (D-018) — then on a phone to find what has to change.

## What it implements

| Doc | Implemented here |
|---|---|
| D-019 | Beds as closed rings with holes; grid clipped by Sutherland–Hodgman, per-cell `coverage`, ≥0.85 full / 0.3–0.85 pro-rata / <0.3 unusable |
| D-019 | `gridRotation` independent of the bed's own angle — the rotate slider |
| D-020 | Three footprint modes: cells, drifts (deliberately unsnapped), point specimens |
| D-020 | `layoutMode` from `Bed.purpose` — native beds get no grid at all |
| D-024 | Snap to grid (3″/6″/1′) and to angle (15°/90°), applied angle-first then length-along-the-ray |
| D-024 | Editable edge lengths; rectangle-aware so one edge moves its opposite |
| D-024 | Bed templates, RDP stroke simplification, Catmull–Rom splining |
| D-024 | Two selection states: **move & scale** (transform box) and **reshape** (vertex handles) |
| D-024 | Scale from a corner anchored at the opposite one; edge handles scale one axis |
| D-024 | Rotate from a stem handle, snapped to the angle increment |
| D-024 | Offset vertex drag in reshape mode — the handle lifts ~46px above the finger |
| D-023 | Obstructions as rings with a height, ready for Phase 4's shadow casting |
| D-009 | Millimetres internally, ft·in displayed, metric toggle |

## What it's meant to prove

1. **Can grid and drift editing share one canvas** without a mode switch that
   confuses? Both tools are live; try placing a vegetable planting and a drift in
   the same session.
2. **Is the assisted result dimensionally trustworthy?** The inspector's
   *Accuracy check* is the measured exit criterion. Drop a template bed, drag its
   corners around freehand, and watch the deviation. Then toggle **Assists** off
   and do it again. The claim under test is that snapping plus editable edges gets
   a hand-drawn 4×8 within an inch and a degree.
3. **What cell size is thumb-reachable?** Switch between 6″ and 1′ cells on a
   phone at a realistic zoom.
4. **Does the offset vertex drag actually solve finger occlusion**, or does the
   lift feel disconnected from the finger?
5. **Is the move/scale versus reshape split discoverable?** Double-tap toggles it
   and the inspector has an explicit pair of buttons. The risk is that reshape is
   *too* hidden, or that double-tap fires by accident while panning.

## Deliberately not in this spike

**The photo trace (D-015) is split out as Spike B.** The homography itself is
settled maths and low risk; the real question is whether a photo taken standing
next to a bed rectifies well enough to plan on — and that can only be answered
with a real photo of a real bed in real light. Building it blind would prove
nothing. Spike B is a phone, a bed, and ten minutes.

Also absent: persistence (nothing is saved — reload resets), multi-select,
and the desktop three-pane shell.

## Findings so far

**Hit targets must be decoupled from visual size — and this is a build rule, not
a preference.** The first pass drew scale handles at 12&nbsp;px and they were
simply unhittable with a thumb; resize looked implemented and was not. D-018
already said layout follows width while hit targets follow input, and the
prototype still got it wrong, which is the argument for stating it as a rule the
component library enforces rather than something each screen remembers.

The fix is two rects per handle: a small visible mark and a 48&nbsp;px transparent
pad carrying the data attribute, sized from `pointer: coarse`. Verified under
touch emulation — the pad is the topmost element at the handle's centre, and a
synthetic touch drag resizes the bed.

Second finding, same cause: `touch-action: none` was set on the canvas container
but **not on the `<svg>` itself**, so the browser could claim the gesture before
the page saw it. It is a per-element property; setting it on an ancestor is not
reliably enough.

Third: eight handles round a small bed overlap badly on a phone. Below about
150&nbsp;px of box the editor now shows corners only.

## Known rough edges

- Undo is coarse — one snapshot per committed change, not per drag frame.
- Drift scatter is display-only. Real plant positions come in Phase 3.
- Hole drawing always produces an ellipse; arbitrary hole outlines aren't wired up.
- The curved-bed tool always creates a `native` bed. Purpose is switchable after.

## Feedback

Comments left on the artifact page don't reach the session — send them through
chat. Most useful: where it fights you, and what the accuracy check reads after
you've drawn a bed the way you'd actually draw one.
