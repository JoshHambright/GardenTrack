# Storage budget

P0-08. Photos are ~95% of what GardenTrack stores, and browser quota and
eviction rules are the kind of thing you find out too late. So this is a
measurement, not a guess.

Status: measured 2026-09-21 · re-measure on real devices before Phase 5

---

## What was measured

40 downscaled JPEGs written to real IndexedDB through the real store layer, with
`navigator.storage.estimate()` polled until it settled.

| | |
|---|---|
| Browser | Chromium (headless), Linux container |
| Photo | 1280 px long edge, JPEG q0.72, synthetic foliage noise |
| Mean photo size | **220 KB** |
| Quota offered | **898 MB** |
| Usage delta for 40 photos | **8.6 MB** |
| **IndexedDB overhead on blobs** | **1.00×** — none worth counting |
| Photos that fit in quota | **≈ 4,100** |
| Write time | 0.2 ms per photo |
| `navigator.storage.persist()` | **not granted** |

## The budget

**300 KB per photo, hard.** Downscale to 1600 px long edge at q0.8 for a bed's
photo-point series, which needs enough detail to compare across seasons, and
1280 px at q0.72 for everything else. Both land comfortably under the cap.

At 220 KB and a season of ~400 photos, quota here holds **about ten years** of
garden. That is the right order of magnitude to design for.

**Thresholds:** warn the gardener at 60% of quota, refuse new photo writes at
85% and offer export. Never let a write failure be the first notification —
local-first (D-002) means a failed write is data loss.

## Caveats that matter more than the numbers

1. **Quota is a fraction of free disk, not a constant.** Chromium offers roughly
   60% of what's available. A phone at 95% full offers very little. The 898 MB
   above describes this container, not Josh's phone — treat the *ratio* and the
   *per-photo size* as portable, and the absolute capacity as local.
2. **`persist()` was refused**, which is expected headless: browsers grant it on
   engagement signals — installation, repeat visits, bookmarking. Without it the
   origin is evictable under storage pressure. The app therefore asks for it on
   load and **shows the answer** rather than assuming, and JSON export (Phase 5)
   is the backstop, not a nicety.
3. **Synthetic photos compress like real ones only approximately.** Foliage noise
   was used deliberately because a flat test image compresses to nothing and
   would have flattered the result. Real photos should be re-measured on a real
   phone before Phase 5 commits to the cap.
4. **The first run of this probe produced a fiction** — `estimate()` is updated
   lazily, so reading it immediately after writing reported no change and the
   capacity figure came out as 868,224 photos. The probe now polls until the
   figure settles and refuses to derive a capacity from an overhead ratio outside
   0.5–5×. Worth remembering: a measurement that produces a suspiciously good
   number is usually measuring nothing.
