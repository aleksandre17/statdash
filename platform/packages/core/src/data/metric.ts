// ── Metric registry [N26] ──────────────────────────────────────────────
//
//  DESIGN INVARIANT: this file must NOT import defaultRegistry, interpretSpec,
//  or any module from registry/. It is a pure vocabulary leaf.
//  Fitness test: metric.fitness.test.ts asserts no such import exists.
//
import type { LocaleString }                    from '../i18n/types'
import type { DimVal, FilterValue }              from '../sdmx'
import type { Expr }                             from '@statdash/expr'
import type { MetadataPort, ProvenanceRecord }   from '../core/provenance'
import type { SectionContext }                   from '../core/context'
import type { FormatKey }                         from './kpi-spec'

/**
 * One named component of a CALCULATED metric: a measure read at a generic
 * coordinate. `at` pins dims (Law 1 — any dim, never time-special) for THIS
 * component's point-read, merged OVER ctx.dims (and over the referenced metric's
 * default dims). Pure data — a coordinate, never a function (Law 2).
 */
export interface MetricInput {
  /** Underlying measure ref — a raw SDMX code OR a registered metric-id. */
  measure: string
  /** Generic coordinate pin merged over ctx.dims for this component's read. */
  at?:     Partial<Record<string, DimVal>>
}

/**
 * A calculated metric's value: a declarative EXPRESSION over named component
 * measures — measure-algebra in the semantic layer (Malloy/dbt-MetricFlow/Cube
 * `ratio`/`derived`). Each input is point-read at the active coordinate ⊕ input.at
 * and bound into the expr scope as `$derived[<name>]`; the expr — REUSING
 * @statdash/expr, NEVER a second dialect — yields the metric's scalar value.
 *
 *   ratio  = mul(div($num, $denom), 100)        // labour share, GDP deflator
 *   derived= sub($a, $b)                         // an accounting identity
 *
 * Law 2: pure data (an Expr tree), never a function. Calc metrics are SCALAR —
 * consumed at a point coordinate (a KPI `metric` value, the storeValAt domain);
 * they are not row-set query measures.
 */
export interface MetricCalc {
  /** Named component measures, bound into the expr scope as `$derived[<name>]`. */
  inputs: Record<string, MetricInput>
  /** The expression over those inputs. JSON-serializable, Constructor-safe. */
  expr:   Expr
}

/**
 * The allowed cross-time aggregations a metric may declare — the SINGLE SSOT for
 * both the `MetricAgg` type AND any picker over the values (Law 8: an authoring
 * agg-picker sources its options FROM here, never a hardcoded list; a new
 * aggregation = one entry added here and every consumer — type + picker — follows).
 * A runtime tuple so it is enumerable at authoring time; `as const` so the derived
 * union stays exact.
 */
export const METRIC_AGG_VALUES = ['sum', 'avg', 'last'] as const

/** A metric's declared cross-time aggregation — the exact union over METRIC_AGG_VALUES. */
export type MetricAgg = (typeof METRIC_AGG_VALUES)[number]

/**
 * Definition of one named metric.
 * Thin — not a modeling language. No filters, no joins, no SQL.
 */
export interface MetricDef {
  /**
   * SDMX measure code(s). string[] for multi-measure metrics. ABSENT for a
   * calculated metric (its value comes from `calc` — see below); a base metric
   * always carries `code`.
   */
  code?:         string | string[]
  /**
   * Calculated-metric value — a declarative expression over OTHER measures
   * (DC-01). Present ⟺ this is a derived metric; its underlying codes (for warm /
   * store-routing) are its components' codes, expanded by resolveMeasureRef.
   * Absent ⇒ a base metric, byte-identical to the status quo.
   */
  calc?:         MetricCalc
  /** Human-readable label. */
  label:         LocaleString
  /** Unit of measurement (e.g. 'million GEL', '% change'). */
  unit?:         LocaleString
  /**
   * Default DISPLAY format for this metric's scalar value — a `FormatKey` the
   * downstream getFormatter registry understands ('mln_gel' | 'sign_pct' | …). Pure
   * data (a registry key string, never a function — Law 2). Governance declared ONCE
   * on the metric (the semantic-layer point): a display surface that reads a metric-id
   * with no explicit format of its own falls back to this. THIN — a format key, not a
   * formatter. Absent ⇒ current behavior (the consuming surface's own default);
   * explicit consumer-side format always wins (explicit config > metric default).
   * Reachable through the one resolveMeasureRef seam (ResolvedMeasure.format); its
   * display consumer (the featured slider / metric-driven panels) lands in AR-40 P1.
   */
  format?:       FormatKey
  /** Default aggregation across time (the METRIC_AGG_VALUES SSOT). */
  agg?:          MetricAgg
  /** Parent metric id (for hierarchical navigation / drill-down). */
  parent?:       string
  /** URL to the official methodology page. Flows into ProvenanceRecord.methodology. */
  methodology?:  string
  /** Longer description for tooltips / info-affordance. */
  description?:  LocaleString
  /**
   * Datasource id (storeKey) this metric lives in — the Cube.dev `dataSource`
   * pattern: a measure NAMES its store. A node whose DataSpec references this
   * metric routes to this store unless the node sets an explicit `storeKey`.
   * If absent, the page/section default store is used (byte-identical to the
   * single-store status quo). Pure data — a storeKey string, never a function.
   */
  dataSource?:   string
  /** Default dimension filters (e.g. { adjustment: 'S' }). Merged with query-time filters. */
  dims?:         Partial<Record<string, FilterValue>>
}

