---
name: conditional-formatting
description: Thresholds (conditional formatting) LANDED as ValueThreshold — the token-bound numeric sibling of value-mapping; TWO Threshold models now exist (convergence debt)
metadata:
  type: project
---

# Conditional formatting / thresholds (LANDED, live-proven)

Grafana-class conditional formatting — a value's PRESENTATION (colour/glyph/state) driven
by authored numeric-range rules — shipped as the ordered-numeric SIBLING of the existing
discrete value-mapping (`[[dynamic-property-binding]]` landed just before it).

**The model (`packages/core/src/config/threshold.ts`):** `ValueThreshold = ValueThresholdStep[]`,
a monotonic step function — a value takes the presentation of the HIGHEST breakpoint it
reaches (base step = `from` absent = −∞). `resolveValueThreshold(value, steps)` is the pure
resolver, HONEST (non-finite/null ⇒ null). Token-bound like ValueMapping (the `token` is a
DATA_COLOR_TOKENS KEY, resolved to CSS by the CONSUMER via `tokenCssVar` — never a hex here).

**The ONE engine seam:** `interpretKpi` (`packages/core/src/data/kpi.ts`) threads the raw
numeric out of `resolveValue` (added `numeric` to `KpiValueResult`) and resolves thresholds
ONLY for an `ok` value → additive KpiDef fields `valueToken`/`valueGlyph`/`valueStateLabel`.
A no-data/masked KPI renders a KpiStateCard (never a KpiCard), so thresholds structurally
never touch a fabricated value (Law 11). KpiCard applies the colour to the value span.

**Authoring:** new rich `'thresholds'` PropFieldType → `ThresholdField` step-list editor
(`apps/panel/src/inspector/controls/thresholds/`, mirrors the value-mapping family exactly,
registered at App.tsx boot). Declared on `KpiItemSchema` as concern:'style', author plane —
projected onto the bounded item contract by the generic Inspector (no per-type wire).

## ⚠ Convergence debt (flagged, not yet done)
There are now **TWO Threshold models** in core:
1. LEGACY `Threshold` (`packages/core/src/field/config.ts`) — `{ value, color: '#hex' }`,
   literal-hex, part of chart `FieldConfig`, wired into the chart-series interpreters
   (`packages/charts/src/interpreters/`). Predates the token spine. `localeChartDef.ts`
   draws the ISP boundary "a KPI consumer of FieldConfig must not inherit a chart concern".
2. NEW `ValueThreshold` (token-bound, glyph-carrying) — the token-bound family's own.

Named `ValueThreshold` (NOT `Threshold`) to avoid the collision. The RIGHT end-state is ONE
token-bound conditional-format grammar: the chart Threshold should migrate to token-binding
(Strangler-Fig, Law 7). A future generalization — thresholds on charts/tables reuses
`resolveValueThreshold` at each realizer's value seam.

## Live proof note
Recolor felt-result proven through the REAL pipeline in node+jsdom (FF-KPI-THRESHOLD +
FF-KPI-CARD-THRESHOLD). The live :5173 e2e proves boot(no-white-screen)+honest+authoring;
a live RECOLOR e2e needs the SDMX obs store mocked (past-M) — the canvas structural store
returns no obs, so a bound KPI is honest no-data there. That obs-mock is the natural next
increment if a live recolor e2e is ever required.
