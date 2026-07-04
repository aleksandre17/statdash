// ── resolvePreliminary — panel-title "preliminary data" signal (P2-3) ──────
//
//  Single source of truth for the boolean that drives the PANEL_TITLE_BADGE
//  PreliminaryBadge (IMF / Eurostat / ONS data-integrity standard). Every panel
//  shell (chart, table, gauge, kpi-strip, …) computes it identically by calling
//  this helper, so the rule lives in one place (DRY) rather than drifting across
//  shells.
//
//  The flag is the OR of two year-aware signals, cheapest-first:
//
//    1. Node config — `def.preliminary === true`. An explicit author override;
//       always honoured.
//    2. Rendered rows — any row this panel actually shows carries a preliminary
//       SDMX OBS_STATUS. This is the precise, year-aware signal: the badge fires
//       ONLY when the DISPLAYED slice contains preliminary data, never because some
//       unrelated slice of the dataset happens to be preliminary. We read both the
//       raw `obsStatus` field (surfaced by the `query` spec path AND, since the
//       applyEncoding OBS_STATUS passthrough, the ENCODED chart/table path) and the
//       typed `provenance.status` / `status` fields.
//
//  A dataset-wide MetadataPort fallback was REMOVED (it lit the badge on a FINAL
//  year merely because the dataset ALSO contained a preliminary obs — the year-blind
//  leak that contradicted signal 2's own contract). If a genuinely-preliminary
//  derived panel ever shows rows lacking obsStatus, the fix is at the SOURCE (carry
//  obsStatus onto those rows so signal 2 catches it), never a dataset-wide fallback.
//
//  Pure + synchronous: safe to call in render. No fetch, no store I/O.
//

import type { DataRow }                  from '@statdash/engine'
import type { NodeBase, RenderContext }  from './types'

/** True when a single SDMX OBS_STATUS code denotes preliminary data ('p', any case). */
function isPreliminaryStatus(status: unknown): boolean {
  return typeof status === 'string' && status.toLowerCase() === 'p'
}

/** True when a rendered row carries a preliminary status on any provenance field. */
function rowIsPreliminary(row: DataRow): boolean {
  const r = row as DataRow & { obsStatus?: unknown }
  return (
    isPreliminaryStatus(r.obsStatus) ||
    isPreliminaryStatus(r.status) ||
    isPreliminaryStatus(r.provenance?.status)
  )
}

/**
 * Resolve the panel-title `preliminary` flag for a node. See module header for
 * the two year-aware OR-ed signals. Returns `undefined` (not `false`) when no
 * signal fires, matching `PanelTitleHost.preliminary?` so the badge stays absent.
 */
export function resolvePreliminary(
  def: NodeBase & { preliminary?: boolean },
  ctx: RenderContext,
): boolean | undefined {
  // 1 — explicit node config
  if (def.preliminary === true) return true

  // 2 — rendered rows actually shown by this panel (the DISPLAYED slice)
  const rows = ctx.rows
  if (rows && rows.some(rowIsPreliminary)) return true

  return undefined
}
