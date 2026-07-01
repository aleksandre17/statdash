---
id: "0019"
title: "C5: First-class mean KPI reduction + fail-loud CAGR baseline (Drift 3)"
status: backlog
class: M
priority: P1
owner: —
implements: SPEC §1 C5, §4 FF-KPI-MEAN-AGGREGATES
depends_on: ["0013", "0016", "0017"]
links:
  - platform/work/SPEC-render-pipeline-target.md
  - platform/work/render-drift-audit.md
---
**Goal** — Add an arithmetic-mean KPI reduction so "average real growth" reads ~+5%, not 0.0%; make the silent-zero CAGR baseline fail loud.

**Implements** — SPEC §1 C5 (fixes DRIFT 3). Law 8 platform capability (OCP — new discriminant, interpreter unchanged).

**Root cause** — `kpi.ts` `KpiValueSpec` has no arithmetic-mean reduction (`point|yoy|cagr|share|expr|metric`). To show an "average" of a rate series the config misuses `cagr`, whose guard `vFrom && to>from ? … : 0` returns 0 when the baseline is falsy. For `real-gdp-growth-rates` the 2010 baseline is 0 → `vFrom` falsy → 0.0%. Two faults: CAGR (a *level* operator) applied to a *rate* series (wrong tool), and the falsy-baseline guard silently yields 0 instead of failing loud.

**Files / modules touched**
- `packages/core/src/data/kpi.ts` — C5-a: new `KpiValueSpec` discriminant `mean` (`{type:'mean', measure, from:{$ctx}, to:{$ctx}, filter, format}`); semantics `Σ v(t)/N` over inclusive `[from,to]`. C5-c: BOTH `cagr` falsy-baseline sites emit `KPI_CAGR_ZERO_BASELINE` — `kpi.ts:163` (value) AND `kpi.ts:220` (trend) (keep numeric fallback for prod resilience at both, but make each observable).
- `extractKpiRequirements` — C5-a warm contribution: one requirement per year in `[from,to]` (mirror the `growth` DataSpec's per-year enumeration).
- Config (GDP dynamics KPI): C5-b bind the "საშუალო რეალური ზრდა / Average real growth" card to `type:'mean'` on `real-gdp-growth-rates`.

**Dependencies** — 0013 (O-5: include base year N vs exclude N-1 — the `mean` honours the chosen semantics), 0016 (C1 — `sign_pct` format), 0017 (C2 — per-year warm reqs). Can run in parallel with C4/C6.

**Acceptance criteria (incl. fitness functions)**
- [ ] C5-a: `mean` discriminant exists; interpreter unchanged for other arms (OCP).
- [ ] Warm: `mean` contributes one req per year in `[from,to]`; FF-WARM-COVERS-RENDER (0017) passes for the mean card.
- [ ] C5-b: avg-real-growth card reads ~+4–6%/yr over 2010–2025 (series in `img_3`/`img_4`), NOT 0.0%. Trend dir from the sign.
- [ ] **FF-KPI-MEAN-AGGREGATES**: `mean` over a known rate series returns the arithmetic mean, not 0; falsy-baseline `cagr` diagnoses (`KPI_CAGR_ZERO_BASELINE`) at BOTH sites — the FF exercises the trend path (`:220`), not only the value path (`:163`).
- [ ] C5-c: BOTH falsy-baseline CAGR sites emit the diagnostic — `kpi.ts:163` (value) AND `kpi.ts:220` (trend); observable at dev time; production numeric fallback retained at both.
- [ ] `npx tsc --noEmit` EXIT=0.

**Standing DoD (applies)** — rendered result must match `scriness/` achieved ONLY through highest-concept architecture: no hardcoding, no anti-patterns, no DRY violations; declarative/config-driven; conditional logics covered; SSOT; refine/elevate EXISTING code (Strangler) — never rewrite-from-scratch or hardcode-to-match the screenshot. "Look like the screens" must NEVER be met by dropping quality.

**Notes** — Do NOT conflate with geometric mean / CAGR (label says "average"). Feeds E1 (0022) and referenced by E7 (0028). Two-way door.
