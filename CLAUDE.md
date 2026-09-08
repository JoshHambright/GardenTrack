# CLAUDE.md — GardenTrack

Guidance for Claude Code working in this repository.

---

## ⚠️ The VM is ephemeral. Commit and push often.

**This project is developed in Claude Code cloud sessions. The container is
temporary and gets reclaimed after inactivity or when the session ends.**

When that happens, the conversation history is restored — **the container's
filesystem is not.** Uncommitted work is gone permanently, with no recovery path.

**GitHub is the only durable storage. Nothing else counts as saved.**

### Rules

1. **Push at every meaningful checkpoint** — a completed task, a passing test
   suite, a working spike, the end of a work session. Do not batch pushes.
2. **Never leave the tree dirty across a long-running operation.**
3. **Push, don't just commit.** A local commit dies with the container.
4. **When in doubt, push.** There is no cost to an extra push. There is a total
   cost to a lost one.
5. **Work in progress is still worth pushing.** Mark it clearly:
   `git commit -m "WIP P3-05: perennial occupancy query, not yet wired up"`
6. **Verify the push landed.** Check the command succeeded — don't assume.

### Sanity check before ending any turn

```bash
git status -sb          # tree clean? branch in sync with origin?
```

If that shows uncommitted changes or unpushed commits, **you are not done.**

### Recovering after a purge

1. `git log --oneline -10` — the last push is where we actually are.
2. Read `docs/TRACKING.md` — task statuses are the source of truth for progress.
3. Read `docs/DECISIONS.md` — do not re-litigate settled decisions.

---

## Project

A web app for planning, tracking and remembering a home garden — annual
vegetables, perennials, and plants native to the local ecoregion. Local-first and
offline by default; the garden has no signal.

**Branch:** `claude/garden-planning-app-xhc4mx` — develop and push here. Never
push elsewhere without explicit permission.

**Related repo:** `../joshify` is a separate project (a Raspberry Pi Spotify
appliance) that shares these documentation conventions. Nothing else.

## Documentation map

| File | Contents |
|---|---|
| `docs/PRODUCT.md` | What we're building, principles, device tiers, feature inventory |
| `docs/DATA_MODEL.md` | The domain model. **Read before ROADMAP.md** |
| `docs/ROADMAP.md` | 11 phases, each with an exit criterion |
| `docs/DECISIONS.md` | ADR log. Read before changing an approach |
| `docs/TRACKING.md` | Live tracker — update in the same commit as the work |
| `spikes/` | Working prototypes. Each has a README on what it proved |

## Visual work: prototype in a page first

**Anything visual gets a published Artifact page for review before it becomes a
task.** The target is a browser, so a published page runs the same CSS the phone
will — a prototype isn't a mockup of the thing, it's the thing on different
hardware. Applies especially to the bed editor and the photo tracing.

1. Build the prototype, publish it, share the link.
2. Iterate on feedback. Only the approved version becomes tracker tasks.
3. **Commit the source under `spikes/<name>/`** with a README covering what it
   proved. The published page is not storage.

Note: this session cannot receive comments left on artifact pages — feedback
comes back through chat.

## Conventions

- **Task IDs in commit messages**: `P3-04: <what changed>`. IDs come from
  `docs/TRACKING.md`.
- **A task is ✅ only when its tests pass in CI**, not when the code works.
- **Non-obvious choices get a `DECISIONS.md` entry.**
- **Cut scope is recorded, not deleted** — mark ❌ with a reason.
- **Optional inputs on public functions take `?: T | undefined`**, not bare
  `?: T`, so `exactOptionalPropertyTypes` doesn't reject an explicit `undefined`.
  Bare `?:` is still right for internal config objects built literally.
- **Every exit criterion names a device.** "It works" is not a claim you can make
  without saying where you were standing (D-018).

## Constraints that are already settled

Do not rediscover or re-argue these. Full reasoning is in `docs/DECISIONS.md`.

- **Local-first. No server in v1** (D-002). Planning and logging work offline,
  always. The sourcing proxy (Phase 6) is the first server and is an *online-only
  enhancement* that never blocks planning.
- **A Planting is time-ranged, not a point in time** (D-003). The bed map is a
  query over date ranges, not stored state.
- **Perennials reserve their cells year-round, including dormancy** (D-013).
  A dormant plant is bare soil that is already occupied. This is the most likely
  bug in the app.
- **Square-foot grid in v1**, with real coordinates reserved in the model so free
  placement is additive later (D-004).
- **Derived dates are stored as values, not recomputed on read** (D-005). History
  has to be immutable to be worth keeping.
- **No live plant-database API.** Bundled versioned JSON; USDA PLANTS is the
  nativity base layer (D-006, D-012).
- **Nativity is a set of regions with a stated scale**, never a boolean. "Native"
  without a scale is a marketing word (D-012).
- **Photo-to-bed is a four-tap tracing aid, not an auto-detector** (D-015).
- **Vendor sourcing is a cache with a TTL**, never catalog truth, and respects
  `robots.txt` and rate limits. We drive traffic *to* independent growers (D-014).
- **Layout follows width; hit targets follow input** (D-018).
- **No CRDT library.** Field-level last-write-wins is the right ceiling (D-008).

## Secrets

**Never commit credentials.** Vendor and weather API keys live in GitHub Secrets
and a gitignored local `.env`. CI must never need a real key — tests run against
recorded fixtures.
