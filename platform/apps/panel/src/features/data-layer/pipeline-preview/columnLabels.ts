// ── columnLabels — governed column headers for the live grid (SPEC §3.2 / §3.4) ─
//
//  The grid speaks GOVERNED nouns in the author plane: a column header shows the
//  metric/dimension's governed label, never a raw SDMX code (FF-AUTHOR-NO-QUERY
//  line, Law 4). This is the pure resolver — `field → label` — built from the same
//  governed catalog (`describeApp` via useMetricCatalog) every other author-plane
//  picker reads. Fail-soft: an uncatalogued field falls back to the field name
//  itself (honest — the true field, never a fabricated label).
//
import type { MetricDef, ObsQuery } from '@statdash/engine'
import { TIME_DIM, MEASURE_DIM } from '@statdash/engine'
import type { CatalogDimension } from '../../../discovery/semanticCatalogOptions'
import { readCatalogLabel, governedDimensionLabels } from '../../../discovery/semanticCatalogOptions'
import type { Locale } from '../../../types/constructor'

/** The value-carrying field a query observation lands its number under, and the
 *  SDMX MEASURE key (the observation's flow-code field) — both take the bound
 *  metric's governed label. `MEASURE_DIM` is the engine SSOT for the measure key
 *  (ADR-046 W-P4 barrel export — no longer inlined). */
const VALUE_FIELD = 'value'
const MEASURE_FIELD = MEASURE_DIM

/** Normalize an ObsQuery.measure (string | string[]) to the first bound id/code. */
function firstMeasure(measure: ObsQuery['measure']): string | undefined {
  return Array.isArray(measure) ? measure[0] : measure || undefined
}

export interface ColumnLabelResolver {
  (field: string): string
}

/**
 * Build a `field → governed label` resolver for the current locale, keyed off the
 * governed catalog + the query's bound measure.
 *
 *   • the value column (`value`)      → the bound metric's governed label
 *   • the measure column (`measure`)  → the bound metric's governed label
 *   • a governed dimension code       → the dimension's governed label
 *   • the time dim (`time`)           → the governed time label, else "Year/წელი"
 *   • anything else (a derived field) → the field name (honest fallback)
 */
export function buildColumnLabels(args: {
  metrics:    Record<string, MetricDef>
  dimensions: Record<string, CatalogDimension>
  query:      ObsQuery
  locale:     Locale
}): ColumnLabelResolver {
  const { metrics, dimensions, query, locale } = args
  const dimLabel = governedDimensionLabels(dimensions, locale)

  // The bound metric's governed label (drives the value/measure column header).
  const boundId = firstMeasure(query.measure)
  const metricDef = boundId ? metrics[boundId] : undefined
  const metricLabel = metricDef ? readCatalogLabel(metricDef.label, locale, boundId!) : boundId

  const timeFallback = locale === 'en' ? 'Year' : 'წელი'

  return (field: string): string => {
    if (field === VALUE_FIELD || field === MEASURE_FIELD) return metricLabel ?? field
    if (field === TIME_DIM) return dimLabel(field) ?? timeFallback
    return dimLabel(field) ?? field
  }
}
