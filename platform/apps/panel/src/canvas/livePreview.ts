// ── livePreview — session DataSources → live store descriptors (G3.1) ─────────
//
//  The Constructor canvas can preview against the REAL stats cube (live mode) or
//  against the empty structural store (structural mode, the default). This module
//  owns the ONE derivation that turns the session's cube-bound DataSources into
//  the `DatasourceInstanceConfig[]` the shared 'stats' store-builder consumes via
//  buildStoreManifest — the SAME seam the geostat runner uses
//  (apps/geostat/src/data/fetch-store-manifest.ts `toDatasource`).
//
//  KEYED MULTI-STORE (the parity fix). A page binds its store by `storeKey` on the
//  inner-page node (pageStoreKey) — and a multi-cube site declares ONE DataSource
//  per cube, each with its own datasetCode. The runner therefore builds a store
//  MAP keyed by source NAME (`{ accounts, gdp, regional }`) so a node's
//  `storeKey: 'regional'` resolves to the REGIONAL_GVA cube. This derivation now
//  mirrors that: one 'stats' descriptor PER cube-bound source, `id = source.name`
//  (the exact storeKey the page references), config forwarded VERBATIM — the same
//  shape the runner's `toSourceDescriptor` emits. Previously it emitted a SINGLE
//  `default`-keyed descriptor built from the first cube-bound source, so on a
//  multi-cube page every node fell through resolveStore's first-key fallback to
//  that one wrong cube — the section body's geo×sector query matched no
//  observations → empty rows → a blank `<EmptyState/>` panel while the scalar KPIs
//  still read a (wrong-cube) number. Keying by name makes each node resolve its
//  OWN cube, exactly as the live site does.
//
//  The cube-binding rule (datasetCode lives in source.config) is single-sourced in
//  cubeProfile.store (`datasetCodeOf`) — the same place the editor's profile
//  discovery derives a source's cube (Protected Variations: when an explicit
//  per-page dataset binding lands, it changes there, not here).
//
//  Config is forwarded VERBATIM as `params` (Postel, exactly as the runner's
//  `toSourceDescriptor` does): the builder reads what it needs (datasetCode,
//  nonTimeDims, classifierDims) and defaults the rest — no field is hand-picked
//  here, so `classifierDims` (an auxiliary-classifier superset the charts' $cl/$d
//  joins need) is never dropped. The single-source path from which classifierDims
//  used to fall out is gone.
//
//  Law 3: app-layer file. Imports the engine descriptor type + the panel's own
//  derivation; the engine/react buildStoreManifest is called by the caller hook.
//
import type { DatasourceInstanceConfig } from '@statdash/engine'
import type { DataSourceDef } from '../types/constructor'
import { datasetCodeOf } from '../discovery/cubeProfile.store'

/**
 * Derive the live store descriptors from the session's DataSources — ONE 'stats'
 * descriptor per cube-bound source (a source declaring `config.datasetCode`),
 * keyed by `source.name` (the storeKey page nodes reference). Returns `[]` when
 * no source is cube-bound — the caller then stays in / falls back to structural
 * mode.
 *
 * Mirrors the runner's `toSourceDescriptor` (source-descriptor.ts) +
 * `fetchStoreManifest`: `kind:'stats'`, `url` forwarded verbatim (the builder
 * defaults the base when absent), and `params = source.config` verbatim (the
 * builder reads datasetCode / nonTimeDims / classifierDims and defaults any that
 * are absent — stats-registrations.ts). buildStoreManifest then keys the built
 * store map by `id`, producing the same `{ <sourceName>: store }` map the runner
 * hands SiteProvider.
 */
export function deriveLiveDescriptors(sources: DataSourceDef[]): DatasourceInstanceConfig[] {
  return sources
    .filter((s) => datasetCodeOf(s) !== undefined)
    .map((source) => ({
      id:   source.name,
      kind: 'stats',
      ...(source.url ? { url: source.url } : {}),
      params: source.config,
    }))
}