const _registry = new Map<string, MetricDef>()

/** Register a named metric. Last-write-wins. */
export function registerMetric(id: string, def: MetricDef): void {
  _registry.set(id, def)
}

/**
 * Bulk-register a metric catalog keyed by id — the agnostic seam a tenant's
 * semantic layer is delivered through [ENG-05]. The catalog is pure DATA (a
 * `Record<id, MetricDef>`), so it carries NO tenant identity into core: the app
 * boot reads its tenant catalog (from the manifest, the same way the runner reads
 * `manifest.datasources` to register store-builders) and hands it here. Idempotent
 * + last-write-wins per id, mirroring registerMetric. Empty catalog ⇒ no-op
 * (byte-identical to the raw-code status quo via Postel/FF-RAW-CODE-IDENTICAL).
 */
export function registerMetrics(catalog: Record<string, MetricDef>): void {
  for (const [id, def] of Object.entries(catalog)) _registry.set(id, def)
}

/** Look up a registered metric by id. */
export function getMetric(id: string): MetricDef | undefined {
  return _registry.get(id)
}

/** Return all registered metric ids, sorted. */
export function listMetrics(): string[] {
  return [..._registry.keys()].sort()
}

// ── resolveMeasureRef — the SSOT measure-resolution seam [N26 / R1] ────
//
//  A "measure reference" in config is EITHER a raw SDMX code (today's
//  behaviour — passes through UNCHANGED) OR a metric-id registered in the
//  MetricRegistry. This seam is the SINGLE place that distinguishes the two:
//  every binding-path consumer (QueryResolver, the convenience resolvers,
//  extractRequirements) resolves measure references THROUGH here, so there is
//  one resolution path (FF-ONE-RESOLUTION-PATH), not a parallel re-impl.
//
//  Postel / expand-contract: a raw code that is NOT a registered metric-id
//  resolves to itself with NO governance and NO default dims, so every
//  existing (raw-code) config produces a byte-identical resolved query.
//  Wiring the semantic layer in is purely additive (FF-RAW-CODE-IDENTICAL).
//
//  When the ref IS a metric-id, it resolves to the MetricDef's underlying
//  code(s) PLUS the governance declared once on the metric: unit, methodology,
//  default dims, and default aggregation. Those flow to the query (dims) and
//  to the panel (unit/methodology via the provenance seam, see
//  withMetricProvenance).
//
//  This file stays a pure vocabulary leaf — resolveMeasureRef reads only the
//  local _registry via getMetric; it imports nothing from registry/. The
//  binding wiring lives in registry/resolvers.ts (applyMeasureRef), which the
//  metric.fitness purity test guards.

/**
 * The result of resolving a measure reference. `codes` is always present
 * (the underlying SDMX code(s) the store will be queried with). The governance
 * fields are present ONLY when the ref resolved to a registered metric-id;
 * for raw codes they are all absent, so consumers can merge defaults with
 * "explicit wins" precedence and a raw-code path stays byte-identical.
 */
export interface ResolvedMeasure {
  /** Underlying SDMX measure code(s) — what the store is actually queried with. */
  codes:        string[]
  /** Metric-default unit, if the ref was a metric-id with a unit. */
  unit?:        LocaleString
  /** Metric-default DISPLAY format key, if declared on the metric (consumer-side format wins). */
  format?:      FormatKey
  /** Metric-default methodology URL, if declared on the metric. */
  methodology?: string
  /** Metric-default cross-time aggregation, if declared (the METRIC_AGG_VALUES SSOT). */
  agg?:         MetricAgg
  /** Metric-default dimension filters — merged into the query as DEFAULTS (explicit query-time filters win). */
  dims?:        Partial<Record<string, FilterValue>>
  /**
   * The storeKey the metric declares it lives in (Cube.dev `dataSource`).
   * Present ONLY when the ref resolved to a registered metric-id that named a
   * `dataSource`. The binding layer (react `resolveStore`) routes a referencing
   * node to this store unless the node sets an explicit `storeKey` (precedence:
   * explicit node storeKey > metric dataSource > page > 'default'). A plain
   * string — flows across the arrow with no core→react import.
   */
  dataSource?:  string
}

