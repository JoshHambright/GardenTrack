# GardenTrack — Domain Model

Status: `DRAFT v2` · Last updated: 2026-09-08

**Read this before ROADMAP.md.** Almost every feature in PRODUCT.md is a
different view over the same handful of objects. If the model is right, features
get cheap. If it's wrong, we rewrite in month two.

---

## 1. The spine

```
Region ──┐
         ├─ Site ──< Bed ──< Planting >── Variety ──< SeedPacket
         │            │         │  │                      │
         │            │         │  └──< Event         VendorListing
         │            │         └──< Planting  (division lineage)
         │            └──< BedPhoto
         └─────────────────────< TaskRule ──< Task
```

Read the middle carefully, because it's still the whole design:

> **A Planting is `{ variety, bed, footprint, dateRange }` — an instance of a
> variety occupying a place for a span of time.**

A span, not a point. That single choice is what makes the rest work:

| Feature | Falls out of a time-ranged Planting as… |
|---|---|
| Bed map, today | plantings where `today ∈ dateRange` |
| Next season's plan | plantings where `dateRange` is in the future |
| History | plantings where `dateRange` is in the past |
| Succession | several plantings, same bed, staggered ranges |
| Bed occupancy timeline | plantings drawn on a time axis |
| Rotation check | families of past *annual* plantings in this bed |
| "What's ready?" | plantings whose expected-harvest window is open |
| **Perennial beds** | **plantings with an open-ended range (see §3)** |

Most garden apps model a bed as a static picture of one moment, then bolt time on
afterwards, and can never answer "what was in bed 3 last August."

## 2. Geography — four different facts

"Zone" gets used as one word for four unrelated questions. They resolve
differently and each gates a different feature, so they're stored separately.

| Fact | Answers | Gates |
|---|---|---|
| **USDA hardiness zone** | how cold does it get | will a *perennial* survive the winter |
| **Frost dates** (last spring, first fall) | how long is the season | every *annual* schedule |
| **AHS heat zone** | how many days above 86°F | whether cool-season crops bolt, whether a perennial cooks |
| **EPA Level III/IV ecoregion** + state/county | what grew here before us | what counts as **native** |

```
Region { id, kind, code, name }        // kind: ecoregion3 | ecoregion4 | state | county
Site   { id, name, cell: GeoCell,      // never raw coordinates — D-028
         hardinessZone, heatZone?,
         frost: FrostProfile,
         regionIds[],                  // resolved from lat/lng, user-overridable
         nativeStrictness,             // ecoregion | state | continent | off
         frostRisk }                   // cautious | typical — which percentile plans use

GeoCell {
  lat, lon,                            // rounded to a grid, never the input value
  precisionDeg,                        // 0.1 default ≈ a 95 km² cell
  method                               // 'rounded' — never 'jittered'
}

FrostProfile {
  thresholdF,                          // 32 (freeze) or 36 (frost) — not the same event
  lastSpring: { p10, p50, p90? },      // month-day
  firstFall:  { p10, p50, p90? },
  source, stationId?
}
```

**Frost dates are a distribution, not a date** (D-027). A "50% last frost" means
half of all years frost *after* it — the wrong number to set tomatoes out on. The
planner reads the percentile named by `frostRisk`, so a tender transplant can use
the cautious date while a cover crop uses the typical one, from the same profile.

**There is no field for a precise position, deliberately** (D-028). `GeoCell` is
built by one constructor — `coarsen(lat, lon, precisionDeg)` — which rounds; raw
coordinates live as locals for the length of that call and are never returned or
stored. Rounded to a shared grid, *not* jittered: a random offset averages back to
the true point under repeated observation and makes every computation
irreproducible.

It costs the app nothing. 0.1° shifts computed sun-hours by a minute or two a day
at the solstices, against a decision the gardener rounds to "about six hours"
anyway. Reasoning and threat model: [PRIVACY.md](./PRIVACY.md). This repo's own
climate parameters: [CLIMATE.md](./CLIMATE.md).

