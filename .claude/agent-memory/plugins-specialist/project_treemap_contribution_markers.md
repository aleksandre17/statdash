---
name: treemap-contribution-markers
description: How treemap +/= corner markers work — label-prefix convention shared with ContributionInterpreter, uniform-accent when markers present
metadata:
  type: project
---

Treemap contribution-role markers (the `=`/`+`/`-` corner glyph per tile, e.g. GDP-by-income img_15).

**Mechanism (label-prefix convention, shared across special.ts interpreters):**
- `charts/src/interpreters/special.ts` **TreemapInterpreter**: when rows carry a total row (`isTotal`), it prefixes each `categories[i]` with a role glyph — `(=) ` total, `(-) ` value<0, `(+) ` else. This is the SAME prefix convention `ContributionInterpreter` (same file) already uses. No total row → plain labels (a flat categorical treemap gets NO markers → no regression).
- `plugins/panels/chart/default/components/TreemapChart.tsx` parses the prefix: `op = label.match(/^\((.)\) /)`, `isTotal = label.startsWith('(=) ')`, `clean = label.replace(/^\(.\) /,'')`. Renders `op` via the `Marker` component (top-left, readable text — WCAG: meaning in glyph not colour). `hasMarkers` (any `(=|+|-)` prefix) → every tile forced to `cssVar('--color-accent')` (uniform additive family, dark-parity, no hex); else the palette-distribute/threshold logic.

**Why label-prefix, not a structured ChartDataPoint field:** ChartDataPoint has no role/marker slot, and the chart+table share `ctx.rows` — deriving the prefix in the config PIPE would pollute the table label. The interpreter is the only layer that sees `DataRow.isTotal` AND owns `categories` (chart-only), so prefixing there keeps the table clean. Adding a structured field would touch the `packages/charts` contract (types.ts) — bigger blast radius than mirroring the existing sibling.

**income node config (`geostat.provisioning.json` id `income`):** the 5 INC members already exist (1 total + 4 add). To show the total tile: KEEP the total (don't `filter $ne total`), `derive isTotal = contributionRole=='total'?1:0`, `encoding.isTotal`. Keep table pct correct against GDP with a `pctBase = isTotal==1?0:value` field + `pct:{sumOf:"pctBase"}` (sumOf over ALL rows would double-count the total). INC measure codes: gross-domestic-product-at-current-prices (total), gross-operating-surplus, compensation-of-emploees[sic], gross-mixed-income, net-taxes_2 — see `apps/geostat/src/data/golden-canonical-alias.ts` GDP_MEASURE_ALIAS.

Only ONE treemap + ONE contribution chart exist in provisioning, so interpreter changes here are low-blast.
