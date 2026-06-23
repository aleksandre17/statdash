// ── resolvePreliminary — panel-title "preliminary data" signal (P2-3) ──────
//
//  Single source of truth for the boolean that drives the PANEL_TITLE_BADGE
//  PreliminaryBadge (IMF / Eurostat / ONS data-integrity standard). Every panel
//  shell (chart, table, gauge, kpi-strip, …) computes it identically by calling
//  this helper, so the rule lives in one place (DRY) rather than drifting across
//  shells.
//
//  The flag is the OR of three complementary signals, cheapest-first:
//
//    1. Node config — `def.preliminary === true`. An explicit author override;
//       always honoured.
//    2. Rendered rows — any row this panel actually shows carries a preliminary
//       SDMX OBS_STATUS. This is the most precise signal: the badge fires only
//       when the displayed slice contains preliminary data, never because some
//       unrelated slice of the dataset happens to be preliminary. We read both
//       the raw `obsStatus` field (survives the `query` spec path) and the typed
//       `provenance.status` / `status` fields (the encoded DataRow path).
//    3. Dataset-wide MetadataPort — `store.metadata?.provenance(...)` returns
//       `status: 'p'`. The fallback when rows don't carry status (e.g. an
//       aggregated/derived spec) but the dataset is known preliminary.
//
//  Pure + synchronous: safe to call in render. No fetch, no store I/O beyond the
//  already-resolved MetadataPort (populated once at store-build time).
//

import type { DataRow }                  from '@statdash/engine'
import type { NodeBase, RenderContext }  from './types'
import { resolveStore }                  from './resolveNodeRows'

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
 * the three OR-ed signals. Returns `undefined` (not `false`) when no signal
 * fires, matching `PanelTitleHost.preliminary?` so the badge simply stays absent.
 */
export function resolvePreliminary(
  def: NodeBase & { preliminary?: boolean },
  ctx: RenderContext,
): boolean | undefined {
  // 1 — explicit node config
  if (def.preliminary === true) return true

  // 2 — rendered rows actually shown by this panel
  const rows = ctx.rows
  if (rows && rows.some(rowIsPreliminary)) return true

  // 3 — dataset-wide provenance via the MetadataPort seam
  const store = resolveStore(ctx)
  const measure = String((def as { measure?: unknown }).measure ?? '')
  const prov = store.metadata?.provenance(measure, ctx.sectionCtx)
  if (prov && isPreliminaryStatus(prov.status)) return true

  return undefined
}
