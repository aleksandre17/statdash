---
name: datalabels-contract
description: output.dataLabels contract (default true bar/hbar, false else) now honored by custom DonutChart+TreemapChart for on-graph numeric value visibility
metadata:
  type: project
---

`ChartOutput.dataLabels?: boolean` = "Override for data-label visibility. Undefined =
default (true for bar/hbar, false otherwise)". The Apex cartesian renderer honored it; the
CUSTOM SVG/React components (DonutChart, TreemapChart — registered directly in
chart-renderers.tsx, NOT via ApexRenderer) hardcoded label visibility and ignored it.

**Fix (admin B4, image4 treemap / image5 donut — "numbers off the graph, hover-only"):**
- radial.ts `PieInterpreter` + special.ts `TreemapInterpreter` now pass `def.dataLabels`
  through to ChartOutput (mirrors cartesian.ts).
- `DonutChart`: `output.dataLabels ?? false` gates the outer numeric leader labels
  (pctText = fmtV(value)). Legend categories + centre total + hover DonutTip always stay.
- `TreemapChart`: `output.dataLabels ?? false` gates the on-tile value + %. Tile category
  name (`clean`) + contribution Marker (=/+/-) always stay (structure, not the value).

So donut/treemap default to numbers-hover-only WITHOUT any provisioning edit (the contract
default is already false for non-bar). `dataLabels: true` on the chart node opts on-graph
numbers back in (Constructor-controllable). Gate:
`panels/chart/default/components/dataLabelsHoverOnly.fitness.test.tsx`.

NOTE: donut leader labels use `fmtV = fmtNum(v,1)` which STRIPS trailing zeros (250 → "250",
not "250.0"); treemap tiles render `pt.formatted` verbatim. Watch that when asserting text.