`nativeStrictness` matters more than it looks. "Native" with no scale attached is
a marketing word. The user picks how strict the badge is, and the app is honest
about which region a claim is relative to.

## 3. Lifecycle — annuals, perennials, and the things in between

`Variety.lifecycle` ∈ `annual | biennial | tenderPerennial | perennial | shrub |
tree | bulb`

The distinction that actually changes code is not annual-vs-perennial. It's
**does this occupancy end on a known date, and does the ground free up.**

| Lifecycle | `dateRange` ends | Frees the cells | Rotation applies |
|---|---|:---:|:---:|
| Annual | yes, computed | yes | yes |
| Biennial | yes, year 2 | yes | yes |
| Tender perennial | yes, at frost — *or* lifted and overwintered | yes | yes |
| Perennial / bulb | **open-ended** | **no — reserved year-round** | no |
| Shrub / tree | **open-ended** | **no, and the footprint grows** | no |

### The dormancy trap
A perennial in March is bare soil that is *already occupied*. This is the single
most likely bug in the whole app: the planner sees empty cells and offers them.

So the occupancy query is **not** "is there a planting whose range covers today."
It is:

```
occupied(bed, date) = plantings where
    dateRange covers date                       // annuals, in season
    OR (lifecycle is perennial-like AND startDate <= date AND endDate is null)
```

Perennial cells are reserved on the planner grid year-round, drawn differently
when dormant, and the planner refuses to place over them without an explicit
"this replaces it."

### Establishment and spread
```
Planting {
  ...
  establishedYear?,          // sleep / creep / leap — year 1, 2, 3+
  currentSpreadMm?,          // grows each season for perennials and woodies
  dividedFromPlantingId?,    // lineage: one plant becomes three
  dormantFrom?, dormantTo?,  // month-of-year, for the "it's not dead" affordance
}
```

`dividedFromPlantingId` is a self-reference and it earns its place: dividing a
hosta into three is the commonest perennial operation there is, and losing the
provenance loses the answer to "how old is this actually."

`currentSpreadMm` growing over time means a shrub's footprint on the map is a
function of its age. Planting a serviceberry 3 ft from a bed is fine in year one
and wrong in year six, and the app should be able to say so at planting time.

## 4. Entities

### Bed
```
Bed { id, siteId, name, kind, purpose, layoutMode,
      outline: Ring, holes: Ring[],        // see §4.1
      x, y, rotation,
      gridCellMm, gridOrigin, gridRotation,
      soilNotes?, photoPointId?, archivedAt? }

Ring = { points: [{x, y}], curved: boolean }   // closed; curved ⇒ spline through points
```
- `kind` — `raised | inGround | container | greenhouse | coldFrame | border | mound`
- `purpose` — `annualVeg | perennial | native | mixed` — drives whether rotation
  checking runs, which planting defaults apply, and the default `layoutMode`.
- **There is no `widthMm`/`lengthMm`.** A bed is its outline; a rectangle is the
  four-point case. Width and height are derived from the bounding box, which is
  the only honest answer once beds are L-shaped.
- Beds are **archived, never deleted.** A deleted bed orphans a decade of history.

### 4.1 Bed shape

Real gardens are not made of rectangles. Raised beds go L-shaped around a corner
and U-shaped around a sitting area; island borders are kidneys; herb gardens are
spirals; in-ground plots follow a property line; and a great many beds have a
tree, a downspout, a stump or a boulder in the middle of them.

Two separable problems live here, with very different costs.

**The outline is cheap.** A closed ring of points, optionally splined for curves.
Rendering, hit-testing and area are standard geometry, and the corner-tapping
machinery from the photo trace (D-015) already produces exactly this — going from
four points to N is a smaller change than it sounds. `holes[]` covers the tree in
the middle: a second ring, subtracted.

