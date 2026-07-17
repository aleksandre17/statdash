---
name: highlight-render-boundary
description: AR-42 — the highlight/emphasis render-boundary seam + FF-ACTION-ARM-CONSUMED latent-arm guard; where each interaction arm is consumed
metadata:
  type: project
---

AR-42 completed the render-boundary consumers for the interaction spine's `highlight` arm
(the WRITE side — `useNodeInteractions` folding `SELECTION_WRITE_ACTIONS` through
`applySelection`/CommandBus — was already live; the READ side was inert).

**The two `highlight` consumers (READ side):**
- **TableShell** (`packages/plugins/panels/table/default/TableShell.tsx`): the selection-detect is
  `def.on…find(a => SELECTION_WRITE_ACTIONS.has(a.type))` — NOT `=== 'filter'`. So a declared
  `type:'highlight'` derives `selKey → selectedIds → data-table__row--selected`, no requery
  (transient, permalink-encoded). This is the LIVE, user-visible consumer.
- **Chart EMPHASIS channel** — `ChartOutput.emphasis?: readonly string[]` (`packages/charts/src/types.ts`),
  the resolved Vega-Lite condition-on-selection (a CATEGORY-key set; non-empty → dim marks outside
  the set). Consumed by the SVG realizer `emitCartesian` (`dimAttr`/`DIM_OPACITY`, byte-identical
  when absent — Postel). Resolved at the render boundary in `useChartOutput.resolveEmphasis` from the
  node's own highlight action + `ctx.filterParams` (peer of TableShell's selectedIds). **PENDING:** the
  LIVE ApexCharts realizer (`toApexOptions`/`buildCartesian` in plugins) does NOT yet read
  `output.emphasis` — per-mark opacity there is the tracked follow-up.

`SELECTION_WRITE_ACTIONS` + `HighlightAction` are re-exported (value + type) from `@statdash/react/engine`
(index.ts) so plugin shells read the SSOT Set lawfully.

**The guard — FF-ACTION-ARM-CONSUMED** (`packages/plugins/__tests__/actionArmConsumed.fitness.test.ts`):
PARSES the live grammar from source (NodeAction `XxxAction` discriminants in `node-events.ts`, the
`NodeEventTrigger` union, the `SelectionMode` union in `applySelection.ts`) and asserts every arm has a
live Consumer/emitter (evidence token present in the render-layer file) OR a reasoned pending allowlist
entry. A new arm with no matrix entry FAILS. **Known-pending:** `interval:brush` trigger (no drag-select
emitter wired; the `interval` reducer MODE is live in applySelection — only the producer is missing).

**Co-visibility verdict:** chart↔table is a mutually-exclusive TOGGLE (SectionBlock — one section, two
`view.role` views), so a co-visible cross-panel chart-emphasis-from-table-click is structurally blocked
there. On regional the map is co-visible with the chart/table toggle, but the map already drives a
`filter` (requery) select — a highlight peer there would be redundant. The clean demo is therefore a
SELF-CONTAINED table row highlight (national-accounts `production` section table; `key:'_hl'`,
`fromField:'id'`, requires `encoding.id`).

Related: [[feedback_registry_over_special_case]] · [[project_charts_neutral_color_seam]] · the write-side
spine is `useNodeInteractions` + `applySelection` (core).