/**
 * Resolve a measure reference (raw code, metric-id, or an array mixing both)
 * to its underlying code(s) plus any governance carried by a registered metric.
 *
 * - A registered metric-id expands to its `code`(s) and contributes its
 *   `unit`/`methodology`/`agg`/`dims`.
 * - An unregistered string passes through as a raw code (Postel: liberal accept).
 * - For arrays, each element is resolved independently and the underlying codes
 *   are concatenated in order (duplicates preserved — the store de-dupes).
 *
 * Governance precedence when an array mixes metrics: first metric with a given
 * governance field wins (deterministic, order-stable). Callers layer the
 * explicit-config > metric-default > cube-default precedence on top: anything
 * the config sets explicitly is applied AFTER these defaults and overrides them.
 */
export function resolveMeasureRef(ref: string | string[]): ResolvedMeasure {
  const refs = Array.isArray(ref) ? ref : [ref]
  const out: ResolvedMeasure = { codes: [] }
  let dims: Partial<Record<string, FilterValue>> | undefined

  for (const r of refs) {
    const metric = _registry.get(r)
    if (!metric) {
      // Raw code — pass through unchanged (byte-identical path).
      out.codes.push(r)
      continue
    }
    // Underlying codes. A CALCULATED metric expands to its components' codes (so
    // warming / store-routing a calc metric warms its inputs — recursion handles a
    // calc input that is itself a metric-id). A base metric expands to its own
    // code(s); a calc metric carries no `code`, so the guard skips the undefined.
    if (metric.calc) {
      for (const input of Object.values(metric.calc.inputs))
        out.codes.push(...resolveMeasureRef(input.measure).codes)
    } else if (metric.code !== undefined) {
      out.codes.push(...(Array.isArray(metric.code) ? metric.code : [metric.code]))
    }
    // First-metric-wins for scalar governance (order-stable, deterministic).
    if (out.unit        === undefined && metric.unit        !== undefined) out.unit        = metric.unit
    if (out.format      === undefined && metric.format      !== undefined) out.format      = metric.format
    if (out.methodology === undefined && metric.methodology !== undefined) out.methodology = metric.methodology
    if (out.agg         === undefined && metric.agg         !== undefined) out.agg         = metric.agg
    if (out.dataSource  === undefined && metric.dataSource  !== undefined) out.dataSource  = metric.dataSource
    if (metric.dims) {
      // Earlier metric's dims win on key collision (first-wins, mirrors scalars).
      dims = { ...metric.dims, ...dims }
    }
  }

  if (dims && Object.keys(dims).length > 0) out.dims = dims
  return out
}

/**
 * Compose metric-default dims UNDER an explicit filter — the ONE governed-merge
 * semantics shared by the query/chart path (resolveQueryMeasures, resolvers.ts) and
 * the KPI read path (kpi-coord.metricFilter). Metric dims are DEFAULTS: the explicit
 * filter's keys WIN on collision (`{ ...metricDims, ...explicit }`), so an author's
 * own slice always overrides the metric governance while the metric FILLS every dim
 * the author left open. No metric dims ⇒ the explicit filter is returned untouched
 * (identity — a raw-code / dims-less-metric path stays byte-identical, FF-RAW-CODE-
 * IDENTICAL). One helper on BOTH surfaces ⇒ a chart and a KPI reading the SAME
 * governed metric resolve the SAME coordinate and can never drift ("one governed
 * number on every surface" — the M0 DoD).
 *
 * Generic over each side's value vocabulary (the query path carries `FilterValue`;
 * the KPI `DimFilter` carries `DimVal | DimFilterRef`) — the merge is a pure
 * structural spread, so it composes either vocabulary without privileging a dim (Law 1).
 */
export function mergeMetricDims<D, E>(
  metricDims: Partial<Record<string, D>> | undefined,
  explicit:   Partial<Record<string, E>> | undefined,
): Partial<Record<string, D | E>> | undefined {
  if (!metricDims) return explicit
  return { ...metricDims, ...explicit }
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
        // A calc metric carries no own `code` (it has no direct provenance — its
        // COMPONENTS, registered separately, carry theirs); guard the undefined.
        const codes = def.code === undefined ? [] : (Array.isArray(def.code) ? def.code : [def.code])
        return codes.includes(code)
      })
      // Metric-level governance (methodology + unit) fills provenance as a
      // DEFAULT; runtime/cube provenance wins via the spread order below
      // (explicit cube > metric default — the R1 precedence, provenance half).
      const metricFill: Partial<ProvenanceRecord> = {}
      if (metric?.methodology) metricFill.methodology = metric.methodology
      if (metric?.unit)        metricFill.unit        = metric.unit
      const runtime = base.provenance(code, ctx)
      if (!metric && !runtime) return undefined
      return { ...metricFill, ...runtime }
    },
  }
}