**The interior is where the cost is**, and it is handled by clipping rather than
by special-casing:

> Lay a regular grid over the bed's **bounding box** in the bed's local space,
> then clip every cell against `outline` minus `holes`. Each cell carries a
> `coverage` fraction in 0…1.

```
GridCell { col, row, coverage }     // 1.0 interior, 0…1 at the boundary, 0 outside
```

- `coverage ≥ 0.85` — a full cell, full plant capacity.
- `0.3 ≤ coverage < 0.85` — usable at reduced capacity: a 60%-covered cell fits
  60% of `plantsPerCell`, rounded down.
- `coverage < 0.3` — unusable; drawn as bed, not as planting space.

The point of doing it this way is that **the grid stays a regular lattice.**
Spacing validation, occupancy queries, capacity maths and yield-per-square-foot
all keep working unchanged; the shape reaches them only as a per-cell number, and
a rectangle is simply the case where every coverage is 1.0.

`gridOrigin` and `gridRotation` are separate from the bed's own `rotation`
because a bed set at an angle to the property line still wants its rows aligned
to something deliberate — usually east–west for sun, not to the bed's edge.

**Not modelled:** elevation. Terraced beds, hügelkultur mounds and slopes are
real and are recorded in `soilNotes` and photos, not in geometry. Modelling
terrain is a different application (D-020).

### 4.1b Drawing assists

Beds are geometry, and the gardener drawing them is not a draughtsman. The
assists that make this work are cheap, and they are worth naming in the model
because two of them change what gets *stored*.

**Numeric entry is a peer of drawing, not a fallback.** Half of "I can't draw" is
really "I know it's 4 by 8, let me just say so." So every edge of a bed carries an
editable length; tap it, type `8'`, and the geometry solves. Rough-then-refine is
the intended order, and a blobby bed is legitimately usable before any refinement.

**Snapping is per-tool, and the drift tool deliberately has none.** Snapping a
naturalistic drift to a grid would be actively wrong — a drift is a blob by
nature, and false precision misrepresents it (D-024).

```
Ring { points, curved, snapIncrementMm?, angleSnapDeg? }   // per-ring, remembered
```

The snap settings live on the ring so redrawing a bed a year later behaves the
way it did the first time.

### 4.2 Footprints — how a planting occupies a bed

`layoutMode` ∈ `grid | free`, defaulting from `Bed.purpose`. This is the part
that isn't only about shape:

> **A square-foot grid is the wrong primitive for a native planting.**
> Naturalistic and matrix planting is drifts, masses and repeats — flowing groups
> of one species — not a lattice. Forcing a prairie border onto a 1 ft grid
> doesn't approximate it badly; it describes something else entirely.

So a Planting's footprint is a discriminated union, and all three modes reduce to
an area, which is what every downstream query actually needs:

```
Footprint =
  | { mode: 'cells',  cells: [{col,row}] }                    // annual veg
  | { mode: 'drift',  ring: Ring, count, spacingMm }          // a mass of one variety
  | { mode: 'point',  x, y, radiusMm }                        // one specimen
```

- **cells** — square-foot vegetable growing. Capacity from `plantsPerCell` ×
  `coverage`.
- **drift** — draw a blob, say how many go in it. Density is checked against
  `spacingMm`, and the app can scatter *n* jittered positions inside the ring for
  display rather than pretending they're on a grid.
- **point** — a single shrub, tree or specimen perennial, whose `radiusMm` grows
  with `currentSpreadMm` as it matures (§3).

Occupancy (§3) is unchanged in shape: it asks which footprints cover a location
at a date. It just now asks it of three footprint kinds instead of one.

### BedPhoto — the traced backdrop and the time-lapse
```
BedPhoto { id, bedId, photoId, capturedAt, isPhotoPoint,
           corners?: [{x,y} × 4],   // user-tapped, for perspective correction
           homography?,             // derived from corners
           referenceEdgeMm? }       // one real measurement gives the rest scale
```

