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
- **Horizontal content-height (#2):** `Chart.tsx` sets inline `{height:'auto', maxHeight:'var(--size-panel-height)', overflowY:'auto', flex:'0 1 auto', minHeight:0}` on `.chart-wrap` when `output.horizontal` (the b5ae777 bounded-scroll model — see [[project_panel_sizing_cqi_model]]), so an authored `aspectRatio` band does NOT force a tall box a few-row hbar can't fill, while a many-row hbar still caps + scrolls instead of blowing out the section. `categoricalChartHeight` (base.ts) is the intended px height, floor `HBAR_MIN_HEIGHT` / cap `HBAR_MAX_HEIGHT` — locked by chart-fill.test.ts (bounds/typeof, NOT the literal constants — safe to retune).

**HBAR_MIN_HEIGHT retunes (2026-07, base.ts):** 240 → 380 (b5ae777 follow-up) → **560** (owner still called 380 "too short" on the live "regional comparison" panel — a FULL-WIDTH SOLO hbar, `templateColumns:"1fr"` in provisioning, the only current non-diverging `hbar` instance, so no paired-narrow-hbar aspect conflict exists yet). Root-cause of both prior floors reading wrong: they were derived from `HBAR_PX_PER_CATEGORY` (a per-row content estimate) — the wrong axis for a solo/few-bar FOCUS chart, whose honest size is "fills a real section" not "N rows stacked". 560 is instead anchored proportionally on `HBAR_MAX_HEIGHT` (~61%) so floor and cap move together, not two independent magic numbers, and headroom (560→920) is preserved so a genuinely tall many-row chart still reads taller. **If a narrower PAIRED hbar is ever authored, re-examine** — a fixed 560px floor could look odd in a half-width column; that case doesn't exist today.

**Gates:** series-color.test.ts (charts) + low-cardinality.test.ts (plugins) + chart-fill.test.ts (plugins, vbar-100%/hbar-px + hbar bounds, no literal pinned) + Chart.height.fitness.test.tsx (plugins, FF-HBAR-HEIGHT-BOUNDED — the Chart.tsx wrap-style half).

**Known follow-ups (flagged to reviewer):** ComboInterpreter does NOT set the seriesColorByIndex flag (combo differentiates by bar/line shape) — extend if combo greys appear. A paired (non-solo) few-bar hbar is unhandled/untested — flag if one is authored.
