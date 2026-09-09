# GardenTrack — Decision Log

Lightweight ADRs. One entry per non-obvious choice, so future-us knows *why*.

Format: **What we chose · Why · What it costs us · Status**

Status key: ✅ Accepted · 🔬 Proposed (needs Josh's OK) · ⚠️ Revisit later

---

### D-001 · A separate repository, not part of joshify
**Chose:** `JoshHambright/garden`, its own repo.
**Why:** Joshify is a Raspberry Pi Spotify appliance. Sharing a repo would mean
sharing a CLAUDE.md, a roadmap, a tracker and a CI pipeline with a project that
has nothing in common with this one.
**Costs:** Tooling set up twice.
**Status:** ✅ Accepted — *blocked on repo creation; the session's GitHub app
returns 403 on `POST /user/repos`, so Josh has to create it manually. Planning
docs are staged on the `claude/garden-planning-app-xhc4mx` branch of joshify in
the meantime, under `garden-planning/`, and must never be merged to joshify main.*

---

### D-002 · Local-first, sync later
**Chose:** All data in the browser (IndexedDB). No account, no server in v1. Sync
and sharing are later phases.
**Why:** The garden has no signal. An app that needs the network to record a
harvest doesn't get used to record harvests, and every history feature in the
product depends on the record being complete. Local-first makes offline the
default state rather than a mode to be engineered.
**Costs:** No cross-device use until Phase 9. Data lives in one browser profile
until then, so JSON export in Phase 4 is the backup story and is not optional.
Browser storage can be evicted — needs `navigator.storage.persist()` and a
visible warning if it's denied.
**Status:** ✅ Accepted

---

### D-003 · A Planting is time-ranged, not a point in time
**Chose:** `Planting` carries a date range and a status, and the bed map is a
query over it (`today ∈ range`) rather than a stored state.
**Why:** It's the difference between an app that can answer "what's in bed 3" and
one that can answer "what was in bed 3 last August." Succession, rotation,
history and the occupancy timeline all become views over one model instead of
four separate features.
**Costs:** Every read of "what's in this bed" is a date-filtered query, not a
field lookup. Needs an index and a small amount of discipline.
**Status:** ✅ Accepted

---

### D-004 · Square-foot grid in v1, real coordinates in the model from day one — **REVISED, see D-019 / D-020**

> Superseded in part. The grid survives for annual vegetable beds; it is *not*
> the v1 layout for native and perennial beds, and beds are no longer assumed
> rectangular. Original entry kept below for the record.
**Chose:** v1 places plants in 1 ft cells. `Planting` reserves an alternative
`{x, y, radiusMm}` shape so free placement is additive in v2.
**Why:** The grid is dramatically easier to build, far easier to hit with a
thumb, and gives spacing validation for free. But if v1 stores only cell indices,
free placement later is a data migration rather than a feature.
**Costs:** Sprawling and irregular plantings are approximated in v1. Cell size is
per-bed (`gridCellMm`) to take some of the edge off.
**Status:** ✅ Accepted

---

### D-005 · Derived dates, stored as values
**Chose:** Planting dates are computed from frost dates and days-to-maturity at
creation, then **stored** and freely editable — not recomputed on read.
**Why:** Derivation is the point (PRODUCT §5.2), but recomputing on read means a
later correction to a variety's `daysToMaturity` silently rewrites what you did
in 2024. History has to be immutable to be worth keeping.
**Costs:** A plan made before a catalog correction keeps the old dates. Correct,
but needs a "recompute this plan" affordance so it isn't a trap.
**Status:** ✅ Accepted

---

### D-006 · Bundled plant catalog, no external plant API
**Chose:** Ship a curated, versioned JSON catalog of common varieties in the app.
User additions are marked `isCustom` and survive catalog updates.
**Why:** The available plant-data APIs are variously unmaintained, rate-limited,
inconsistent about days-to-maturity, or unclear on licensing. More decisively: an
external dependency in the catalog breaks D-002 — you'd need the network to plan.
**Costs:** We maintain the catalog. Starts small and grows from real use, which
is honest — a curated hundred varieties beats a scraped ten thousand with bad
spacing numbers.
**Status:** ✅ Accepted

---

### D-007 · One `Event` table, discriminated by kind
**Chose:** Harvests, observations, pest sightings, treatments, amendments and
photos are all `Event` rows with a `kind` and a `payload`.
**Why:** Every one of them is "something that happened at a time, attached to
something, possibly with photos." The most-wanted screen in the app is a bed's
timeline; with a table per kind that's a seven-way union query forever.
**Costs:** `payload` is loosely typed at the storage boundary. Mitigated by a
discriminated union in TypeScript and validation on write.
**Status:** ✅ Accepted

---

### D-008 · Last-write-wins sync, no CRDT library
**Chose:** UUIDv7 ids, `updatedAt`, soft deletes — enough for field-level
last-write-wins when Phase 9 arrives. No Automerge, no Yjs.
**Why:** CRDTs solve concurrent editing of a shared document. Two people in one
household are not going to edit the same bed layout in the same second. The
runtime weight and the modelling constraints buy nothing here.
**Costs:** A genuine simultaneous edit loses one side. Acceptable at this scale;
the append-only `Event` log — where most writes happen — never conflicts anyway.
**Status:** ✅ Accepted

---

### D-009 · Metric stored, imperial displayed
**Chose:** Canonical storage in mm and grams. Display defaults to imperial,
switchable per user.
**Why:** Unit conversion at the boundary is a solved problem; unit ambiguity in
the store is a permanent source of bugs. Square-foot gardening is an imperial
idiom and the UI should speak it.
**Costs:** Conversion code and rounding decisions at every input. `gridCellMm`
defaulting to 304.8 looks odd and is correct.
**Status:** ✅ Accepted

---

### D-010 · Svelte + Vite, TypeScript throughout
**Chose:** The same stack as joshify.
**Why:** Josh is actively fluent in it right now; running two concurrent projects
on one stack removes a context switch. The bed editor re-renders a grid on every
drag frame, which is the case where no-virtual-DOM actually shows up.
**Costs:** Smaller ecosystem than React — the drag-and-drop and virtualised list
work is likelier to be hand-built. Given that the bed editor is bespoke either
way, that's a smaller cost here than it looks.
**Status:** 🔬 Proposed — React + Vite is the reasonable alternative if the
ecosystem argument wins.

---

### D-011 · Phases follow the season, not just dependencies
**Chose:** In-season logging (Phase 4) ships before winter starts (Phase 5), even
though starts happen earlier in the calendar year.
**Why:** Planning starts well requires the record from the previous season. Phase
5 built first would be built blind.
**Costs:** If the build lands mid-winter, the first genuinely useful phase is out
of season. Acceptable — Phase 3's planner is the winter tool.
**Status:** ✅ Accepted

---

### D-012 · Native plant data: USDA PLANTS as the base, curated on top
**Chose:** Bundle USDA PLANTS Database state-level nativity (public domain,
downloadable) as the nativity base layer. Hand-curate horticultural attributes —
bloom window, mature height and spread, moisture, sun, division interval — for a
regional shortlist of a few hundred species. Link out to Prairie Moon and the
Lady Bird Johnson Wildflower Center for everything else.
**Why:** USDA PLANTS is the only source that is comprehensive, authoritative,
public domain, and redistributable. What it is *not* is horticultural — it will
tell you *Echinacea pallida* is native to Illinois and nothing about when it
blooms or how far apart to plant it. That gap is exactly the part that has to be
curated, and it's small if scoped to a region.
**Costs:** State-level nativity is coarser than ecoregion. We store
`nativeToRegionIds` as a set so ecoregion data can be layered in later without a
migration, but the v1 badge will say "native to Illinois," not "native to the
Central Corn Belt Plains."
**Open:** Lepidoptera host-plant counts (the Tallamy/NWF "this oak feeds 500
species" data) are the most persuasive numbers in native gardening and the least
cleanly licensed. Treat `hostGenera` as a schema slot we may only be able to fill
by hand for the top ~50 genera.
**Status:** ✅ Accepted

---

### D-013 · Perennials are an occupancy mode, not a flag
**Chose:** `Variety.lifecycle` drives whether a Planting's date range is
open-ended, and the bed occupancy query reserves perennial cells **year-round,
including dormancy.**
**Why:** A dormant coneflower in March is bare soil that is already occupied. If
occupancy is "is there a planting whose range covers today," the planner will
offer those cells for lettuce every single spring. This is the most likely bug in
the app and it's a modelling problem, not a UI problem.
**Costs:** Two occupancy paths instead of one. Rotation checking has to exclude
perennial-purpose beds. The planner needs an explicit "this replaces the existing
planting" gesture rather than silently overwriting.
**Status:** ✅ Accepted

---

### D-014 · Vendor search as adapters with graceful degradation
**Chose:** Per-vendor adapters behind a small server-side proxy, in three tiers:
structured JSON where a vendor's platform exposes it, schema.org product parsing
where it doesn't, and a plain deep link ("search Prairie Moon for *Liatris*")
where neither works. Results are a **cache with a TTL**, never catalog truth.
**Why:** There is no unified seed-vendor API and there isn't going to be. Tiering
means the feature ships useful on day one — a deep link is worth real money to a
gardener comparing four tabs — and gets better per vendor rather than being
blocked on the hardest one. Etsy is the exception with a genuine public API,
gated on app approval.
**Costs:** Adapters break when vendors redesign; this is a maintenance treadmill
and should be scoped to vendors Josh actually buys from. Requires a server, which
is the first crack in D-002 — so sourcing is explicitly an **online-only
enhancement** that never blocks planning.
**Conduct:** Respect `robots.txt`, rate-limit hard, cache aggressively, show
name/price/availability/link only, and send the traffic to the vendor. We are
building a shopping assistant that drives sales to independent seed houses, not
a mirror of their catalogs. Several of these companies run affiliate programs;
that is the relationship to aim for.
**Status:** ✅ Accepted

---

### D-015 · Photo-to-bed is a tracing aid, not an auto-detector
**Chose:** Photograph a bed, tap its four corners, enter one measured edge. A
homography rectifies the image to a top-down plan with real scale, and the grid
lays over it. No automatic edge detection in v1.
**Why:** The valuable half of "build the bed from a photo" is *planning against
what the bed actually looks like* — and that's a perspective transform, which is
about forty lines of well-understood linear algebra and works every time.
Automatic bed-boundary detection from a phone photo is a segmentation problem
against low-contrast subjects (soil, mulch, weathered cedar, shadow) that fails
in ways the user cannot correct. Four taps beats a wrong answer.
**Costs:** Four taps and one tape-measure reading per bed, once. In exchange the
scale is *right*, which no photo-only method can guarantee without a reference
object or depth sensor.
**Later:** Auto-corner-suggestion as an assist on top of the manual tracer — it
can be wrong without being harmful, because the user is already adjusting
handles. Overhead shots (a ladder, a phone on a pole) rectify almost perfectly
and are worth documenting as the recommended technique.
**Status:** ✅ Accepted

---

### D-016 · Derived tasks share the scheduling engine
**Chose:** Task rules can be anchored to planting events — "14 days after
germination," "at first fruit set," "year 4 after planting" — and are generated
by the same date engine that computes planting dates.
**Why:** A to-do list you fill in yourself only ever contains what you already
remembered. A derived task list contains what you *should* have remembered, which
is the entire value proposition. It also means the horticultural knowledge lives
in the variety catalog, in data, rather than scattered through UI copy.
**Costs:** Generated tasks need a lifecycle — regenerate when a planting date
moves, don't resurrect ones already completed or dismissed. Snooze and dismiss
are required from the start, or the list becomes noise and gets ignored.
**Status:** ✅ Accepted

---

### D-017 · Weather-conditional tasks, deliberately deferred
**Chose:** `TaskRule.weatherSkip` exists in the schema from the start; the
behaviour ships with the weather work, not with tasks.
**Why:** "Don't remind me to water if it rained half an inch" is the difference
between a reminder you trust and one you mute. But it depends on a weather
integration we don't have yet, and shipping tasks *without* it is still useful.
Reserving the field means it's a feature later, not a migration.
**Status:** ✅ Accepted

---

### D-018 · Three device tiers, one codebase; layout by width, targets by input
**Chose:** Phone, tablet and desktop as named tiers with distinct *jobs* rather
than distinct screen widths (PRODUCT §6). One component set behind three page
shells. Page layout keys off width and container queries; hit-target sizing and
hover affordances key off `pointer: coarse | fine` and `hover`.
**Why:** The device tells you where the gardener is standing, and that determines
what they're trying to do — capture in the garden, lay out at the potting bench,
do bulk work indoors in January. Designing to width alone yields three versions
of one screen; designing to context yields three screens that differ because the
task differs.

Separating size from input is the part that's a correctness issue rather than a
taste issue. A touchscreen laptop, a tablet with a trackpad, and a phone in a
desktop-width browser all exist, and any of them breaks a design where "wide"
silently implies "mouse."
**Costs:** Three shells to build and keep honest, and a rule — no feature may
dead-end on a phone — that has to be checked rather than assumed. In exchange we
explicitly *don't* pay to make every feature equally pleasant everywhere: each
feature area declares a primary tier and is allowed to be merely usable outside
it.
**Consequence for the bed editor:** it gets designed at **landscape tablet**, not
phone — direct touch plus enough canvas to see a whole bed is the combination it
actually wants — then adapted down to phone and up to desktop. This is the one
place the phone doesn't lead, and Spike A tests on both.
**Status:** ✅ Accepted

---

### D-019 · Beds are outlines; the grid is clipped to them
**Chose:** A bed *is* a closed ring of points (splined when curved) plus optional
holes. No `width`/`height` fields. The planting grid is laid over the bounding box
and clipped to the outline, giving every cell a `coverage` fraction in 0…1
(DATA_MODEL §4.1). A rectangle is the four-point case.
**Why:** Real beds are L-shaped around corners, U-shaped around seating, kidney-
shaped as island borders, and frequently have a tree or a downspout in the middle.
Filing that to "backlog" was defensible when this was a vegetable app; it stopped
being defensible the moment native and perennial plantings came into scope, since
curved borders are the *dominant* shape on that half of the garden.

The clipping approach is what makes it affordable. The grid stays a regular
lattice, so spacing validation, occupancy queries, capacity maths and
yield-per-square-foot all keep working untouched — the shape reaches them only as
a per-cell number. Special-casing "L-shaped bed" through that logic instead would
touch every one of those.
**Costs:** A polygon clipper and a spline sampler, neither large, plus the
partial-cell capacity rule (≥0.85 full, 0.3–0.85 pro-rata, <0.3 unusable) which is
a judgement call that will need tuning against real beds. Bed area becomes a
computed property rather than a stored one.
**Why now rather than later:** cheap today, expensive in a year. Retrofitting
`coverage` after `cells[]` indices and capacity maths have shipped means revisiting
every one of them, and after real data exists it's a migration.
**Status:** ✅ Accepted

---

### D-020 · Layout mode follows bed purpose; drifts are first-class
**Chose:** `Bed.layoutMode` ∈ `grid | free`, defaulting from `Bed.purpose`. A
Planting's footprint is a union of `cells`, `drift` (a ring plus a count) and
`point` (a specimen with a growing radius) — DATA_MODEL §4.2. Free placement is
therefore **v1 for perennial and native beds**, not v2.
**Why:** A square-foot grid is not an approximation of a native planting, it's a
description of something else. Naturalistic and matrix planting is drifts, masses
and repeats of one species through a border; a prairie bed on a 1 ft lattice is
simply wrong, and no amount of partial-cell arithmetic fixes it. The earlier
"grid now, free placement later" call was made when this was a vegetable app, and
the native-first direction invalidated it.

Unifying the three modes behind a footprint union keeps the cost down: every mode
reduces to an area, and occupancy, spacing and history queries only ever needed
an area.
**Costs:** Two layout interactions in v1 instead of one, which lands squarely on
the bed editor — already the riskiest UI in the app. Spike A now has to prove
both. Accepted: shipping a native-plant app whose only layout tool is a
vegetable grid would fail at the thing we said the product was for.
**Also settled:** elevation is **not modelled.** Terraced beds, hügelkultur
mounds and slopes are recorded in `soilNotes` and photos. Geometry stays 2D;
modelling terrain is a different application.
**Status:** ✅ Accepted

---

### D-021 · Companion planting carries an evidence tier and a mechanism, always visible
**Chose:** Every `CompanionRelation` requires `evidenceTier` ∈ `trial |
extension | traditional | yourGarden`, a named `mechanism`, and a `source`. The
tier is shown in the UI on every recommendation; it is never collapsed into an
undifferentiated "companions" list.
**Why:** Most circulating companion-planting advice is untested. Some is well
supported — the Three Sisters, *Tagetes patula* against root-knot nematodes,
umbellifers and asters provisioning parasitoid wasps and hoverflies, trap cropping
squash bugs onto blue hubbard, juglone from black walnut. A great deal of the rest
traces to one popular book from the 1970s and has never survived a replicated
trial. Presenting both at equal confidence — which is what essentially every
garden app does — is the actual failure mode, and it's a failure of honesty rather
than of data.

Recording the *mechanism* matters as much as the tier, because a mechanism
generalises and a pairing doesn't. "Legumes fix nitrogen for heavy feeders" tells
you what to do with a plant that isn't in the table; "beans like corn" doesn't.
**Costs:** Sourcing tiers is real research per relation, so the table starts small.
That's the right trade — a hundred sourced relations beat a thousand copied ones,
and "we don't have data on this pairing" is a legitimate answer.
**On `yourGarden`:** two adjacent plantings over two seasons with no control plot
and weather confounding everything is a reason to look closer, not a finding. It
is shown with its sample size, never ranked above `extension`, and never phrased
causally.
**Status:** ✅ Accepted

---

### D-022 · Companion relations are taxon-level edges evaluated in space and time
**Chose:** Relations are stored between **taxa** (`family | genus | species |
variety`) and resolved by walking up from a variety to the first match.
`radiusMm` is a property of the **mechanism**, not the pair. Evaluation matches
neighbours within that radius whose date ranges overlap — or, for `sequential`
relations, immediately precede.
**Why:** The claim is "tomatoes and basil," not "Cherokee Purple and Genovese."
Per-variety storage would be both wrong and combinatorially enormous.

Radius on the mechanism because the distances genuinely differ by kind:
allelopathy is a root zone in metres, a trap crop must be near but deliberately
*not* adjacent, and an insectary planting works at insect flight distance — tens
of metres. **That last one crosses bed boundaries, so the evaluation query is over
the site, not over one bed**, which is worth knowing before the query is written.

Time matters because plantings are time-ranged (D-003). Two things only interact
if they overlap, and spring peas feeding the squash that follows them is a
*sequential* relation — something a folk companion table cannot express at all.
**Costs:** Taxon resolution needs `genus` on Variety and a walk-up lookup. Cheap.
The site-wide radius query needs a spatial index once bed counts grow; irrelevant
at 4–20 beds.
**Free half:** shading, heavy-feeder competition, shared-family pests and spacing
conflicts are computed from `matureHeightMm`, `feederClass`, `family` and
`matureSpreadMm` — no relation table, no folklore risk, and more reliable than
most of the table. `feederClass` is a new field on Variety and is the whole cost.
**Status:** ✅ Accepted

---

### D-023 · Light is a computed field over the site, not a number on a bed
**Chose:** No `sunHours` on Bed. Light is a `LightSample` lattice over the whole
site, indexed by position and month, keeping **morning and afternoon hours
separate**. It comes from three sources — `painted` by hand, `computed` from solar
position and obstruction shadows, `observed` via a guided hourly task — and
computed samples are a **cache**, recomputed whenever an obstruction changes,
while painted and observed samples are the gardener's own record and are never
overwritten.
**Why:** A single number per bed is wrong in three independent directions.
Spatially, because a fence shades one edge and a tree dapples one end — "part of a
bed" is the natural unit, which is what prompted this. Across the day, because six
hours of morning sun and six of afternoon sun are not interchangeable; morning sun
with afternoon shade is what lettuce, spinach and most woodland natives actually
want, and collapsing to one number discards the most actionable part. Across the
year, because the bed that is full sun in early May is half shaded by August once
the sun has dropped and the deciduous canopy has filled in — the single thing
gardeners most consistently misjudge, and the reason a spring plan fails in July.

A site-wide lattice rather than per-bed cells because perennial and native beds
use drifts, not grid cells (D-020), and still need to know what the sun is doing.
This is the same conclusion the companion insectary radius reached (D-022): the
interesting queries are over the site.
**Costs:** Obstructions to draw — though they are rings with a height, the same
geometry as beds (D-019), so they're nearly free to add while that editor is being
written. The computation itself is a closed-form solar position algorithm plus 2D
shadow projection: pure, deterministic, offline, no dependencies, and some of the
most testable code in the app. Storage is bounded by lattice resolution and is a
cache, so it can be evicted.
**Sequencing:** painted light ships with the planner in Phase 3 so sun warnings
exist from the start; Phase 4 replaces the painting with computation behind the
same warning surface.
**Not modelled:** terrain. Slope and aspect really do affect light, but modelling
elevation is out of scope for the same reason it is for beds (D-020). A north
slope gets a site note, not a heightmap.
**Status:** ✅ Accepted

---

### D-024 · Measurement capture that looks like drawing
**Chose:** The bed and site editor is designed as a **dimension-capture tool**,
not a drawing app. Assists, in the order they earn their cost:

| Assist | Cost | Why it matters |
|---|---|---|
| **Snap to grid** (6″ / 1′ / 10 cm, per ring) | trivial | vertices land on round numbers |
| **Snap to angle** (15° / 45° / 90°) | trivial | an L-bed comes out *square*, not 88° |
| **Editable edge lengths** | small | draw roughly, tap the edge, type `8'`, geometry solves |
| **Bed templates** (4×8, 4×4, 2×8, L, keyhole) | small | most raised beds are standard; start from a shape |
| **Snap to existing geometry** | small | parallel beds and constant path widths, which is how beds are actually placed |
| **Stroke simplification** (Ramer–Douglas–Peucker) | small | a freehand stroke becomes a few clean points |
| **Spline fitting** through simplified points | moderate | genuinely curved borders; `Ring.curved` already carries it (D-019) |
| **Photo tracing** | already built | D-015 — the strongest assist of all |
| Shape recognition (offer, never auto-replace) | moderate | v2 |
| Full parametric constraints | large | **cut** |

**Why:** "I can't draw" is usually not a motor-skill problem — it's that a
freehand outline carries no dimensions, and Phase 3's spacing, capacity and
coverage maths need real ones. Reframing the tool as measurement capture settles
the design questions: an editable edge length beats a better brush, because the
number is the deliverable and the picture is the interface to it.

The single biggest assist is one we already built for another reason. Tracing the
rectified overhead photo (D-015) means you are not drawing from imagination at
all — you are outlining something visible, which almost anyone can do.

**Different tools, different assists.** The three things you draw have genuinely
different accuracy needs:

- **Beds** — dimensions are load-bearing. Snap hard, offer numbers, template first.
- **Obstructions** — position and height matter, outline barely does. A tree is a
  circle. Low precision is fine.
- **Drifts** — **no snapping at all.** A drift is a blob by nature; snapping one to
  a grid would misrepresent it and imply a precision that isn't real (D-020).

**Costs:** Three snapping behaviours to keep straight, and stroke smoothing has a
feel that can only be tuned against real hands on real glass — which is what Spike
A is for, with a measured exit criterion: how close does a hand-drawn 4×8 bed
actually land to 4×8.

**Cut: full parametric constraints.** A real constraint solver — "this edge stays
perpendicular to that one, this gap stays 24″ under edit" — is a genuine rabbit
hole and lands somewhere between a weekend and a quarter depending on how honest
you are about degenerate cases. Rectangles staying rectangles and parallel staying
parallel under a length edit is enough, and it's a rule set rather than a solver.

**Touch caveat:** the finger occludes the thing being dragged. Vertex handles need
an offset drag or a callout, and this is a phone-tier problem specifically — the
tablet has room, which is another reason the editor is designed there (D-018).
**Status:** ✅ Accepted

---

### D-025 · Keep a paid tier possible; don't design for one yet
**Chose:** Record three constraints that keep a future paid tier open, and defer
every pricing and packaging question until sync (Phase 11) is actually in sight.

**Why the option is cheap to keep.** Local-first (D-002) has already drawn the
line in the right place. The features that cost real money to operate — sync,
cloud photo backup, the vendor sourcing proxy (D-014), share-link hosting, push
notifications, weather — are precisely the ones that need a server. Everything
else runs on the device: planning, logging, the light field (D-023), companion
evaluation (D-022), the whole catalog. A free tier is therefore not a hobbled
edition of a paid product; it is the entire application minus the network. Very
few apps get that boundary for free, and it should not be spent.

**The three constraints, which are decisions and not sentiments:**

1. **Never hold the gardener's data hostage.** JSON export ships free in Phase 5
   and stays free permanently. If a subscription ever lapses, the local app keeps
   working in full — you lose sync, not your garden. This has to be settled now
   because it rules out designs where records live only server-side.
2. **No entitlement checks in the domain layer.** Gating happens at the service
   boundary — sync, sourcing, sharing, push — and the domain package has no
   concept of a subscription. If premium logic leaks into the core, the free app
   becomes a deliberately degraded paid app and the two can never be cleanly
   separated again.
3. **Accounts arrive with sync, not before.** The model still has no users
   (DATA_MODEL §7). Adding auth early "for later monetisation" is speculative work
   with no v1 payoff that would compromise the local-first property to buy nothing.

**One technical consequence worth knowing now:** photos are ~95% of the bytes, so
they are the cost driver for any hosted tier. That means the sync protocol must
treat large blobs separately from records — resumable, deduplicated, and
independently quota-able — rather than syncing photos as just more rows. It is
the one place where a pricing question genuinely reaches back into the protocol.

**The honest warning.** Designing for a business that may never exist distorts
architecture in ways that hurt if it doesn't. And if this ever stops being a
personal project, several things change posture rather than scale: the vendor
adapters in particular. Scraping independent seed houses on your own behalf is one
thing; doing it on behalf of paying customers is a different relationship, and
D-014's conduct rules would need renegotiating as actual agreements — affiliate
arrangements or nothing. The bundled plant catalog's regional scope, support
burden, and data-protection obligations all shift too.

**Status:** ✅ Accepted as a constraint set · pricing and packaging ❔ deferred

---

### D-026 · Move, scale and reshape are three operations, chosen by what you grab
**Chose:** A selected bed shows a **transform box** by default — drag the bed
body to move it, drag a square corner handle to scale from the opposite corner,
drag an edge handle to scale one axis, drag the stem above it to rotate, and tap
the overall width or height to type an exact size. **Reshape** — dragging
individual vertices — is a second state, entered by double-tapping the bed or by
an explicit toggle in the inspector.
**Why:** The first prototype only had vertex handles, which meant a bed could be
distorted but never *moved* and never *resized* — dragging one corner of a 4×8
turned it into a trapezoid. Those are three genuinely different intents and the
common two were missing.

Choosing the operation by **what you grab** rather than by a mode picked
beforehand is the standard direct-manipulation answer and keeps the common cases
modeless. Reshape has to be a state rather than a fourth handle type because on a
rectangle the vertices and the scale corners are the same four points — showing
both at once would put eight overlapping targets on a phone.
**Details that matter:**
- **Snap the resulting dimension, not the handle position.** You want a bed that
  reads 4′ 0″, which is not the same as a corner landing on a grid intersection
  when the anchor is off-grid.
- **Holes scale with the bed** — they're part of its geometry. **Plantings don't**
  — they're real plants in real places, and a bed being re-measured shouldn't
  drag a serviceberry across the garden.
- **Cell size never scales.** Resizing a bed changes how many 1 ft cells it holds,
  not how big they are.
- **Shrinking a bed can strand planted cells.** In the prototype they simply
  vanish; the real app owes the gardener a warning naming what would be lost
  before it commits.
**Costs:** Two selection states to teach, and double-tap as a gesture that could
misfire during a pan. Both are exactly what Spike A is for.
**Status:** ✅ Accepted