Two jobs, one entity. **Setup:** tap the four corners of the bed in a photo,
enter one measured edge, and the homography rectifies it to a top-down plan you
can lay a grid on. **History:** flag one angle as the bed's `photoPoint` and
every later shot from that spot stacks into an aligned time-lapse. See D-015 for
why this is a tracing aid and not an auto-detector.

### Photo
```
Photo { id, blob, capturedAt, width, height, bytes, plantingId?, bedId? }
```
Downscaled on capture, and **EXIF stripped before the blob is ever written**
(D-028). A phone photo of a bed carries that bed's coordinates in its metadata,
and storing it unstripped quietly defeats every other location protection in the
app — this is the easiest of them to forget and the most complete to lose.

Photos are ~95% of stored bytes, so the budget needs to be visible in the UI
(P0-08), and they are separately quota-able for sync (D-025).

### Variety
```
Variety { id, commonName, scientificName?, cultivar?, family, lifecycle,
          daysToMaturity?, dtmFrom,           // sow | transplant — see below
          spacingMm, matureSpreadMm?, matureHeightMm?, plantsPerCell?,
          hardinessZoneMin?, hardinessZoneMax?, heatZoneMax?,
          genus?, feederClass, sunRequirement, moisture, sowMethod, frostTolerance,
          bloomStartMonth?, bloomEndMonth?,   // natives & perennials
          nativeToRegionIds[],                // from USDA PLANTS + curation
          pollinatorValue?, hostGenera[],     // what larvae eat it
          seedLongevityYears, isCustom, notes? }
```

- `dtmFrom` is not a detail. Days-to-maturity counts from **sow** for direct-sown
  crops and from **transplant** for started ones. Store which; getting it wrong
  silently breaks every derived date in the app.
- `nativeToRegionIds` is a set, not a flag, per §2.
- `hostGenera` is the Tallamy-style "this oak feeds 500 caterpillar species"
  data. It's the single most persuasive number in native gardening and the
  hardest to source cleanly — see D-012.
- `seedLongevityYears` lives here, not on the packet: viability is a property of
  the species (onion 1, tomato 4–6, cucumber 5–10) applied to a packet's age.
- `feederClass` ∈ `heavy | moderate | light | fixer`. Small field, large payoff —
  it makes the most reliable companion advice computable rather than looked up
  (§4.3).

### SeedPacket
```
SeedPacket { id, varietyId, form, vendor?, purchasedYear, lotYear?,
             quantity?, quantityUnit, germinationTest?, usedUpAt?, notes? }
```
`form` — `seed | bulb | tuber | rhizome | bareRoot | plug | potted`. The user's
sourcing request spans all of these, and a bareroot order has a receive-by window
that a seed packet doesn't.

### Planting
```
Planting { id, bedId, varietyId, seedPacketId?, seasonYear,
           footprint,                    // Footprint union — §4.2
           method,                       // directSow | transplant | purchasedStart
                                         // | bulbPlant | bareRoot | division
           plannedSowDate, plannedTransplantDate?,
           plannedFirstHarvest?, plannedEndDate?,      // null = perennial
           actualSowDate?, actualTransplantDate?,
           actualFirstHarvest?, actualEndDate?,
           establishedYear?, currentSpreadMm?, dividedFromPlantingId?,
           dormantFrom?, dormantTo?,
           status, notes? }
```
**Planned and actual are separate fields.** Comparing them *is* the learning —
"I always start peppers three weeks late" becomes a query, not a memory.

`status` ∈ `planned | sown | germinated | transplanted | growing | harvesting |
established | dormant | finished | failed`. `failed` is first-class and takes a
reason.

### Event
```
Event { id, plantingId?, bedId?, siteId?, occurredAt, kind, payload, photoIds[] }
```
`kind` ∈ `harvest | observation | pest | disease | treatment | amendment | water |
bloom | division | weather | photo | statusChange`

