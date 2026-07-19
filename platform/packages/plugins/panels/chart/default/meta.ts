import type { PanelSliceMeta } from '@statdash/react/engine'
import { ChartSchema, ChartGroups } from './ChartNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'chart',
  variant:         'default',
  label:           { ka: 'დიაგრამა', en: 'Chart' },
  icon:            'bar-chart',
  category:        'data',
  schema:          ChartSchema,
  groups:          ChartGroups,
  canHaveChildren: false,
  // `flow` (placement capability): a chart is flow content, admissible in a section.
  // STYLE + VISIBILITY are UNIVERSAL facets (every renderable node — no cap needed).
  // `data-bindable`: opt into the universal DATA facet (element.facet.data over `data`).
  // `interactive`: opt into the universal EVENTS facet — the chart emits point:click
  // gestures the `on[]`/NodeAction spine folds (element.facet.events over `on`).
  caps:            ['export', 'collapsible', 'filterable', 'view-toggle', 'flow', 'data-bindable', 'interactive'],
  // ── Birth defaults — a chart is born RENDERABLE, from EVERY creation path ──────
  //  `getDefaults('chart')` seeds these onto `makeNode` (the ONE node build shared by
  //  the palette drop, ⌘K insert, AND the composed-preset expansion — planPresetInserts
  //  overlays makeNode per seed node, root AND child). Declaring them HERE (not in each
  //  preset) is the declare-once fix (ADR-038): a minimal seed `{type:'chart', data}`
  //  renders without the author restating type defaults.
  //   • `chartType: 'bar'` — the MARK a chart cannot render without. Absent, `useChartOutput`'s
  //     `resolveChartType` reads `.$ctx` off an undefined chartType once the chart is BOUND
  //     (rows > 0) and THROWS (the R2 section→chart crash). 'bar' matches resolveChartType's
  //     own null-ref fallback, so a state-bound mark that resolves to nothing lands here too.
  //   • `view.role: 'chart'` — the chart's semantic view role, so a chart+table dropped as
  //     section siblings are recognised as the two views of one data (useViewToggle). Merged
  //     UNDER any authored `view` (a preset's `visibleWhen` composes over it, never clobbered).
  defaults:        { chartType: 'bar', view: { role: 'chart' } },
  version:         1,
}
