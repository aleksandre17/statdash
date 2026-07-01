---
id: "0025"
title: "E4: Sectoral structure — historical stacked-area (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E4, §3
depends_on: ["0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — Stacked area, one band per sector stacked to the GDP total across the full window; y = level (mln_gel), compact axis.

**Implements** — SPEC §2 E4 + §3.

**Files / modules touched** — sectoral stacked-area config; verify lowered spec type is warmed.

**Dependencies** — 0016 (C1 — y-axis compact), 0017 (C2 — per-(sector,year) reads; **verify the stacked-area spec lowers to a warmed type** — query+pipe = warmed; if it lowers to `transform`, C2-a must cover it).

**Acceptance criteria (incl. fitness functions)**
- [ ] DataSpec: `query { measure:'regional.gva'|GVA, filter:{ geo pinned, sector:{$ne:'_T'}, time: window } }` → `aggregate by [sector,time]` → `lookup sector (label,color)` → stack by sector over time.
- [ ] y-axis → compact (C1); legend = localized sector labels.
- [ ] Filter reactions: range change re-reads window (bands extend/contract); region-select (if geo-scoped) re-aggregates; locale → legend + axis; visible only in the dynamics perspective that owns the historical view.
- [ ] Warm: per-(sector,year) reads covered; if the spec lowers to `transform`/`pivot`, C2-a (0017) covers it. FF-WARM-COVERS-RENDER + FF-NO-EMPTY-REQS-FOR-READING-SPEC green.
- [ ] Empty: no sectors → empty; single sector → degenerate area (valid, not an error).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — The "verify warmed type" check is the concrete C2 payoff here. Two-way door.