One table, discriminated by kind — see D-007. `bloom` is new: bloom-time
succession (something flowering every week, March to October) is the core
planning question in a pollinator planting, the way yield is in a veg bed.

### Task and TaskRule
```
TaskRule { id, kind, sourceType, sourceId?, title, category,
           schedule,                    // oneOff | recurring | derived
           offsetFrom?, offsetDays?,    // derived: "14d after germination"
           recurEvery?, recurUnit?,
           weatherSkip?,                // e.g. skip watering if rain > 12mm/48h
           notify, leadTimeDays, active }

Task { id, ruleId?, plantingId?, bedId?, title, category,
       dueDate, completedAt?, snoozedTo?, notes? }
```
Three kinds of task, and the third is the interesting one:

1. **One-off** — "fix the fence."
2. **Recurring** — "check drip lines weekly."
3. **Derived** — generated from plantings by the same engine that computes
   planting dates. "Thin carrots 14 days after germination." "Side-dress tomatoes
   at first fruit set." "Divide the hostas in year 4." "Cut back the natives
   *after* the birds have had the seed heads, not in fall."

Derived tasks are where a task list stops being a to-do app and starts being the
thing that makes you a better gardener, because they encode the knowledge you
otherwise have to remember to look up.

### VendorListing
Cached results from the sourcing search (§ D-014). Deliberately a cache, not a
catalog — it has a TTL, it is never the source of truth for a Variety, and the
app works completely without it.

```
VendorListing { id, vendorId, varietyId?, matchConfidence,
                title, form, price?, currency, inStock, url,
                imageUrl?, fetchedAt, ttl }
```
`varietyId` is nullable and `matchConfidence` exists because vendor product
titles are free text — "Cherokee Purple" vs "Tomato, Cherokee Purple (OP)" — and
pretending that match is exact would corrupt the catalog.

### 4.3 Companion planting

Two things have to be right here, and neither is the lookup table everyone
expects.

**First: most of what circulates as companion planting is unverified.** Some of
it is well supported — the Three Sisters, *Tagetes patula* suppressing root-knot
nematodes, umbellifers and asters feeding parasitoid wasps and hoverflies, trap
cropping squash bugs onto blue hubbard, juglone from black walnut killing
tomatoes. Some of it traces to a single popular book from the 1970s and has never
survived a trial. Shipping both at the same confidence, as nearly every garden app
does, is the actual failure — so **evidence tier is a required field and is always
visible in the UI** (D-021).

**Second: the most reliable advice isn't a table at all — it's arithmetic over
attributes we already store.**

```
derived(a, b) =
    shading      : a.matureHeightMm shades b given bed aspect and b.sunRequirement
    competition  : a.feederClass = heavy AND b.feederClass = heavy, adjacent
    enrichment   : a.feederClass = fixer preceding or beside b = heavy
    sharedPest   : a.family = b.family   → same pests, same diseases, adjacent
    spacing      : a.matureSpreadMm + b.matureSpreadMm > gap between them
```

Every one of those is computed from fields the catalog already has, carries no
folklore risk, and is more useful than most of the table. `sharedPest` is the same
derivation as crop rotation seen sideways: rotation is one family in one *place*
across *years*; shared pest is one family in *adjacent* places in one *season*.

#### The relationship table

```
CompanionRelation {
  id, subjectTaxon, objectTaxon,        // TaxonRef — see below
  polarity,                             // beneficial | antagonistic
  mechanism, evidenceTier,
  concurrency,                          // concurrent | sequential
  radiusMm,                             // from the mechanism, not the pair
  effectSize?, source, notes
}

TaxonRef = { rank: 'family'|'genus'|'species'|'variety', id }
```

