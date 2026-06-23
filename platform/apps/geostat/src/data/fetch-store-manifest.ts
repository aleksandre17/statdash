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
import type { PublicDataSourceRow } from './stats-api'
import { fetchDataSources } from './stats-api'

/**
 * Map one DB data-source row to a JSON datasource descriptor the registered
 * 'stats' builder understands. `datasetCode` / `nonTimeDims` live in the row's
 * `config` JSONB (seeded in apps/api/scripts/seed.ts). The row's `url` is the
 * stats API base the ApiStore fetches against; we fall back to `baseUrl` (the
 * caller's configured base) when a row omits it.
 *
 * Postel's Law: liberal in what we accept — a row missing `datasetCode` falls
 * back to its `name` (the store-builder's own default), and missing/!array
 * `nonTimeDims` degrades to []. Malformed rows yield a store with no classifier
 * dims rather than crashing the whole manifest build.
 */
function toDatasource(row: PublicDataSourceRow, baseUrl: string): DatasourceInstanceConfig {
  const cfg = row.config ?? {}
  const nonTimeDims = Array.isArray(cfg['nonTimeDims']) ? (cfg['nonTimeDims'] as string[]) : []
  return {
    id:   row.name,                                   // storeKey page nodes reference
    kind: 'stats',                                    // the registered live-API builder
    url:  row.url ?? baseUrl,
    params: {
      datasetCode: (cfg['datasetCode'] as string) ?? row.name,
      nonTimeDims,
    },
  }
}

/**
 * Phase 2: dynamic store manifest built from config.data_source rows.
 * App.tsx calls this once at boot; the result is passed to SiteProvider.
 *
 * Only `type='rest'` rows build a 'stats' store today (the live stats-API kind).
 * Other types are skipped here — they get their own builder when added, keeping
 * this resolver open for extension without a rewrite.
 *
 * Throws on network/HTTP failure (fail-fast) so the caller owns the fallback
 * (no stores) — that fallback is the resilience boundary, not this fn.
 */
export async function fetchStoreManifest(baseUrl: string): Promise<Record<string, DataStore>> {
  const rows = await fetchDataSources(baseUrl)

  const descriptors = rows
    .filter((r) => r.type === 'rest')
    .map((r) => toDatasource(r, baseUrl))

  return buildStoreManifest(descriptors)
}
