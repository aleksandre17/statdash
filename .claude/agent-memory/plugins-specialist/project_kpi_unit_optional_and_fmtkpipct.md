---
name: kpi-unit-optional-and-fmtkpipct
description: KpiSpec.unit is now optional; removing a required unit key without the guard blanks the whole strip; fmtKpiPct emits NO percent sign
metadata:
  type: project
---

Two coupled facts about KPI value/unit rendering (packages/core/src/data/kpi*.ts).

**KpiSpec.unit is OPTIONAL** (was required until fix/kpi-percent-and-share-display).
A percent-FORMATTED value already carries "%", so a redundant `unit:"%"` double-rendered
"+15%%". The fix removed those units in provisioning AND made `unit?` optional +
guarded `interpretKpi` (`spec.unit ? resolveTemplate(spec.unit,ctx) : undefined`).

**Why:** `resolveTemplate(undefined,…)` THROWS (its carrier collapse does
`hasOwnProperty` on the arg), and `interpretKpis().map()` has no per-card try — so ONE
card with a missing unit blanks the ENTIRE kpi-strip (renders empty), not just that card.
Perspective-render-validation caught this: gdp/regional year KPIs `kpiText === ''`.

**How to apply:** never delete a required display field from a KpiSpec/config without
confirming the interpreter tolerates absence; prefer making the field optional + guarding
the resolve site over authoring an empty `{ka:"",en:""}` (which trips label-completeness).

**fmtKpiPct subtlety** (`const fmtKpiPct = n => n.toFixed(1)` — NO "%"). Which value
types emit a "%" in the string:
- yoy → always sign_pct → EMITS "%"; point/expr/mean/metric → EMITS iff format ∈ {sign_pct,pct}
- share, cagr, mean(no format), metric(no format) → fmtKpiPct → BARE number ("53.1"), NO "%"
So share/cagr/bare-metric cards LEGITIMATELY keep `unit:"%"` to read "53.1%". Only
sign_pct/pct/yoy values are the "%%" offenders. Regression gate:
`apps/api/src/provisioning/config-no-redundant-pct-unit.fitness.test.ts`.
