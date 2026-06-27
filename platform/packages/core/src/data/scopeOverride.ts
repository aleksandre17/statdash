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

import type { DimVal }    from '../sdmx'

export interface ScopeOverride {
  /**
   * Merge these dim values over SectionContext.dims for this panel only.
   * Override wins per key; dims not listed inherit from the base context.
   * Typed as DimVal to match SectionContext.dims (these ARE dimension values).
   */
  dimOverride?: Record<string, DimVal>
}
