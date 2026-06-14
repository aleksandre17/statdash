// ── Store Manifest — Phase 1 static registry ──────────────────────────
//
//  Maps storeKey strings (from PageDef.storeKey) to DataStore instances.
//  App.tsx passes this to SiteProvider — the app shell knows nothing about
//  individual stores; it only holds the resolved manifest.
//
//  Phase 2 replacement:
//    This file is replaced by a datasource config API:
//      const stores = await fetchStoreManifest()  // builds ApiStore per datasource
//    App.tsx stays identical — it still receives Record<string, DataStore>.
//
//  Pattern: Grafana datasource manifest (datasources.yaml / DB table).
//    Page config holds storeKey: 'gdp'           — declaration of intent.
//    Store manifest holds 'gdp': gdpStore        — single registration point.
//    SiteProvider resolves at runtime             — zero coupling between the two.
//
//  Adding a new datasource (Phase 1):
//    1. Create src/data/<name>/store.ts
//    2. Add entry here
//    App.tsx, SiteProvider, Page.tsx — no changes needed.
//
import type { DataStore }  from '@geostat/engine'
import { gdpStore }        from './gdp/store'
import { accountsStore }   from './accounts/store'
import { regionalStore }   from './regional/store'

export const STORE_MANIFEST: Record<string, DataStore> = {
  gdp:      gdpStore,
  accounts: accountsStore,
  regional: regionalStore,
}