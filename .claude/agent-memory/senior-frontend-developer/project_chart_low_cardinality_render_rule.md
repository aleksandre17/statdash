---
name: chart-low-cardinality-render-rule
description: The canonical few-series/few-bar chart rendering rule — colour-by-series, bounded bar fill, horizontal content-height — where each seam lives
metadata:
  type: project
---

Few-series / few-bar charts render at the market standard via ONE uniform rule (no per-panel special-case). Landed on branch `feat/chart-lowcardinality-render` (un-merged, pending chief-engineer review of the shared rendering layer).

**Why:** State-B regional composition read as one grey (2 region-series indistinguishable), the comparison hbar left dead whitespace, and 2-bar charts were thin. Owner demanded canonical + agnostic (Law 1/4), not a patch.

**How to apply (the three seams):**
- **Colour-by-series (#1):** `BarInterpreter` (packages/charts/src/interpreters/cartesian.ts) sets `ChartOutput.seriesColorByIndex` ONLY when >1 series AND none carries a semantic colour (information expert). The neutral format can't hold `var(--chart-color-N)`, so the apex render layer (plugins .../apex/cartesian.ts) resolves `chartColorAt(i)` theme-aware — mirrors the existing `distributed` seam. Explicit row colours still win (flag stays off). If the data pipeline later assigns per-region semantic colours, they auto-win. See [[project_value_mappings_architecture]], [[project_semantic_token_spine_complete]].
- **Bounded bar fill (#4):** `autoBarFillPct(categoryCount)` in plugins .../apex/base.ts — bounds `BAR_FILL_MAX_PCT=64` (few → wide) → `BAR_FILL_MIN_PCT=34` (many → floor), taper 4/category. Feeds columnWidth (vertical), barHeight (horizontal), and hbar-diverging columnWidth. Replaced the inverted `barCount*7` (2 bars → 15%). Category-count driven, orientation-neutral.
- **Horizontal content-height (#2):** `Chart.tsx` sets inline `{height:'auto', flex:'0 0 auto'}` on `.chart-wrap` when `output.horizontal`, so an authored `aspectRatio` band (--size-panel-height) does NOT force a tall box a 2-row hbar can't fill (dead whitespace). `categoricalChartHeight` (base.ts) stays the intended px height — locked by chart-fill.test.ts. Inline is deliberate: beats the band + equal-height-stretch rules without a shared-CSS specificity fight (see [[project_panel_sizing_cqi_model]]). Vertical charts keep filling their band.

**Gates:** series-color.test.ts (charts) + low-cardinality.test.ts (plugins). chart-fill.test.ts still locks vbar=100% / hbar=px.

**Known follow-ups (flagged to reviewer):** ComboInterpreter does NOT set the flag (combo differentiates by bar/line shape) — extend if combo greys appear. Horizontal content-height could shorten an hbar sharing a row with a taller sibling (comparison panels here are full-width solo).
