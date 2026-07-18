// ── bootstrapCatalog — prime the governed semantic catalog for authoring (Gap A) ─
//
//  The panel is the AUTHORING tool: the MetricPalette + every governed enum-ref
//  control read the catalog from the engine's process-global registry via
//  `describeApp().metrics/.dimensions` (metricCatalog.store). But the registry is
//  only populated by a BOOT that registers the manifest's metrics/dimensions — the
//  geostat runner does this in bootstrapSite(); the panel never did, so a live
//  palette showed its empty state. This is that missing boot step.
//
//  ── Catalog source decision ───────────────────────────────────────────────────
//  The governed catalog (metrics + dimensions) is a SINGLE governed SSOT stored in
//  config.site_config (keys `metrics`/`dimensions`) — global site config, NOT
//  publish-versioned. So the authoring catalog is the SAME catalog the runner boots;
//  there is no draft-vs-published distinction for the semantic layer itself. We
//  therefore read it from GET /api/bootstrap — the same public, read-only delivery
//  manifest the geostat runner boots from, which already projects `metrics` /
//  `dimensions` verbatim from site_config:
//    • no api change needed (the channel already exists);
//    • read-only + unguarded — safe to call from the authoring tool;
//    • REUSES the shared registerManifestMetrics/registerManifestDimensions seam
//      (now in @statdash/engine), so the panel and the runner register through ONE
//      code path — no fork (Law 8 / DRY).
//  Rejected alternative: surfacing metrics/dimensions through /api/config/site would
//  add a SECOND delivery channel for the same catalog (SSOT/DRY violation) and force
//  an api + contracts change for no gain.
//
//  Fail-soft (graceful degradation, Law 9): a boot with the api unreachable logs a
//  warning and leaves the registry empty — the palette shows its informative empty
//  state, never a crash. Idempotent: registerManifest* is last-write-wins per id.
//
import type { SiteManifestContract } from '@statdash/contracts'
import { registerManifestMetrics, registerManifestDimensions } from '@statdash/engine'
import { registerManifestI18n, type I18nConfig } from '@statdash/react'
import { getToken } from '../lib/auth'

// Same base as the config client (lib/api.ts): dev supplies VITE_API_URL (or the
// Vite proxy); the production fallback is relative (same-origin). /api/bootstrap is
// a distinct scope from /api/config (public delivery vs guarded authoring CRUD).
const BASE = import.meta.env.VITE_API_URL ?? ''

/** The catalog channels the authoring boot reads off the delivery manifest. */
type CatalogManifest = Pick<SiteManifestContract, 'metrics' | 'dimensions' | 'i18n'>

/**
 * Fetch the governed catalog from GET /api/bootstrap. The delivery route returns
 * the manifest as the body directly (ADR-0026); Postel — a `{ data }` envelope is
 * also honoured so a future shape change does not hard-break the client. Throws on
 * a non-OK response so the caller owns the fail-soft fallback.
 */
export async function fetchCatalogManifest(): Promise<CatalogManifest> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token !== null) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}/api/bootstrap`, { headers })
  if (!res.ok) throw new Error(`GET /api/bootstrap: ${res.status}`)
  const json = (await res.json()) as { data?: CatalogManifest } & Partial<CatalogManifest>
  return json.data ?? (json as CatalogManifest)
}

/**
 * Register the governed metric + dimension catalog into the engine registries so
 * `describeApp()` — and thus the MetricPalette / governed enum-ref controls — see a
 * populated catalog. MUST run before the wizard's Page step first reads the catalog.
 * Returns true on success, false on any API failure (fail-soft — never throws to
 * the boot flow). Registers ALL THREE tenant channels (metrics + dimensions + the
 * i18n catalog), matching the geostat runner's bootstrapSite() parity — the i18n
 * catalog so the live canvas PREVIEWS a tenant's page with its authored locale
 * chrome (e.g. a control's localized aria label) exactly as the runner renders it,
 * instead of only the framework's neutral en baseline (AR-52: the canvas never lies).
 */
export async function bootstrapCatalog(): Promise<boolean> {
  try {
    const manifest = await fetchCatalogManifest()
    registerManifestMetrics(manifest.metrics)
    registerManifestDimensions(manifest.dimensions)
    // The i18n catalog is a JsonRecord on the wire; it carries the ADR-019
    // I18nConfig shape ({ locales, defaultLocale, fallbackLocale, catalog? }).
    // registerManifestI18n is a no-op when the catalog is absent (Postel).
    if (manifest.i18n) registerManifestI18n(manifest.i18n as unknown as I18nConfig)
    return true
  } catch (e) {
    console.warn('[api] catalog bootstrap failed — MetricPalette will show its empty state', e)
    return false
  }
}
