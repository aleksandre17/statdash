// ── fetch-store-manifest.ts — Phase 2 dynamic store manifest (P3-4) ───────────
//
//  Builds the store manifest from config.data_source rows in the database.
//  The runner carries no compiled-in stores; when this fails (API down), the
//  caller (site-manifest.bootstrapSite) falls back to no stores (ADR-0028).
//
//  FLOW:
//    GET /api/data-sources            → PublicDataSourceRow[] (connected only)
//    map row → DatasourceInstanceConfig{ kind:'stats' }
//    buildStoreManifest(descriptors)  → Record<storeKey, DataStore>
//
//  WHY it delegates to buildStoreManifest + the registered 'stats' builder
//  (stats-registrations.ts) instead of constructing ApiStore here:
//    The 'stats' builder ALREADY does the full construction the brief describes —
//    per-dim classifier fetch, dataset-meta → MetadataPort, new ApiStore(...) with
//    fromStatsObsRow as the DI mapRow, wrapped in CachedStore. Re-implementing it
//    here would duplicate that logic (DRY) and fork two construction paths that
//    must stay in sync. This function is the ROW SOURCE; the builder is the
//    CONSTRUCTION. One responsibility each (SRP).
//
//  A new datasource kind (e.g. 'sdmx-json') becomes a new registered builder —
//  this mapper is unchanged (OCP): it forwards `type` and `config` verbatim.
//
//  Law 3 (dependency arrow): app-layer file. Imports the engine/react factory and
//  the app's stats-api wire contract; the engine imports nothing from here.

import type { DataStore, DatasourceInstanceConfig } from '@statdash/engine'
import { buildStoreManifest } from '@statdash/react/engine'
import { fetchDataSources, toSourceDescriptor } from '@statdash/plugins/datasources'

/**
 * Phase 2: dynamic store manifest built from config.data_source rows.
 * App.tsx calls this once at boot; the result is passed to SiteProvider.
 *
 * The row→descriptor→kind mapping is the shared SSOT (toSourceDescriptor in
 * @statdash/plugins/datasources) — `type='rest'`→'stats' (live cube) and
 * `type='static'`→'static' (inline literal data) BOTH build live stores; a type
 * with no registered kind yet (e.g. 'sdmx-json') is skipped (open for
 * extension). M2: a Constructor-authored static source flows through this exact
 * path → a live DataStore with zero code change (FF-SOURCE-AUTHORABLE).
 *
 * Throws on network/HTTP failure (fail-fast) so the caller owns the fallback
 * (no stores) — that fallback is the resilience boundary, not this fn.
 */
export async function fetchStoreManifest(baseUrl: string): Promise<Record<string, DataStore>> {
  const rows = await fetchDataSources(baseUrl)

  const descriptors = rows
    .map((r) => toSourceDescriptor(r, baseUrl))
    .filter((d): d is DatasourceInstanceConfig => d !== undefined)

  return buildStoreManifest(descriptors)
}
