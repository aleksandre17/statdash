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
 * Relative member-navigation token [ADR-045] — the OLAP-canonical way to address a
 * coordinate RELATIVE to the active one, over the ORDERED MEMBER SET of a dimension.
 * This is MDX `Lag(n)` / `ParallelPeriod` adopted whole (Law 4): `{ $prev: n }` on a
 * dimension addresses the member `n` positions BACK in that dimension's ordered
 * members — NOT a naive `value - n` arithmetic. Off-the-edge (no such prior member,
 * e.g. `$prev:1` at the first period) resolves to NO MEMBER → the honest no-data state
 * (Law 11), never a wrap, clamp, or fabricated 0.
 *
 * GENERIC over dims (Law 1): the token addresses ANY ordered dimension — time is
 * merely the first consumer (an SDMX TIME_PERIOD axis); `{ geo: { $prev: 1 } }` is
 * equally valid over a coded geo codelist. Pure data — a JSON token, never a function
 * (Law 2), so it survives the manifest round-trip and stays Constructor-authorable.
 *
 * `$prev: n` is the minimal canonical set (n ≥ 1: n members back). The union is OPEN
 * (OCP): a future `$first` (MDX OpeningPeriod, for index-to-base / cumulative) or a
 * window token is a NEW discriminant here, resolved by one more branch in
 * `navigateRelative` — the interface and every consumer are unchanged.
 */
export type RelativeCoord = { $prev: number }

/** True ⟺ `v` is a relative member-navigation token (a `{ $prev }` coordinate). */
export function isRelativeCoord(v: unknown): v is RelativeCoord {
  return typeof v === 'object' && v !== null
    && '$prev' in v && typeof (v as { $prev: unknown }).$prev === 'number'
}

/**
 * One named component of a CALCULATED metric: a measure read at a generic
 * coordinate. `at` pins dims (Law 1 — any dim, never time-special) for THIS
 * component's point-read, merged OVER ctx.dims (and over the referenced metric's
 * default dims). A pinned value is EITHER an absolute `DimVal` OR a `RelativeCoord`
 * token (`{ $prev: n }`) navigated over the dimension's ordered members at read time
 * [ADR-045]. Pure data — a coordinate, never a function (Law 2).
 */
export interface MetricInput {
  /** Underlying measure ref — a raw SDMX code OR a registered metric-id. */
  measure: string
  /** Generic coordinate pin merged over ctx.dims for this component's read. Absolute value OR a `{ $prev: n }` relative token. */
  at?:     Partial<Record<string, DimVal | RelativeCoord>>
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

// ── Additivity — the OLAP/DAX grain-behaviour class of a measure [AR-50 M2] ─────
//
//  The scientific core: a measure declares HOW it may cross a dimension when a query
//  asks for a COARSER grain than the stored cells. This is the SSAS/DAX additivity
//  canon (Law 4, adopted whole) — the classification that finally CONSUMES the
//  previously-inert `agg` seam. Every axis is generic (Law 1 — never time-special);
//  the SSOT tuple lets an authoring picker source its options FROM here (Law 8).
export const ADDITIVITY_VALUES = ['additive', 'semi-additive', 'non-additive'] as const

/** A measure's grain-behaviour class — the exact union over ADDITIVITY_VALUES. */
export type Additivity = (typeof ADDITIVITY_VALUES)[number]

/**
 * The per-axis rule a SEMI-ADDITIVE measure needs (DAX `LASTNONBLANK`): which axes
 * SUM and what op collapses the non-summable ones. `additiveOver` names the summable
 * axes GENERICALLY (Law 1 — e.g. `['geo','sector']` for a stock summed over space but
 * `last`-valued over time); every OTHER axis takes `nonAdditiveOp`. Pure data (Law 2).
 */
export interface SemiAdditiveRule {
  additiveOver:  string[]
  nonAdditiveOp: 'last' | 'first' | 'avg'
}

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
  /**
   * Grain-behaviour class (OLAP/DAX additivity) — HOW this measure may cross a
   * dimension when a query requests a COARSER grain than the stored cells [AR-50 M2]:
   *   `additive`      (flows: GDP, output)         — sum over every axis (today's default).
   *   `semi-additive` (stocks: debt, capital, pop) — sum over `semiAdditive.additiveOver`,
   *                                                  `nonAdditiveOp` over every OTHER axis.
   *   `non-additive`  (ratios: deflator, share, per-capita) — MAY NEVER be summed; it is
   *                                                  RE-DERIVED from `calc` at the target
   *                                                  grain (FF-NO-SUM-OF-RATIO). A
   *                                                  non-additive metric with NO `calc`
   *                                                  cannot be aggregated at all.
   * Absent ⇒ the conservative structural default via `effectiveAdditivity` (a `calc`
   * metric ⇒ non-additive; a base metric ⇒ additive) — byte-identical to today's flat
   * sum for base metrics (FF-ADDITIVITY-DEFAULT-IDENTICAL). Scalar reads never consult
   * it. Pure config data (Law 2), Constructor-authorable — the CLASSIFICATION is a
   * DECLARED field, never a runtime value-sniff.
   */
  additivity?:   Additivity
  /** Per-axis rule for a SEMI-ADDITIVE measure (DAX LASTNONBLANK). Ignored for the other classes. */
  semiAdditive?: SemiAdditiveRule
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

// ── Additivity classification — the SSOT resolver [AR-50 M2] ───────────────────
//
//  ONE place resolves a metric's grain-behaviour class, so the grain evaluator
//  (metric-grain.ts), the no-sum guard, and any authoring picker AGREE. The class is
//  a DECLARED field; when absent it resolves to a conservative structural default —
//  a deterministic function of the metric's SHAPE (has-`calc`), NEVER an inspection
//  of data values. This keeps the classification explicit and testable while a
//  not-yet-migrated catalog stays byte-identical for base metrics (all additive).

/**
 * The RESOLVED additivity class of a metric — the explicit `additivity` field wins;
 * else the conservative structural default (a `calc`/derived metric ⇒ 'non-additive',
 * because a ratio/identity must be re-derived not summed; a base metric ⇒ 'additive',
 * today's flat-sum status quo). Pure — reads only the MetricDef (leaf-safe). An
 * undefined metric (a raw code) is additive: a raw store code sums exactly as before.
 */
export function effectiveAdditivity(metric: MetricDef | undefined): Additivity {
  if (!metric) return 'additive'
  if (metric.additivity) return metric.additivity
  return metric.calc ? 'non-additive' : 'additive'
}

/**
 * The conservative additivity a catalog MIGRATION stamps onto an un-classified metric
 * — the same structural default `effectiveAdditivity` resolves, surfaced so a
 * migration can PERSIST the class EXPLICITLY (turning the runtime default into a
 * stored field). Idempotent: a metric that already declares `additivity` keeps it.
 */
export function defaultAdditivity(metric: MetricDef): Additivity {
  return effectiveAdditivity(metric)
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
