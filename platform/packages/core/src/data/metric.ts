// ── Metric registry [N26] ──────────────────────────────────────────────
//
//  DESIGN INVARIANT: this file must NOT import defaultRegistry, interpretSpec,
//  or any module from registry/. It is a pure vocabulary leaf.
//  Fitness test: metric.fitness.test.ts asserts no such import exists.
//
import type { LocaleString }                    from '../i18n/types'
import type { FilterValue }                      from '../sdmx'
import type { MetadataPort, ProvenanceRecord }   from '../core/provenance'
import type { SectionContext }                   from '../core/context'

/**
 * Definition of one named metric.
 * Thin — not a modeling language. No filters, no joins, no SQL.
 */
export interface MetricDef {
  /** SDMX measure code(s). string[] for multi-measure metrics. */
  code:          string | string[]
  /** Human-readable label. */
  label:         LocaleString
  /** Unit of measurement (e.g. 'million GEL', '% change'). */
  unit?:         LocaleString
  /** Default aggregation across time. */
  agg?:          'sum' | 'avg' | 'last'
  /** Parent metric id (for hierarchical navigation / drill-down). */
  parent?:       string
  /** URL to the official methodology page. Flows into ProvenanceRecord.methodology. */
  methodology?:  string
  /** Longer description for tooltips / info-affordance. */
  description?:  LocaleString
  /** Datasource id this metric belongs to. If absent, section default is used. */
  datasource?:   string
  /** Default dimension filters (e.g. { adjustment: 'S' }). Merged with query-time filters. */
  dims?:         Partial<Record<string, FilterValue>>
}

const _registry = new Map<string, MetricDef>()

/** Register a named metric. Last-write-wins. */
export function registerMetric(id: string, def: MetricDef): void {
  _registry.set(id, def)
}

/** Look up a registered metric by id. */
export function getMetric(id: string): MetricDef | undefined {
  return _registry.get(id)
}

/** Return all registered metric ids, sorted. */
export function listMetrics(): string[] {
  return [..._registry.keys()].sort()
}

/**
 * Return all registered metrics as a JSON-serializable Record keyed by id.
 * Used by describeApp() to populate the Constructor's data-catalog picker.
 */
export function listMetricDefs(): Record<string, MetricDef> {
  return Object.fromEntries(_registry.entries())
}

/**
 * MetadataPort decorator — merges metric-level methodology into store provenance.
 * Install in app bootstrap: `myStore.metadata = withMetricProvenance(myStore.metadata ?? emptyPort)`
 *
 * Spread order: `{ ...metricFill, ...runtime }` — runtime fields win.
 */
export function withMetricProvenance(base: MetadataPort): MetadataPort {
  return {
    provenance(code: string, ctx: SectionContext): ProvenanceRecord | undefined {
      const metric = [..._registry.values()].find((def) => {
        const codes = Array.isArray(def.code) ? def.code : [def.code]
        return codes.includes(code)
      })
      const metricFill: Partial<ProvenanceRecord> = metric?.methodology
        ? { methodology: metric.methodology }
        : {}
      const runtime = base.provenance(code, ctx)
      if (!metric && !runtime) return undefined
      return { ...metricFill, ...runtime }
    },
  }
}
