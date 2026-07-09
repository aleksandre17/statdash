// ── useMetricCatalog — the live governed catalog for the editor context (AR-49 M0) ─
//
//  Binds the Constructor session to the governed metric/dimension catalog, reading it
//  (once) on first use. The one hook every governed enum-ref control (item 8) and the
//  Metric Palette (item 9) call to ask "which governed nouns can I bind here?" — the
//  semantic-layer peer of `useActiveProfile`.
//
//  Returns the discriminated CatalogEntry (idle | ready | error). Every branch is
//  fail-soft: 'idle'/'error' render the empty/hint path, never a crash (mirrors
//  useActiveProfile's contract). Reactive: re-renders when the catalog transitions
//  idle → ready/error (e.g. after invalidate() following a manifest re-registration).
//
import { useEffect } from 'react'
import { useMetricCatalogStore, type CatalogEntry } from './metricCatalog.store'

/** The hook result — the governed catalog snapshot. */
export type MetricCatalog = CatalogEntry

/**
 * Resolve the governed semantic catalog for the current session, reading it (once)
 * from describeApp() if needed. Item 8's EnumRefField semantic branch consumes this
 * exactly as it consumes useActiveProfile: gate on `status !== 'ready'`, then pass
 * `catalog.metrics` / `catalog.dimensions` to metricOptions / dimensionOptions.
 */
export function useMetricCatalog(): MetricCatalog {
  const catalog = useMetricCatalogStore((s) => s.catalog)
  const load    = useMetricCatalogStore((s) => s.load)

  useEffect(() => { load() }, [load])

  return catalog
}
