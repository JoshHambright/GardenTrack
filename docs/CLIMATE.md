# Target climate

The climate GardenTrack is being built against. Every derived date, nativity
claim and solar calculation resolves against these parameters.

**The garden's actual location is not in this repository** — no address, no town,
no postcode, no coordinates. See *Where the location lives* below.

Status: `DRAFT v1` · Last updated: 2026-09-11

---

## Parameters

| Fact | Value | Confidence |
|---|---|---|
| **USDA hardiness zone** | **6a / 6b boundary** (−10 to 0 °F), 2023 map | ⚠️ the site straddles both |
| **AHS heat zone** | ≈ 6 (45–60 days above 86 °F) | 🟨 regional, unverified |
| **EPA Level III ecoregion** | Eastern Corn Belt Plains (55) | 🟨 likely; the area transitions nearby |
| **Setting** | rural, open, not urban | ✅ |

### The zone is genuinely ambiguous, and that matters

The site straddles **6a and 6b** on the 2023 USDA map. That isn't a rounding
detail — it's the difference between a perennial rated to 6b surviving and not.

**Decision:** treat the site as **6a** for perennial selection, and show 6b
candidates as a flagged tier ("marginal here"). Wrong toward caution costs a plant
you could have grown; wrong toward optimism costs a plant.

## Frost dates — and why they are not dates

Published sources disagree for this area, and the disagreement is the finding:

| Source | Last spring | First fall |
|---|---|---|
| Nearest NWS airport station, 1991–2020 normals | ≈ Apr 15 freeze (32 °F) | ≈ Oct 26 freeze (32 °F), ≈ Oct 17 frost |
| Almanac, local | ≈ May 1 at 50% | ≈ Oct 19 at 50% |

Both are right. They differ because:

1. **Different thresholds.** A 32 °F *freeze* and a 36 °F *frost* are different
   events, roughly two weeks apart at each end of the season.
2. **Different probability levels.** A "50% date" means half of all years frost
   *after* it. That is the wrong number to set tomatoes out on.
3. **The airport station is an urban heat island.** This garden is rural and open,
   ~20 miles away. Rural sites frost **later in spring and earlier in fall** than
   a city airport, so the airport normals are optimistic here.

### Working values, pending station data

| | Cautious (≈10%) | Typical (≈50%) |
|---|---|---|
| **Last spring frost** | ≈ May 10–15 | ≈ Apr 28 – May 1 |
| **First fall frost** | ≈ Oct 8–10 | ≈ Oct 17–19 |

Growing season ≈ **170 days** typical, ≈ 150 days cautious.

⚠️ Provisional. Replace with NOAA/MRCC station probabilities from a station
nearer than the regional airport before Phase 3 ships. This session's network
egress blocks weather.gov, plantmaps and the state climate office, so that is a
lookup to be done, not a number to build on permanently.

**This is why frost dates are stored as a distribution, not a date** — see
DATA_MODEL §2 and D-027.

## Where the location lives

The garden's coordinates, address and photographs are **deliberately outside
source control**:

- **Coordinates and address** → `site.local.json`, gitignored. A committed
  `site.local.example.json` shows the shape.
- **Photographs of the property** → never committed. They show a house, its
  layout, and what's worth stealing from a yard. They go in the running app's
  local storage, which is exactly where local-first (D-002) puts them anyway.
- **At runtime** the app holds all of this on-device. That is not a compromise
  for privacy's sake — it is the architecture we already chose.

A public repository should be able to describe the climate a feature targets
without disclosing whose garden it is.
