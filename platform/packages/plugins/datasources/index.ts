// ── @statdash/plugins/datasources — shared store-builder + stats wire seam ───
//
//  G3.0 SSOT entrypoint. Holds the tenant-agnostic 'stats' datasource plumbing
//  that BOTH the geostat runner and the panel Constructor boot:
//    • registerStoreBuilders()  — registers the 'stats' kind with the engine's
//      store-builder registry (one builder, both apps).
//    • the /api/stats HTTP adapter + SDMX obs→row mapping (fromStatsObsRow, …)
//      and the wire-row types apps read at their data boundary.
//
//  Below apps in the dependency arrow (imports only @statdash/react/engine +
//  @statdash/engine), so neither app imports the other (Law 3). Carries NO
//  tenant content — no pages, datasets, or brand.

export { registerStoreBuilders } from './stats-registrations'
export * from './stats-api'
