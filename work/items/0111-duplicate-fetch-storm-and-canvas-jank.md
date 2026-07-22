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
