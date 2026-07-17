---
name: legend-aesthetic-owner-verdict
description: Owner-blessed chart legend contract (R2-3, 2026-07-16) — bottom, single-line ellipsis, ONE font token; wrapped/multi-column legends rejected
metadata:
  type: feedback
---

Chart legends are bottom-placed, single-line ellipsized (16ch cap, centered rows, native `title` tooltip for the full name) and render at ONE size everywhere: the `--chart-legend-font-size` token (tokens.css, 12px). Never a local px value, never a scaled FS_* for legends, never a breakpoint `legend.fontSize` override.

**Why:** Owner verdict R2-3 (work/items/0078, 2026-07-16, verbatim: "არ მინდა მარჯვნივ. როგორც იყო ისე დატოვე, ლამაზად იყო…"). The 0fef9b1 "full wrapping labels" experiment (26ch, two-line labels) read as ragged right-hand columns and was rejected; per-chart scaled fonts + container-width breakpoint overrides made legends visibly differ chart-to-chart on one page. Legibility (his P10 "font too small") is solved by the token's floor INSIDE the old layout, never by re-layout.

**How to apply:** any legend work (Apex buildLegend/pie/hbar-diverging options via `cssVar('--chart-legend-font-size','12px')`, `.donut-legend__label` / `.apexcharts-legend-text` in chart.css, custom DOM legends) must keep reading the token; the `.apexcharts-legend-text` `!important` rule is the hard invariant — don't remove it. If a long label is a problem, ellipsis + tooltip, not wrapping. Fixed in commit f4c0608.
