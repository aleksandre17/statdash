// ── saveSemanticCatalog — persist the governed catalog + refresh the live palette ─
//
//  AR-49 M2.2 persistence + live-refresh loop (spec §5). The ONE action the Steward's
//  Metric Editor commits through. Deliberately a DISTINCT action from saveSite (ISP —
//  identity/theme save vs governed-catalog save are separate concerns; saveSite's
//  field whitelist is NOT widened, spec §5.1). Rides seams that already exist:
//
//    editable working copy (semanticCatalog.store)
//        │
//        ▼  PUT /api/config/site { metrics, dimensions }   ← existing route, arbitrary keys
//    config.site_config (keys 'metrics'/'dimensions')       ← the ONE catalog SSOT
//        │
//        ▼  registerManifestMetrics/Dimensions (@statdash/engine)   ← the boot seam, live
//    engine registry  →  useMetricCatalog invalidate()      ← the palette re-reads
//        │
//        ▼  Author's MetricPalette shows the new/edited metric — NO reload (DoD §13)
//
//  The PUT is a per-KEY upsert (routes/config/site.ts: INSERT … ON CONFLICT (key)),
//  so sending only { metrics, dimensions } leaves name/logo/theme untouched — a
//  targeted catalog save, never a whole-site overwrite.
//
//  FF-METRIC-AUTHORING-SERIALIZABLE: the payload is the pure ManifestMetric[] wire
//  shape (JSON, no function/expr-as-code), so what we PUT round-trips
//  site_config → /api/bootstrap → registerManifest* byte-identically — a
//  steward-authored metric is indistinguishable from a provisioned one downstream.
//
import { registerManifestMetrics, registerManifestDimensions } from '@statdash/engine'
import type { ManifestMetric, ManifestDimension } from '@statdash/contracts'
import { configApi, ApiError } from '../../lib/api'
import { useMetricCatalogStore } from '../../discovery/metricCatalog.store'
import { useSemanticCatalogStore } from './semanticCatalog.store'

export interface SaveCatalogResult {
  ok:         boolean
  /** Present on failure — a human message the manager surfaces inline (never thrown). */
  error?:     string
  /** True when the failure was a 403 (needs a catalog-authoring token) — distinct affordance. */
  forbidden?: boolean
}

/**
 * Re-register a catalog into the live engine registry and invalidate the palette's
 * read so it re-projects describeApp() — the "author sees it instantly" step. Pure
 * side-effect on the process-global registries + the metricCatalog store; exported
 * so the save path and future re-hydration share ONE live-apply seam (DRY).
 *
 * NOTE (honest scope): registerManifest* is last-write-wins per id and has no
 * unregister, so this makes CREATE/EDIT live immediately but a DELETE only drops
 * from the palette after a reload (the id lingers in the registry). M2.2's headline
 * is create/edit-live; delete's live removal needs an engine registry-reset seam —
 * flagged, not built here (the delete-guard still protects consumers).
 */
export function applyCatalogLive(
  metrics:    ManifestMetric[],
  dimensions: ManifestDimension[],
): void {
  registerManifestMetrics(metrics)
  registerManifestDimensions(dimensions)
  // Drop the palette's cached read so useMetricCatalog re-reads the refreshed registry.
  useMetricCatalogStore.getState().invalidate()
}

/**
 * Persist the current editable catalog to site_config and refresh the live palette.
 * Reads the working copy from the store (like saveSite/savePage read the constructor
 * store), PUTs it, then — on success — applies it live and marks the store clean.
 * Fail-soft: any API fault returns a result the caller renders inline; never throws.
 */
export async function saveSemanticCatalog(): Promise<SaveCatalogResult> {
  const { metrics, dimensions, markSaved } = useSemanticCatalogStore.getState()
  try {
    await configApi.site.update({ metrics, dimensions })
    // Live-refresh loop — the metric is in the palette before the next paint.
    applyCatalogLive(metrics, dimensions)
    markSaved()
    return { ok: true }
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      return { ok: false, forbidden: true, error: e.message }
    }
    const error = e instanceof Error ? e.message : 'Catalog save failed'
    return { ok: false, error }
  }
}
