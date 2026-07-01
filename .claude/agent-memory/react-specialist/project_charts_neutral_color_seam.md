---
name: charts-neutral-color-seam
description: charts interpreters emit literal-hex default colors (not cssVar) because ChartOutput is the JSON neutral format; cssVar layering happens in the apex adapter
metadata:
  type: project
---

@statdash/charts interpreters (BarInterpreter, PieInterpreter, special.ts etc.) emit
LITERAL hex fallback colors when a DataRow carries no color — NOT `cssVar('--token')`.

**Why:** ChartOutput is the renderer-agnostic neutral format (JSON, wire-safe, parsed in
SVG-attr / JS-color-math sinks where CSS `var()` is invalid). The themed cssVar fallback
is layered ON TOP later by the apex adapter in @statdash/plugins
(panels/chart/default/utils/apex/*). So the same default color exists twice by design:
the wire-safe hex seed in charts, the themed cssVar in the plugin adapter.

These seeds are now named once in `packages/charts/src/colors.ts`
(DEFAULT_SERIES_COLOR=#6B7B8D, DEFAULT_ACCENT_COLOR=#0080BE, DEFAULT_TOTAL_COLOR=#E53E3E),
not re-typed at each interpreter site.

**How to apply:** if asked to "theme" a chart default or "remove the hex literal" in the
charts package, do NOT replace it with cssVar — that breaks the neutral-format contract.
The literal is correct in charts; the theming lives in the plugin apex adapter. Relates to
[[project_color_single_home_migration]] (presentation.color) and the semantic-token spine.
