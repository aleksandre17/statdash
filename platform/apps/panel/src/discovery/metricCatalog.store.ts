// ── metricCatalog.store — the governed semantic catalog for the editor (AR-49 M0) ─
//
//  Single source of truth for "the governed metric/dimension catalog available in
//  this Constructor session". The SEMANTIC-LAYER peer of `cubeProfile.store`: where
//  that caches the RAW cube profile (a network fetch per datasetCode), this holds the
//  GOVERNED catalog surfaced by the engine's capability-discovery seam,
//  `describeApp().metrics` / `.dimensions` (spec §1.4). Every enum-ref field whose
//  source is 'metrics'/'dimensions' (item 8) and the Metric Palette (item 9) read the
//  same catalog through `useMetricCatalog()`.
//
//  describeApp() is a SYNCHRONOUS, pure read of the engine registries (populated at
//  boot by setupCanvasRegistry() + the manifest's registerMetrics/registerDimensions
//  path). So there is no true 'loading' phase — the catalog is 'idle' until first
//  read, then 'ready' (or 'error' if the read throws before registries exist). The
//  discriminated shape still mirrors ProfileEntry so item 8 gates identically
//  (`catalog.status !== 'ready'`).
//
//  GRACEFUL DEGRADATION is first-class: an empty registry ⇒ 'ready' with empty maps
//  (the palette shows nothing, fields fall back to free entry), NEVER a crash. A
//  throw becomes 'error', not a thrown render.
//
//  Law 3 (engine app-agnostic): this store lives in apps/panel and CONSUMES the
//  engine's describeApp(); the engine knows nothing of the panel.
//
import { create } from 'zustand'
import { describeApp } from '@statdash/react/engine'
import type { MetricDef } from '@statdash/engine'
import type { CatalogDimension } from './semanticCatalogOptions'

/** Async-resource-shaped state for the governed catalog (mirrors ProfileEntry). */
export type CatalogEntry =
  | { status: 'idle' }
  | { status: 'ready'; metrics: Record<string, MetricDef>; dimensions: Record<string, CatalogDimension> }
  | { status: 'error'; message: string }

/**
 * Read `dimensions` from the manifest DEFENSIVELY. `describeApp().dimensions`
 * (engine item 5) is not yet on `AppManifest`; until it lands the field is simply
 * absent and this yields `{}` (spec: "do not hard-fail on its absence"). Once item 5
 * ships the map, this reads it unchanged — the cast becomes a widening no-op. Metrics
 * already ship on `AppManifest.metrics` today, so they are read type-safely.
 */
function readManifestDimensions(
  manifest: ReturnType<typeof describeApp>,
): Record<string, CatalogDimension> {
  const dims = (manifest as { dimensions?: Record<string, CatalogDimension> }).dimensions
  return dims ?? {}
}

interface MetricCatalogState {
  /** The governed catalog snapshot (idle | ready | error). */
  catalog: CatalogEntry
  /**
   * Read the catalog from describeApp() into state. Idempotent: a no-op once
   * 'ready' (one read per session — mirror of cubeProfile.store.ensure). Call
   * invalidate() to force a re-read after the manifest's metrics/dimensions are
   * (re)registered.
   */
  load: () => void
  /** Drop the cached catalog back to 'idle' so the next load() re-reads describeApp(). */
  invalidate: () => void
}

export const useMetricCatalogStore = create<MetricCatalogState>((set, get) => ({
  catalog: { status: 'idle' },

  load: () => {
    if (get().catalog.status === 'ready') return
    try {
      const manifest = describeApp()
      set({
        catalog: {
          status:     'ready',
          metrics:    manifest.metrics ?? {},
          dimensions: readManifestDimensions(manifest),
        },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'catalog unavailable'
      set({ catalog: { status: 'error', message } })
    }
  },

  invalidate: () => set({ catalog: { status: 'idle' } }),
}))
