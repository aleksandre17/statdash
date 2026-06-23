// ── ScopeOverride — per-panel context override ───────────────────────────
//
//  Carried by ViewParams.scope (engine/react types.ts).
//  Applied by mergeScope() before interpretSpec is called for the node.
//  No React dependency — lives in engine/core.
//
//  Constructor-ready: JSON-only, no functions.
//
//  Analogues:
//    Grafana  — panel.scopedVars (per-panel variable overrides)
//    Retool   — component.datasource.queryOverrides
//

import type { DimVal } from '../sdmx'

export interface ScopeOverride {
  /**
   * Merge these dim values over SectionContext.dims for this panel only.
   * Override wins per key; dims not listed inherit from the base context.
   * Typed as DimVal to match SectionContext.dims (these ARE dimension values).
   */
  dimOverride?: Record<string, DimVal>
  /**
   * Override timeMode for this panel only.
   * Useful when a panel always shows a range while siblings show a single year.
   */
  timeMode?:    'year' | 'range'
  /**
   * Compare mode — render a second dataset alongside the base data.
   * Shells read ctx.compareRows + ctx.compareLabel to render the second series.
   * Absent → single dataset (default behaviour, unchanged from prior to N37).
   */
  compare?: {
    /** Which dimension to override for the comparison context (e.g. 'time'). */
    dim:   string
    /** The comparison value (e.g. prior year: 2023 when base is 2024). */
    value: DimVal
    /** Human-readable label for the comparison series (e.g. 'Prior year'). */
    label: string
  }
}
