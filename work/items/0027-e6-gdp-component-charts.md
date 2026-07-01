---
id: "0027"
title: "E6: GDP component charts — expenditure bar / production donut / income treemap / capital donut (wiring + verification)"
status: backlog
class: G
priority: P2
owner: —
implements: SPEC §2 E6, §3
depends_on: ["0016", "0017", "0020", "0014"]
links:
  - platform/work/SPEC-render-pipeline-target.md
---
**Goal** — Decompose GDP across the component dimension at a single year — expenditure bar, production donut (center total), income-formation treemap, capital-formation donut — with no degenerate 2-bar / 1-slice output.

**Implements** — SPEC §2 E6 + §3.

**Files / modules touched** — GDP component-panel config (expenditure/production/income/capital).

**Dependencies** — 0016 (C1), 0017 (C2), 0020 (C6 rollup + pinning + degenerate guard), 0014 (O-6 — exact component `measure`-code set; HIGHEST-MATERIAL, may need database-architect). Cannot fully close until O-6 resolves.

**Acceptance criteria (incl. fitness functions)**
- [ ] DataSpec: `query { measure:<component set>, filter:{ geo:'GE', approach:'EXP'|'PROD', time: single year } }` → `aggregate by [componentDim, time]` → `rollup` total (where a Total wedge shows) → `lookup (label,color)` → `sort`. Pins approach + geo + single time; iterates the component dim (per O-6).
- [ ] Expenditure shows N components (not 2 year-bars); production donut shows the full sector/component set (not ~4 slices dominated by one wedge).
- [ ] **FF-COMPONENT-DECOMP** (0020): ≥2 components resolved, or diagnoses (`COMPONENT_DECOMP_DEGENERATE`); `< 2` → empty-state, never the misleading 2-bar chart.
- [ ] value → `mln_gel` or `pct`; data-labels → `fmtNum` (FF-FORMAT-SSOT, 0016).
- [ ] Filter reactions: year change re-reads at the new single year; locale → component labels; annual-only elements.
- [ ] Warm: `query`+pipe warmed per component code at the pinned year (FF-WARM-COVERS-RENDER, 0017).
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Blocked on O-6 (0014) for the exact query. Mirror the correct sectoral donut (~3370). Two-way door at config level.
