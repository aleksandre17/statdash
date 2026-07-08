---
name: trend-dir-none
description: KPI/featured trend direction now has a 'none' discriminant for directionless figures (a share) — renders value+subtext with no arrow/label
metadata:
  type: project
---

`KpiDef.trend` (config/kpi.ts) and the `static` KpiTrendSpec `dir` union include
**'none'** alongside up/down/flat. A `share` TREND (kpi.ts `resolveTrend`) now returns
dir **'none'** (was 'flat'): a share is a PROPORTION, not a rise/fall.

**Render contract:** KpiCard + FeaturedCard render the glyph + sr-only up/down/flat
label ONLY when `trend !== 'none'`; a 'none' figure shows `trendValue` + `trendSub`
alone (no arrow, no "სტაბილური"/"stable" label — that reads as a false trend). Neutral
muted colour: `.kpi-trend-none` / `.featured-card__trend-badge--none` (token-driven).

**Why:** the regional featured slider rendered "→ სტაბილური: 53.1% ეროვნული ჯამის"
for each region's % of national — a share is not a direction.

**How to apply:** when a card carries a computed figure that has no rise/fall meaning,
use dir 'none' (not 'flat', which paints faint + labels "stable"). The `ARROWS` /
`trendLabels` maps stay `{up,down,flat}`; inside `trend !== 'none'` TS narrows so the
index is type-safe. Tests: kpi-share-national-base.fitness (`card.trend === 'none'`) +
FeaturedSliderShell.a11y (share renders value+subtext, no glyph/label).