- **Relations are between taxa, not varieties.** The claim is "tomatoes and
  basil," not "Cherokee Purple and Genovese." Resolution walks *up* — variety →
  species → genus → family — and stops at the first match. Storing this per
  variety would be both wrong and enormous.
- `mechanism` ∈ `nitrogenFixation | structuralSupport | nurseShade | livingMulch |
  pestRepellent | trapCrop | beneficialInsectary | nematodeSuppression |
  pollinatorAttraction | allelopathy | resourceCompetition | sharedPestOrDisease`
- `evidenceTier` ∈ `trial | extension | traditional | yourGarden` (D-021).
- **`radiusMm` belongs to the mechanism, not to the pair.** Allelopathy is a root
  zone measured in metres. A trap crop must be near but explicitly *not* adjacent.
  An insectary planting works at insect flight distance — tens of metres — which
  means **it crosses bed boundaries**, and the evaluation query is therefore over
  the site, not over one bed.
- `concurrency` distinguishes companions from sequences. Spring peas feeding the
  squash that follows them is a *sequential* relation and only makes sense because
  plantings are time-ranged (D-003). Folk tables cannot express this at all.

#### Evaluation

A candidate placement is scored against every planting whose footprint falls
within the mechanism's radius **and** whose date range overlaps (or, for
sequential relations, immediately precedes) it. Antagonistic results surface as
planner warnings on the same path as rotation warnings; beneficial ones surface as
suggestions.

#### `yourGarden` — the honest tier

Once several seasons are recorded, the app can observe that two things were
planted adjacent twice and note how they did. This is the tier that ties companion
planting to the variety verdicts, and it is also the one most easily oversold: two
observations, no control plot, and weather confounding everything is **a reason to
pay attention, not a finding.** The UI must say so — sample size shown, never
promoted above `extension`, never stated as a cause.

### 4.4 Light

Sun is the input gardeners get most wrong and apps model most crudely. A single
`sunHours` number on a bed is wrong in three directions at once, so there isn't
one:

- **Wrong spatially.** A bed against a fence has a shaded strip along one edge. A
  bed at the drip line of a maple is full sun at one end and dappled at the other.
  "Part of a bed" is the natural unit, not the bed.
- **Wrong across the day.** Six hours of morning sun and six hours of afternoon
  sun are not the same six hours. Afternoon sun is hotter and harsher; lettuce,
  spinach and most woodland natives want morning sun *and* afternoon shade.
  Collapsing to one number throws away the most actionable part.
- **Wrong across the year.** The bed that is full sun in early May is half shaded
  by August — the sun drops in the sky and the deciduous canopy that wasn't there
  in April now is. This is the single thing gardeners most consistently misjudge,
  and it's the reason a spring plan fails in July.

So light is a **field over the site**, sampled on a regular lattice independent of
any bed's grid — because perennial and native beds use drifts, not cells (§4.2),
and still need to know what the sun is doing.

```
Obstruction { id, siteId, kind, outline: Ring, heightMm,
              opacity,                       // 0 = solid, ~0.2–0.4 = deciduous canopy
              leafOutMonth?, leafDropMonth?, // deciduous: two obstructions, one object
              archivedAt? }

LightSample { siteId, x, y, monthOfYear,
              morningHours, afternoonHours, source }
```

- `kind` ∈ `building | fence | wall | shed | tree | shrub | structure`.
- Obstructions are **rings with a height** — the same geometry as beds (D-019),
  which is why they cost so little to add.
- `opacity` gives dappled shade a truthful value. A deciduous canopy in leaf
  passes light; a shed does not.
- `leafOutMonth`/`leafDropMonth` are really a **presence window**, not a botanical
  fact. Shade cloth over a summer bed is an obstruction that exists for part of
  the year by choice rather than by biology, and it wants exactly the same field.
  Name the pair `presentFrom`/`presentTo` and both cases are covered.

#### Three sources, one field

`LightSample.source` ∈ `painted | computed | observed`, and they are not equal:

