# Privacy — location minimisation

**GardenTrack never stores where you live.** Not for the developer, not for any
future user. It stores the *coarse cell* and the *region codes* that its features
actually need, and it is built so that a precise position has nowhere to be kept.

Status: `DRAFT v1` · Last updated: 2026-09-12 · Decision: D-028

---

## 1. Why this is affordable

The intuition is that a garden app needs to know where your garden is. It
doesn't. Here is what each feature actually requires:

| Feature | Really needs | Coarsest input that still works |
|---|---|---|
| Solar position, shadow casting (Ph. 4) | latitude, longitude | **±0.1°** — see §2 |
| Hardiness zone | a zone band | a cell; ambiguity is handled by taking the colder band |
| Frost profile | a climate station or county | region code |
| Nativity (Ph. 2) | an ecoregion | region code |
| Weather, GDD (Ph. 10) | a forecast grid cell | ~10 km cell |
| Everything else | nothing | — |

Not one of them needs a street address, and only one needs coordinates at all.

## 2. The solar argument, since it's the one that sounds hard

Shadow casting sounds like it demands precision. It doesn't:

- **0.1° of latitude ≈ 11 km**, and solar altitude error tracks latitude error
  roughly 1:1 — so ±0.1°.
- **0.1° of longitude ≈ 8.6 km** at 40° N, and solar time shifts ~4 minutes per
  *whole* degree — so about **24 seconds**.
- Net effect on computed direct-sun hours: **a minute or two a day near the
  solstices, less at the equinoxes.**

A bed is four feet wide and the gardener rounds "about six hours" in their head.
Two minutes a day is far below the resolution of the decision the number informs.
**The precision costs nothing, so there is no reason to hold it.**

## 3. What is stored

```
GeoCell {
  lat, lon,          // rounded to a grid, never the input value
  precisionDeg,      // 0.1 by default — stated, not implied
  method             // 'rounded' — never 'jittered'
}
```

**Rounded to a shared grid, not jittered.** Random offset feels private and isn't:
repeated observations average back toward the true point, and it makes every
computation irreproducible. Rounding puts everyone in a cell on the same value,
which is the property that actually helps. At 0.1° a cell is roughly 95 km².

Alongside it, `Site.regionIds[]` — ecoregion, state, optionally county. County is
optional because it is the most identifying of the three and only the frost
profile benefits from it.

## 4. What is never stored, anywhere

- A street address, or any free-text location string.
- Raw device geolocation, or an un-rounded map pin.
- A postcode. (A rural postcode can be a very small number of households.)
- **EXIF GPS in photographs.** Stripped on import, before the image is written —
  see §6. A phone photo of a bed carries the bed's coordinates unless you remove
  them, which quietly defeats everything else on this page.

## 5. Making it structural, not a rule

A rule that lives in prose gets forgotten — that is exactly how D-018's
touch-target rule got broken by the first component built against it. So:

1. **The domain type has no field for a precise coordinate.** `Site` holds a
   `GeoCell`. There is nowhere to put a full-precision value.
2. **One constructor.** `coarsen(lat, lon, precisionDeg) -> GeoCell` is the only
   way to make one, and it rounds. Raw coordinates exist as local variables for
   the length of one function call and are never returned.
3. **A test asserts it.** Feed known coordinates in, assert the stored value is
   on the grid and that no field anywhere in a serialised `Site` matches the
   input to more than `precisionDeg`.
4. **A network rule:** any outbound request carries the `GeoCell`, never a finer
   position. One place to audit.

## 6. Setup without disclosure

Setup asks for the least it can, in this order of preference:

1. **Pick your zone and frost dates by hand.** No location at all. Always offered.
2. **Drag a pin on a map.** Rounded on drop, and the UI shows the cell it landed
   in so the coarsening is visible rather than claimed.
3. **Use device location.** Rounded in memory before anything is written.

**No geocoding round-trip.** Typing an address and sending it to a service to be
resolved discloses the address to that service, which is the thing we are avoiding.
If a lookup must happen, it sends the cell.

**Photographs:** EXIF is stripped at import, before the blob is stored. Note
honestly that a photo of a house is identifying whether or not it carries
coordinates — so sharing (Phase 9) treats photos as a separate opt-in, and the
QR bed stakes (Phase 9) resolve locally rather than to a public URL where a code
in a front garden becomes a pointer to a public page.

## 7. Threat model, stated honestly

**This protects against:** a leaked repository or git history · a shared export
or backup file · a stolen or subpoenaed sync database · an artifact or screenshot
shared publicly · a share link forwarded further than intended · casual
disclosure by a future contributor who didn't know the rule.

**This does not protect against:** anyone holding the unlocked device · IP-based
geolocation by any server the app talks to (which is why the sourcing proxy and
sync should log as little as possible, and why neither is required to use the
app) · the identifying content of photographs themselves · a user who types their
address into a note field, which the app cannot prevent and should not pretend to.

Claiming more than this would be worse than claiming nothing.

## 8. Display

The UI never renders a place name or coordinates as the user's location. It shows
what the app actually uses: **"Zone 6a · Eastern Corn Belt Plains · last frost
May 13 (cautious)"**. That is more useful to a gardener than a town name, and it
keeps a screenshot safe to share.
