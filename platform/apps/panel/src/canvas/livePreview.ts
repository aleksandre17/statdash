// ── livePreview — session DataSources → live store descriptors (G3.1) ─────────
//
//  The Constructor canvas can preview against the REAL stats cube (live mode) or
//  against the empty structural store (structural mode, the default). This module
//  owns the ONE derivation that turns the session's cube-bound DataSources into
//  the `DatasourceInstanceConfig[]` the shared 'stats' store-builder consumes via
//  buildStoreManifest — the SAME seam the geostat runner uses
//  (apps/geostat/src/data/fetch-store-manifest.ts `toDatasource`).
//
//  FIRST-CUBE-BOUND-WINS (product decision, G3.1): a page previews against a
//  single store today. We pick the first DataSource that declares a `datasetCode`
//  (the cube binding) and emit exactly one descriptor, keyed `default` so it drops
//  straight into the `{ default: … }` slot CanvasView already passes — and the
//  engine's resolveStore (ctx.pageStoreKey ?? 'default') resolves it. Keyed
//  multi-store is a later capability (a new descriptor per binding, this fn
//  unchanged — OCP).
//
//  The cube-binding rule (datasetCode lives in source.config) is single-sourced in
//  cubeProfile.store (`pickActiveDatasetCode` / `datasetCodeOf`) — the same place
//  the editor's profile discovery derives its active cube (Protected Variations:
//  when an explicit per-page dataset binding lands, it changes there, not here).
//
//  Law 3: app-layer file. Imports the engine descriptor type + the panel's own
//  derivation; the engine/react buildStoreManifest is called by the caller hook.
//
import type { DatasourceInstanceConfig } from '@statdash/engine'
import type { DataSourceDef } from '../types/constructor'
import { pickActiveDatasetCode, datasetCodeOf } from '../discovery/cubeProfile.store'

/** The store key the single live store is registered under (mirrors the static
 *  preview's `{ default: … }` slot — resolveStore falls back to it for any
 *  pageStoreKey, so one entry covers the whole page). */
export const LIVE_STORE_KEY = 'default'

/**
 * Read a cube-bound DataSource's `nonTimeDims` from its `config` bag, liberally
 * (Postel's Law): a missing or non-array value degrades to `[]` — the builder
 * then constructs a store with no classifier dims rather than crashing the build.
 * Generic over the config bag (Law 1) — no stat-domain dimension named here.
 */
function nonTimeDimsOf(source: DataSourceDef): string[] {
  const dims = source.config?.['nonTimeDims']
  return Array.isArray(dims) ? (dims as string[]) : []
}

/**
 * Derive the live store descriptor(s) from the session's DataSources.
 *
 * First-cube-bound-wins: the first source declaring a `datasetCode` becomes the
 * single 'stats' descriptor (keyed `default`). Returns `[]` when no source is
 * cube-bound — the caller then stays in / falls back to structural mode.
 *
 * Mirrors the runner's `toDatasource` (fetch-store-manifest.ts): `kind:'stats'`,
 * `url` forwarded verbatim (the builder defaults the base when absent), and
 * `params:{ datasetCode, nonTimeDims }` — the exact shape the registered 'stats'
 * builder reads (stats-registrations.ts).
 */
export function deriveLiveDescriptors(sources: DataSourceDef[]): DatasourceInstanceConfig[] {
  const datasetCode = pickActiveDatasetCode(sources)
  if (!datasetCode) return []

  // The winning source is the first one whose datasetCode matches the pick — the
  // same source pickActiveDatasetCode chose. We re-find it (rather than thread it
  // out) so the single cube-binding rule stays owned by cubeProfile.store.
  const source = sources.find((s) => datasetCodeOf(s) === datasetCode)
  if (!source) return []

  return [
    {
      id:   LIVE_STORE_KEY,
      kind: 'stats',
      ...(source.url ? { url: source.url } : {}),
      params: { datasetCode, nonTimeDims: nonTimeDimsOf(source) },
    },
  ]
}
