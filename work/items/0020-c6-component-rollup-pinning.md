---
id: "0020"
title: "C6: Component decomposition rollup + dimension pinning + per-capita row-selection (Drift 4 & 5)"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC §1 C6, §4 FF-COMPONENT-DECOMP / FF-ROW-UNAMBIGUOUS
depends_on: ["0014", "0015", "0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/render-drift-audit.md
---
**Goal** — Every component chart pins its full coordinate and rolls up the component dimension explicitly, so expenditure/production charts stop rendering 2 bars / a near-single-slice donut; per-capita 2014 resolves exactly one correct observation.

**Implements** — SPEC §1 C6 (fixes DRIFT 4 & DRIFT 5).

**Root cause (Drift 4)** — "GDP by expenditure method" renders 2 bars (two *years* of total GDP) instead of a component breakdown; production donut collapses to ~4 slices. The panel query under-specifies: the component dimension is neither pinned to a single member nor rolled up, and `time` is not resolving to a single year (multiple years → the two-bar artefact). The obs read does no aggregation.
**Root cause (Drift 5)** — Per-capita 2014 = "483" (~10× low): a wrong/partial row resolved for 2014 — a component or unit-scale mismatch in the obs read / `storeVal` row-selection, same underspecification family.

**Files / modules touched**
- Config (GDP expenditure/production/income/capital panels) — C6-a: pin `approach:'PROD'|'EXP'`, `geo:'GE'`, a single `time` (verify `{$ctx:'time'}` resolves to one year in `year` mode via `binding.selection.kind:'point'` → `time={$ctx:'year'}`); iterate the component dimension (per O-6, item 0014) as the series/category axis. C6-b: pipe `aggregate by [<componentDim>, time]` → one row per component; add the `rollup` total row where a "Total/სულ" wedge shows (mirror the sectoral donut at ~3370).
- `packages/core/src/data` interpret path — C6-c: `< 2` components → `COMPONENT_DECOMP_DEGENERATE` diagnostic; empty → panel empty-state, never the misleading 2-bar chart. C6-d: per-capita `interpretSpec`/`storeVal` row-selection — assert exactly one observation per (measure, geo, time); multi-match → `ROW_AMBIGUOUS` diagnostic, never a silent wrong pick.

**Dependencies** — 0014 (O-6: component dimension / exact measure-code set — HIGHEST-MATERIAL, may need database-architect), 0015 (O-7: per-capita 2014 pipeline vs seed — may route the value to database-architect), 0016 (C1), 0017 (C2). Can run in parallel with C4/C5, but the query shape is blocked on O-6.

**Acceptance criteria (incl. fitness functions)**
- [ ] C6-a: each component panel pins approach + geo + single time; `time` resolves to one year in year mode (not multi-valued).
- [ ] C6-b: explicit `aggregate by [componentDim, time]`; rollup total row where a Total wedge shows.
- [ ] **FF-COMPONENT-DECOMP**: a component-decomposition query yields ≥2 components for the seed data, or diagnoses (`COMPONENT_DECOMP_DEGENERATE`).
- [ ] **FF-ROW-UNAMBIGUOUS**: per-capita (measure, geo, year) resolves exactly one observation; multi-match diagnoses (`ROW_AMBIGUOUS`).
- [ ] Per-capita 2014 renders ~4 831 (not 483) — OR, if O-7 finds the gold value itself is 483, the item closes with a routed database-architect ticket (out of pipeline scope) + C6-d hardening still landed.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — The sectoral donut at ~3370 is the correct reference pattern; mirror it. Cannot fully close until O-6 (0014) resolves; C6-c/C6-d guards can land independently. Two-way door at config level.
