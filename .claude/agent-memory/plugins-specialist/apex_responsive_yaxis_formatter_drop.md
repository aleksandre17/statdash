---
name: apex-responsive-yaxis-formatter-drop
description: ApexCharts responsive yaxis overrides silently DROP labels.formatter; numeric value axes must re-carry it via responsiveYAxis() or they emit raw floats
metadata:
  type: project
---

ApexCharts (3.54.1) responsive merge runs each breakpoint's `yaxis` through `Config.extendYAxis`, which **rebuilds the axis from `new Options().yAxis` defaults** — dropping any `labels.formatter` the override doesn't re-supply. So a bare responsive `yaxis: { labels: { style: { fontSize } } }` reverts the numeric value axis to ApexCharts' built-in float printer, surfacing raw floats like `120000.000000000000` at narrow widths (xaxis is NOT affected — it goes through plain `Utils.extend`, only yaxis hits `extendYAxis`).

**Why:** AUDIT-responsive.md F6/R5 — gdp y-axis showed raw floats ≤414px while desktop was correct. Root cause was the responsive merge, not core `fmtNum` (which is clean).

**How to apply:** ANY chart builder with a numeric y-axis (`cartesian`, `contribution`, future builders) must re-carry the formatter into every responsive `yaxis` override. Use the shared helper `responsiveYAxis(fontSize, formatter)` in `packages/plugins/panels/chart/default/utils/apex/base.ts`. Hoist the `yFormatter(...)` call into a `yFmt` const so base + responsive share one instance. Guard: `axis-formatter.test.ts` asserts responsive formatter output === base output (no raw-float tail) for cartesian + contribution.

**Note:** core `fmtNum(n, 0)` strips an integer's trailing zeros (`/\.?0+$/` quirk → `fmtNum(120,0)='12'`), so the gdp thousands-branch `fmtNum(val/1000,0)+' 000'` yields `12 000` for 120000. That's a latent core-formatter bug, out of plugins/charts scope — do NOT widen to fix it (a foundational time-mode workstream owns core next).
