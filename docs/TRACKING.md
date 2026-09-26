# GardenTrack — Build Tracker

**This is the live source of truth for build progress.** Update it in the same
commit as the work it describes.

Last updated: 2026-09-25

---

## How to use this tracker

Every task has a stable ID (`P1-07`). Reference it in commit messages and PR
titles: `P1-07: transform box for move, scale and rotate`.

**Status key**

| Symbol | Meaning |
|:---:|---|
| ⬜ | Not started |
| 🟨 | In progress |
| ✅ | Done, tested, merged |
| 🔬 | Spike / research — timeboxed, may produce a decision not code |
| ⛔ | Blocked (blocker noted inline) |
| ❌ | Cut from scope (reason noted inline) |

**Rules**
1. A task is only ✅ when its tests pass in CI. Not when the code "works".
2. Any task producing a non-obvious choice gets an entry in [DECISIONS.md](./DECISIONS.md).
3. If a task turns out to be wrong, mark it ❌ with a reason. Don't delete it —
   the record of what we chose *not* to do is worth as much as the rest.
4. **Only the next phase or two are expanded into tasks.** Writing 120 tasks for
   work eighteen months out is fake precision — the later phases carry a scope
   line and get expanded when they're next. Phase exit criteria live in
   [ROADMAP.md](./ROADMAP.md) and are the real contract.

---

## Progress summary

| Phase | Title | Tasks | Done | Status |
|---|---|:---:|:---:|---|
| — | Spikes | 2 | 1 | 🟨 Spike A published, iterating |
| 0 | Foundation | 12 | **12** | ✅ **Complete** |
| 1 | Site, beds, and the map | 21 | **20** | ✅ **Complete** (1 deferred) |
| 2 | Plant library, natives, seed inventory | 10 | **9** | 🟨 In progress |
| 3 | Planning and the derived schedule | 12 | **7** | 🟨 In progress |
| 4 | Light and shade | — | — | ⬜ unblocked |
| 5 | The in-season log | — | — | ⬜ |
| 6 | Tasks and reminders | — | — | ⬜ |
| 7 | Winter starts, succession, sourcing | — | — | ⬜ |
| 8 | History, analysis, bed time-lapse | — | — | ⬜ |
| 9 | Sharing and output | — | — | ⬜ |
| 10 | Environment and research | — | — | ⬜ |
| 11 | Sync and multi-user | — | — | ⬜ |

**Unblocked.** Climate parameters are recorded in [CLIMATE.md](./CLIMATE.md):
zone 6a/6b boundary, Eastern Corn Belt Plains, a provisional frost profile.
The location itself stays out of the repo (D-027).

**Still open:** the frost profile is from disagreeing published sources and wants
real station probabilities (P2-00). Spike B wants **one measured bed edge** — the
photos are usable, the scale is not assumed.

---

## Spikes

| ID | Task | Status |
|---|---|:---:|
| SA-01 | Bed editor prototype — geometry, snapping, transform box, coverage readout, accuracy check | 🔬 Published, awaiting verdict |
| SB-01 | Photo trace — four-corner homography on a real bed, in real light | 🟨 photos in hand, needs one measured edge |

Findings so far are in [`spikes/bed-editor/README.md`](../spikes/bed-editor/README.md).
The one that already changed a decision: hit targets must be decoupled from
visible size and owned by the component library, not remembered per screen
(D-018).

---

## Phase 0 — Foundation

*An empty but rigorous repo, and one hard question answered with a measurement.*

| ID | Task | Status |
|---|---|:---:|
| P0-01 | pnpm workspace, TypeScript config, Vite, `exactOptionalPropertyTypes` on | ✅ |
| P0-02 | Lint and format, wired to a single `verify` script | ✅ |
| P0-03 | Vitest, with a real test on a real module — no placeholder assertions | ✅ |
| P0-04 | CI on every push; `verify` green before anything else lands | ✅ |
| P0-05 | `packages/core` — pure domain, zero I/O. Geometry and dates live here | ✅ |
| P0-06 | IndexedDB layer with the D-008 discipline: UUIDv7 ids, `updatedAt`, soft delete | ✅ |
| P0-06b | **`GeoCell` + `coarsen()` as the only way to hold a position** (D-028) | ✅ |
| P0-06c | **Test: no serialised `Site` retains precision beyond `precisionDeg`** | ✅ |
| P0-07 | PWA shell — manifest, service worker, installs to a home screen | ✅ |
| P0-08 | **Storage measurement.** 40 photos → 220 KB each, 1.00× overhead, ~4,100 in quota. Budget written in [STORAGE.md](./STORAGE.md) | ✅ |
| P0-09 | Three device shells from D-018 — phone stack, tablet two-pane, desktop three-pane | ✅ |
| P0-10 | Theme tokens and type scale, both themes, carried over from the spike | ✅ |

