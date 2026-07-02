---
id: "0025"
title: "E4: Sectoral structure — historical stacked-area (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E4, §3
depends_on: ["0016", "0017", "0036"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/SPEC-render-pipeline-target.DELTA-6-14.md
---
**Goal** — Stacked area, one band per sector stacked to the GDP total across the full window; y = level (mln_gel), compact axis; plus a C7 **year×sector pivot** table view with a `საშუალო` (mean) footer (img_14).

**Implements** — SPEC §2 E4 + §3.

**Files / modules touched** — sectoral stacked-area config; verify lowered spec type is warmed.

**Dependencies** — 0016 (C1 — y-axis compact), 0017 (C2 — per-(sector,year) reads; **verify the stacked-area spec lowers to a warmed type** — query+pipe = warmed; if it lowers to `transform`, C2-a must cover it), 0036 (C7 — the year×sector pivot table view; its `საშუალო` mean footer uses the C5 `mean` reduction, never CAGR).

**Acceptance criteria (incl. fitness functions)**
- [ ] DataSpec: `query { measure:'regional.gva'|GVA, filter:{ geo pinned, sector:{$ne:'_T'}, time: window } }` → `aggregate by [sector,time]` → `lookup sector (label,color)` → stack by sector over time.
- [ ] y-axis → compact (C1); legend = localized sector labels.
- [ ] Filter reactions: range change re-reads window (bands extend/contract); region-select (if geo-scoped) re-aggregates; locale → legend + axis; visible only in the dynamics perspective that owns the historical view.
- [ ] Warm: per-(sector,year) reads covered; if the spec lowers to `transform`/`pivot`, C2-a (0017) covers it. FF-WARM-COVERS-RENDER + FF-NO-EMPTY-REQS-FOR-READING-SPEC green.
- [ ] Empty: no sectors → empty; single sector → degenerate area (valid, not an error).
- [ ] C7 table view (0036): year×sector pivot of the same warmed rows with a `საშუალო` mean footer (FF-TABLE-FOOTER-MEAN — arithmetic mean per O-5, never CAGR); FF-DUALVIEW-ONE-DATA green.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — The "verify warmed type" check is the concrete C2 payoff here. Two-way door.
