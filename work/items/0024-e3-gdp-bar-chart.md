---
id: "0024"
title: "E3: GDP bar chart — annual dynamics (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E3, §3
depends_on: ["0016", "0017", "0036"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Goal** — Vertical bars, one per year across the window; y = GDP level (mln_gel), with a compact axis that no longer duplicates ticks; plus a C7 table view (img_8: year│value) that re-encodes the same warmed rows.

**Implements** — SPEC §2 E3 + §3.

**Files / modules touched** — GDP/regional bar-chart config; no engine change once C1/C2 land.

**Dependencies** — 0016 (C1 — axis compact), 0017 (C2 — `query`/`growth` per-year warm), 0036 (C7 — the chart↔table dual-view; the table view re-encodes the same warmed rows, no second query).

**Acceptance criteria (incl. fitness functions)**
- [ ] `query`/`growth` over the time window; pipe `sort time asc`; bounds from `fromDim`/`toDim` (range) or the point (annual).
- [ ] **Axis ticks → compact (`2K, 4K, 6K, 8K`), NOT `2 000, 2 000, 3 000`** (the duplicate-tick bug); data-labels (if on) → `fmtNum(v,1)`. FF-AXIS-MONOTONIC (0016) green for this axis.
- [ ] Filter reactions: year-range change re-reads enumerated years (bars add/remove, axis rescales); locale re-glyphs; element `visibleWhen perspective-is` its owning perspective.
- [ ] Warm: one req per (code, year) enumerated across the window; range-mode unbounded req keys identically to the read (GAP-4). FF-WARM-COVERS-RENDER (0017) green.
- [ ] Empty: zero years → empty plot area with axes.
- [ ] C7 table view (0036) renders the same warmed rows (img_8: year│value); FF-DUALVIEW-ONE-DATA green for this section.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Two-way door.