**Exit:** ✅ met. `verify` (typecheck + lint + 44 tests + build) green · service
worker active and a **cold launch with the network off renders the app**,
verified in a real browser · per-photo budget written in [STORAGE.md](./STORAGE.md)
from a measurement, with the caveat that quota is a fraction of free disk and
`persist()` was refused headless.

Two findings worth carrying forward: the first storage probe reported 868,224
photos because `estimate()` updates lazily and was measuring nothing — it now
polls until settled and refuses an implausible overhead ratio. And two of the
first tests failed as wrong *tests*, not wrong code (grid-boundary neighbours,
and area lost to the sliver filter).

---

## Phase 1 — Site, beds, and the map

*Your actual garden, on your phone.*

| ID | Task | Status |
|---|---|:---:|
| P1-01 | `Site` with the four geographic facts kept separate (DATA_MODEL §2) | ✅ |
| P1-01b | Setup without disclosure — manual zone/frost, pin rounded on drop, device fix rounded in memory. **No geocoding round-trip** (D-028) | ✅ |
| P1-01c | UI shows zone + ecoregion + frost, never a place name (PRIVACY §8) | ✅ |
| P1-02 | Core geometry: area, bbox, point-in-polygon, centroid, rotation | ✅ |
| P1-03 | **Polygon clipper and per-cell `coverage`** (D-019) — the load-bearing one | ✅ |
| P1-04 | Spline sampling for curved rings, and RDP simplification | ✅ |
| P1-05 | Bed create / edit / **archive, never delete** | ✅ |
| P1-06 | Map view — pan, zoom, pinch, tap to select | ✅ |
| P1-07 | Transform box: move, scale from a corner, rotate (D-026) | ✅ |
| P1-08 | Reshape mode: vertex handles with offset drag | ✅ |
| P1-09 | Snap to grid and to angle, applied angle-first (D-024) | ✅ |
| P1-10 | Editable edge lengths and overall size, with the rectangle rule set| ✅ |
| P1-11 | Bed templates — 4×8, 4×4, 2×8, L, keyhole | ✅ |
| P1-12 | Holes, subtracted from coverage| ✅ |
| P1-13 | Obstructions as rings with a height (D-023), ready for Phase 4| ✅ |
| P1-14 | **Handle primitive** — one component owning visible size vs hit target (D-018) | ✅ |
| P1-15 | Grid rotation independent of the bed's angle | ✅ |
| P1-16 | Units: metric stored, imperial displayed, switchable (D-009) | ✅ |
| P1-17 | Warn before a resize strands planted cells (D-026) — deferred to Phase 3: there are no plantings yet, so there is nothing to warn about | ❌ |
| P1-18 | **Rounded-corner bed template and detection** — the real beds are corrugated metal with radiused corners, which `rectInfo` does not recognise | ✅ |
| P1-19 | Obstruction presence window (`presentFrom`/`presentTo`) — covers shade cloth as well as deciduous canopy (D-023) | ✅ |
| P1-20 | Containers as first-class beds| ✅ |
| P1-21 | Paths / circulation space — beds here sit in gravel and mulch, not adjacent to each other | ✅ |

**Exit:** 🟨 the app is ready for it; the garden itself is not yet entered. A
seed layout traced from photographs gets Josh most of the way — 11 beds including
6 grow bags, 5 shadow casters and 3 surfaces — with **every shape flagged
`estimated`** until a tape measure says otherwise (D-024). Verified in a real
browser: seeding, drawing surfaces, cutting holes, setting an exact dimension,
editing an obstruction's height and presence window, and all of it surviving a
reload.

Still Josh's to do: drag the seeded shapes to where they really are, measure the
beds, and flip each one to *Measured*.

---

## Phase 2 — Plant library, natives, seed inventory

