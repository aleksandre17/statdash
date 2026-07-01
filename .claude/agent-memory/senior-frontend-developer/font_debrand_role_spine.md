---
name: font-debrand-role-spine
description: Typography de-brand — --font-family-display L0 role + why chart.css donut-legend was deferred (unique third stack); guards the later chart/RISKY wave from a byte-identity regression
metadata:
  type: project
---

Wave-2 styles-canonicalization de-branded the type axis: added `--font-family-display` to L0 `packages/styles/src/css/tokens.css` (neutral system default), kept `--font-family-base`. Geostat brand stacks live ONLY in `apps/geostat/src/shared/styles/index.css` `[data-tenant="geostat"]`, beside the accent rebind:
- `--font-family-display: 'Noto Serif Georgian','Noto Sans Georgian',sans-serif`
- `--font-family-base: 'Noto Sans Georgian',system-ui,sans-serif`
8 plugin CSS files now reference the role (section/hero/stats-carousel/page-header[both roles]/kpi-strip/data-table → display; filter-bar/landing/page-header-subtitle → base).

**Why:** byte-identical de-brand — the resolved stack under `[data-tenant="geostat"]` exactly equals the former hardcoded literals; packages become brand-neutral (F1 scan bans brand font names in packages/). L0 default MUST stay neutral (do NOT put Georgian in tokens.css — that defeats de-brand + trips the planned F1 scan), despite a loose task phrasing of "default to exact stack".

**chart.css `.donut-legend` (L43) deliberately NOT de-branded.** Its stack `'BPG Arial', Roboto, sans-serif` is a UNIQUE THIRD value — collapsing it into `--font-family-base` (= Noto Sans body) or `--font-family-display` would CHANGE the rendered legend font = byte-identity regression. A single-consumer third token is YAGNI, AND the chart plugin's JS-side ApexCharts `fontFamily` literals (cartesian.ts/base.ts/pie.ts/DonutChart.tsx etc., which can't consume CSS `var()` reliably in SVG) still hardcode Georgian — so the chart's typography must be de-branded HOLISTICALLY in the chart/RISKY wave (blueprint §7 R-B), not piecemeal here.

**How to apply:** when the chart de-brand wave runs, treat CSS + JS apex fonts together; do not naively map `.donut-legend` to `--font-family-base` (regresses geostat). See [[semantic_token_spine_complete]] for the color-axis analogue. Blueprint: `platform/work/DESIGN-styles-architecture.md` §3/§7.
