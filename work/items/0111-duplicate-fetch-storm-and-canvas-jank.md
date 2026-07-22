---
id: "0111"
title: "Duplicate-fetch storm + page-switch long-task jank — the likely root of the owner's canvas 'freeze'"
status: backlog
class: G
priority: P1
owner: —
links:
  - work/items/0109-canvas-editor-freeze-and-active-area-misplacement.md   # Symptom A dossier lives there
---
**Goal** — chief-engineer walk (2026-07-22, 0109 §Symptom A): every config/classifier/cube/dataset/observation request fires ≥2× (no in-flight dedup; `classifiers/measure` ~18×); each page switch re-fetches ALL cubes even for hidden pages; ~430ms cumulative main-thread block per switch (long tasks 100–449ms). No hard deadlock reproduced — but on the owner's real host/data this fan-out can saturate the FetchScheduler budget and stall data-dependent renders = the felt «იჭედება». Kill the class: in-flight identical-query coalescing at the ONE scheduler seam (the 0092 ADR-048 documented-YAGNI follow-up — the walk just un-YAGNI'd it) + don't fetch hidden pages' cubes (visibility-scoped warm) + StrictMode double-invoke accounted honestly in the measurement.

**DoD** — identical concurrent requests coalesce to one wire call (fitness at the scheduler seam) · page switch fetches only the VISIBLE page's needs · long-task budget per switch measurably down (before/after numbers in the card) · live re-walk: no duplicate rows in the network log for one gesture.

**Notes** — Untested freeze suspects (owner-state deltas) stay open in 0109: native drag-drop path, long-session listener leak (`CanvasOverlay.tsx:326-334` ResizeObserver), production build, large datasets. Also surfaced: `measure()` full-tree querySelector per RO-fire (0109 §3) — same perf family, fix alongside. **+ 0109 residual (2026-07-22 re-walk):** overlay rect recompute misses chart↔table view toggles (stale 4×4 hit-target until next scroll/resize) — recompute must trigger on visibility/layout mutation too.

## Coalescing landed (2026-07-22, engine-specialist)

**What shipped.** In-flight identical-request coalescing AT the ONE `FetchScheduler` seam (`packages/core/src/data/fetch-scheduler.ts`), layered ON TOP of ADR-048's concurrency-cap + backoff queue — no new cache layer (the store `_cache` stays SSOT). While one idempotent (GET/HEAD, no body) fetch for a key is in flight, every identical concurrent caller shares that ONE wire call; each caller receives an independent `.clone()` (a body reads once); the gate clears on settle so a post-settle re-request fetches fresh. Key = method + URL + normalized headers, so a conditional revalidation (`If-None-Match`) never folds into an unconditional miss. Error/reject settles ALL coalesced callers once — no retry amplification. Fitness: `FF-SCHEDULER-COALESCE` (8 cases: fold-to-one, distinct-stay-parallel, conditional-header-split, coalesced 500 to all, coalesced reject to all, post-settle-fresh, no-second-slot, `coalesceKeyFor` idempotency).

**+ routed the stats-api adapter boundary through the seam.** The measured loudest class — `GET /api/stats/classifiers/measure` ~18× — did NOT flow through the scheduler: it used a RAW `fetch` in `packages/plugins/datasources/stats-api.ts` (`getAt`). Routed `getAt` (backs classifiers, datasets, dataset-meta, data-sources, cube-profile) through `scheduleFetch` — the exact ADR-048 D4 precedent that already routed the boot fetch. This is the change that actually collapses the classifier/dataset/cube/config fan-out; without it, coalescing would only have touched the observation + boot paths. Reversible in one line if the lead wants it held.

**Which duplicate classes DIE here (genuine multi-consumer fan-out):**
- `classifiers/<dim>` fan-out across every store that carries that dim (the ~18× measure) → 1 while in flight.
- `datasets/<code>` + dataset-meta + `/data-sources` + `cube/<code>/profile` boot/store-build fan-out → 1.
- observation slices requested identically-concurrently by multiple elements (already on the seam) → 1.

**Which classes REMAIN (out of this slice, honest):**
- **StrictMode dev double-invoke** — dev-only React 18 effect double-fire. If the two invokes overlap in flight they now coalesce; if sequential (first settles before second) they do NOT — but this never ships to prod, so it is NOT counted as a real win/loss here.
- **Page-switch re-fetch of ALL cubes (incl. hidden pages)** — a re-fetch that happens AFTER the prior settled is a fresh fetch by design (coalescer is single-flight, not a cache); killing this is the **visibility-scoped warm** follow-up (panel/react-side), deliberately NOT absorbed here.
- **The overlay rect recompute residual** (0109 re-walk) — unrelated, panel-side follow-up.

**Attach seam for the follow-up.** Visibility-scoped fetching attaches where `useNodeRows`/the warm scheduler decides WHICH specs to warm (react/panel) — the coalescer bounds concurrent duplicates but cannot know a page is hidden; that gate is a render-layer concern above the store.

**Gate (packages/core → FULL ritual).** `tsc -b` whole graph = 0; `@statdash/engine` dist rebuilt (tsup) = 0; FULL vitest = **1 failed / 4175 passed / 81 skip / 7 todo** — the one red is the pre-existing `token-cohesion.fitness` flag on `desugar.ts` (`#00A896,#E76F51`), a file this slice never touched (the tolerated 0106 red). Parity block (warm-covers / warm-read-key / bind-parity / FF-CANVAS-NEVER-LIES) = 15 passed / 0 failed.
