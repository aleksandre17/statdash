// ── bootRegistrations.ts — the EAGER (pre-bootstrap) registration seam ────────
//
//  WHAT runs here, and WHY it must run BEFORE bootstrapSite():
//
//    bootstrapSite() (App.tsx useEffect) fetches the manifest AND builds the
//    store map — `fetchStoreManifest → buildStoreManifest`, which dispatches each
//    datasource to its registered StoreBuilder (the 'stats'/'static'/'href'
//    kinds). If no builder is registered when that runs, buildStoreManifest
//    THROWS ('No StoreBuilder registered for kind …'), the store read fails soft
//    to `{}`, and every chart/table/map renders empty.
//
//    So the store-builder registry is a dependency CONSUMED at bootstrap — it
//    must be populated EAGERLY, before render. registerStoreBuilders is a LIGHT
//    module: it imports only @statdash/plugins/datasources (the stats/static/href
//    builders + the engine ApiStore/CachedStore, all lazily) — it pulls in NO
//    ApexCharts / Leaflet / panel-node plugin graph. Calling it eagerly therefore
//    does NOT grow the entry chunk; the heavy renderer graph stays behind the
//    RendererSurface lazy boundary (setupRegistrations there registers the slices).
//
//  This is the LIGHT half of the old setupRegistrations(): the store-builder
//  registration was split OUT of setupRegistrations (which lives in the lazy
//  RendererSurface chunk) and promoted here so the registry exists before the
//  bootstrap consumes it. setupRegistrations keeps the heavy slice/projector/i18n
//  wiring; this owns only the pre-bootstrap registry priming (SRP).
//
//  Imported directly by main.tsx and invoked before createRoot().render().

import { registerStoreBuilders } from '@statdash/plugins/datasources'

/**
 * Register the datasource store-builders (stats / static / href) with the
 * engine's store-builder registry. MUST run before bootstrapSite() consumes the
 * registry via buildStoreManifest. Idempotent (the registry overwrites by kind),
 * but it is invoked exactly once, eagerly, from main.tsx.
 */
export function bootRegistrations(): void {
  registerStoreBuilders()
}