| ID | Task | Status |
|---|---|:---:|
| P2-00 | Frost profile derived from daily minima, not a published table (D-032) | ✅ |
| P2-00b | Fetch the archive at runtime — **blocked here**: the environment's network policy denies the weather hosts, so CLIMATE.md stays provisional | ⛔ |
| P2-01 | `Variety` model: lifecycle, dtmFrom, spacing, feeder class, bloom window | ✅ |
| P2-02 | Bundled catalog — 46 curated entries, versioned, `isCustom` never clobbered | ✅ |
| P2-03 | Nativity as a set of regions, with a verdict naming which region (D-034) | ✅ |
| P2-04 | Zone fit — perennials only, and "marginal" where rated exactly to this zone | ✅ |
| P2-05 | Catalog browse, search and filters | ✅ |
| P2-06 | Custom varieties — storage and repository done; no add-a-variety form yet | 🟨 |
| P2-07 | `SeedPacket` model across seed, bulb, tuber, bare root, plug and potted | ✅ |
| P2-08 | Viability from species longevity, overridden by a recorded test (D-033) | ✅ |
| P2-09 | Seed inventory UI, sorted worst-first | ✅ |

**Exit:** 🟨 a zone-and-region-filtered browse returns 19 natives of the Eastern
Corn Belt Plains out of 46, every claim naming the region it is true of, and the
seed box computes viability and is overridden by a recorded test — all verified in
a browser. Outstanding: the frost archive fetch (blocked by network policy) and an
add-a-variety form.

**Honest limit on the nativity layer:** it is curated from regional reference
lists, not joined to USDA PLANTS distribution data, which this environment cannot
download. The catalog says so in `NATIVITY_PROVENANCE` rather than implying
authority it does not have.

---

## Phase 3 — Planning and the derived schedule

| ID | Task | Status |
|---|---|:---:|
| P3-01 | `Planting` with the three footprint modes and planned/actual date pairs | ✅ |
| P3-02 | Derived schedule, spring anchored to last frost | ✅ |
| P3-03 | Derived schedule, fall counted back from first frost, with the short-day penalty | ✅ |
| P3-04 | **Perennial occupancy through dormancy** — the app's most likely bug (D-013) | ✅ |
| P3-05 | Spacing validation across cells, drifts and specimens | ✅ |
| P3-06 | Mature-spread projection on a decelerating curve | ✅ |
| P3-07 | Companion evaluation: table + derived, tiered and radius-aware (D-021/22) | ✅ |
| P3-08 | Succession — one action generating a staggered series | ✅ |
| P3-09 | Painted light and sun-requirement warnings | ⬜ |
| P3-10 | Bed occupancy timeline | ⬜ |
| P3-11 | Copy last season as a starting point | ⬜ |
| P3-12 | Planner UI — place, warn, suggest | ⬜ |

**Exit:** 🟨 the domain is done and tested; the planner UI is not built. 192 tests
cover every claim in the exit criterion except the ones that need a screen.

---

## Phases 4–11

Scope lines only until each is next. Full descriptions and exit criteria are in
[ROADMAP.md](./ROADMAP.md).

| Phase | Scope |
|---|---|
| 2 | **P2-00 first:** replace the provisional frost profile with NOAA/MRCC station probabilities. Then bundled catalog, USDA PLANTS nativity, zone filtering, seed and bulb inventory with computed viability |
| 3 | Placement in three footprint modes, derived schedule both directions, perennial occupancy, companion evaluation, painted light |
| 4 | Solar position, shadow casting from obstructions, the site light lattice, morning and afternoon kept apart |
| 5 | Lifecycle events, one-tap harvest logging, photos (**EXIF stripped on import**, D-028), the ready-now queue, JSON export |
| 6 | One-off, recurring and derived tasks; today/this week; notification config |
| 7 | Seed-starting calendar, trays and cells, succession, the vendor sourcing proxy |
| 8 | Per-bed history, yields, variety verdicts, rotation heatmap, bed photo time-lapse |
| 9 | Printable plans, QR bed stakes (**resolve locally** — a code in a front garden shouldn't point at a public page), read-only share links with photos as a separate opt-in |
| 10 | Weather and GDD, weather-conditional tasks, pests and treatments, variety trials |
| 11 | Accounts, field-level last-write-wins sync, partner access |