| Source | How | Durability |
|---|---|---|
| `painted` | the gardener shades cells by hand, per season window | **user-authored — durable, never overwritten** |
| `computed` | solar position + shadow projection from obstructions | **a cache — recompute whenever obstructions change** |
| `observed` | a guided task pings hourly on a sunny day; you tap sun or shade per bed | user-authored, durable |

The distinction matters for storage: computed samples are derived data and should
never be treated as truth to be migrated. Painted and observed samples are the
gardener's own record and must survive everything.

#### The computation

Solar azimuth and altitude come from latitude, longitude and timestamp — a
well-documented closed-form algorithm, pure arithmetic, no network. Project each
obstruction's outline along the solar vector at its height, test lattice points
for containment, and integrate over the daylight hours of the chosen day, keeping
morning and afternoon separately.

It is entirely offline, entirely deterministic, and belongs in the domain package
with the scheduling arithmetic — some of the most testable code in the app.

**Not modelled:** terrain. Slope and aspect genuinely affect light, and modelling
elevation is out of scope for the same reason it is for beds (D-020). A garden on
a north slope gets a site-level note, not a heightmap.

#### What it's for

A light map that doesn't change a decision is a toy. It feeds four:

1. **Placement warnings** — `Variety.sunRequirement` against the cells actually
   chosen. Third consumer of the warning surface, after rotation and companions.
2. **Placement suggestions** — "these cells get 4h, morning-weighted; here's what
   suits," filtered through the seed box exactly like companion suggestions.
3. **Explaining history** — the fall lettuce that bolted was in the spot that got
   nine hours in July. This is the "history that pays off" principle applied to
   the one variable nobody records.
4. **Siting a new bed** — where in this yard is there six hours in August.

### VarietyVerdict
```
VarietyVerdict { id, varietyId, seasonYear, rating, growAgain, note }
```
Its own entity, not a field on Variety: the answer is per-season, and the change
across seasons is the interesting part.

## 5. Derived scheduling

Given a Site and a Variety, a new **annual** Planting computes:

```
transplant date  = lastFrost + variety.transplantOffsetDays   (negative for hardy)
start indoors    = transplant − variety.weeksIndoors
direct sow       = lastFrost + variety.directSowOffsetDays
first harvest    = (sow | transplant) + daysToMaturity   // per dtmFrom
end of planting  = firstHarvest + variety.harvestWindowDays
```

Fall and overwintering crops invert it, anchored to `firstFrostDate`. Same
arithmetic, different anchor, and worth building both directions at once.

**Perennials use a different calculation entirely** — there is no maturity date,
there's an establishment curve. Year 1 is survival, year 2 is growth, year 3 is
bloom. What gets derived is the *care* calendar (divide in year N, cut back in
month M, first bloom expected in year 3), which is exactly what feeds derived
tasks above.

Every derived date is an editable default. Nothing is ever locked.

## 6. Storage & sync readiness

Local-first (D-002), IndexedDB. Sync isn't being built now, but three cheap rules
now make it possible later without a migration:

1. **Every record has a client-generated UUIDv7 `id`.** No autoincrement keys —
   they collide the moment a second device exists.
2. **Every record has `updatedAt` and `deletedAt`.** Soft deletes only; a hard
   delete cannot be replicated.
3. **Records are small and independently writable.** This is why `Event` is
   append-only and why photos are separate rows from what they illustrate.

Enough for field-level last-write-wins, which is the right ceiling here. **No CRDT
library** — see D-008.

## 7. What the model deliberately does not have

- **Users.** v1 has no accounts. `ownerId` later is additive.
- **A generic tagging system.** Families, lifecycles and statuses are
  enumerations because we want to query them. Free tags are how you avoid
  deciding what the enumeration should be.
- **A live plant-database dependency.** Bundled versioned JSON — see D-006, D-012.
- **Vendor catalogs as first-class data.** They're a cache with a TTL — D-014.
