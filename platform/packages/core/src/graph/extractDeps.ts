// ── extractDeps — the config → dependency SSOT [AR-49 V1 / ADR-024] ──────────
//
//  A PURE, framework-free static analyzer: given ONE renderable's declarative
//  config, compute the TOTAL set of STATE SOURCES its output depends on — every
//  dim, filter param, page var, perspective axis, classifier, store, measure, and
//  the active locale. This is the generalisation and SSOT-ification of the shadow
//  dependency graph the platform hand-encodes today as scattered string cache-keys:
//
//    specDimKey (engine/specDimKey.ts)      — "which dims a spec reads"        → deps.dims + deps.requirements
//    varsKey    (useNodeRows.ts)            — "vars are dependencies"          → deps.vars
//    effectiveStoreKey / specDataSource     — "which store"                    → deps.stores
//    locale fold (useNodeRows/useKpiRows)   — "locale re-localizes labels"     → deps.locale
//    the AR-36 encoding/pipe $ctx scanner   — "state-bound channels/steps"     → deps.dims / deps.vars
//    warm.ts collectRequirements            — "the concrete (code,dims) reads" → deps.requirements
//
//  Two of those (varsKey, the promise-cache recipeKey) are patches over shipped
//  bugs (AR-36 vars staleness, N34c collision); a third (warm vs render) is a
//  permanently-policed drift class. Each exists because the platform NEEDED graph
//  semantics and derived them by hand for one axis at a time. `extractDeps` is the
//  ONE mechanism that computes them all, from the config, in core — the edge set
//  the reactive query graph (V2) compiles from (ADR-024, SPEC-rendering-architecture §3.1).
//
//  ── Why static extraction is TOTAL (the platform's structural advantage) ──
//  Law 2 forbids functions in config — no imperative getter closure, no inline
//  data-fetch or branch. EVERY dependency is therefore a NAMED, declarative token:
//  a `$ctx`/`$param`/`$ref`/`$cl`/`$d` ref, a `fromDim`/`toDim`/`timeDimension.dim`
//  key, a `visibleWhen` param, a measure/metric id, a `storeKey`, or a `{token}` in a
//  display template. Nothing is hidden in a closure, so a purely static walk sees
//  the complete dependency set. (Vega can compile a chart spec's graph for this same
//  reason; Grafana Scenes cannot compile at all — its graph is programmatic. We have
//  a fully-declarative DASHBOARD grammar, so we compile a dashboard.) If this ever
//  stops being true — a dependency that a static walk cannot see — that is a
//  foundational Law-2 breach, not an extractDeps bug.
//
//  ── Residence & the arrow ──
//  Pure core, `packages/core/src/graph/` — no react/plugins/DOM import. Target-
//  agnostic by construction (serves live render, SSR/SSG, warm and the Constructor
//  preview identically). extractDeps only COMPUTES here (V1). It does NOT yet drive
//  invalidation or rendering — that is V2 (shadow) / V3 (switch). Deleting this
//  directory reverts the step (reversible).
//
//  ── Scope: ONE renderable ──
//  extractDeps analyses a SINGLE node's own declarative bindings; it does NOT walk
//  into child-node subtrees (those are separate renderables, each with its own
//  edge set). V2's `compilePage` walks the tree and calls extractDeps per node.

import type { DataSpec, TimeDimensionSpec } from '../config/data-spec'
import type { TransformStep }               from '../data/transform'
import type { EncodingSpec, EncodingChannel } from '../data/encoding'
import type { VisibilityExpr }              from '../config/visibility'
import type { SectionContext }              from '../core/context'
import type { Requirement }                 from '../data/store'
import type { ObsQuery }                    from '../sdmx'
import { TIME_DIM }                         from '../core/context'
import { refScope }                         from '../ref/ref'
import { specMeasureRefs, specDataSource }  from '../data/metric-store'
import { resolveMeasureRef }                from '../data/metric'
import { extractRequirements }              from '../data/spec'
import { PERSPECTIVE_PARAM }                from '../config/perspective-state'

// ── NodeDeps — the total dependency (edge) set of one renderable ──────────────
//
//  Every field names STATE SOURCES as GENERIC KEYS (Law 1 — a Set of keys, never a
//  hardcoded dim/param name). A source appearing in a set is an edge: when that
//  source changes, the node's output may change. The reactive graph (V2) subscribes
//  each node to exactly these sources; writing a param NOT in `params` re-evaluates
//  nothing.
//
export interface NodeDeps {
  /**
   * OLAP dim keys (`ctx.dims`) the node's data reads: the query's `$ctx`-referenced
   * filter dims, `fromDim`/`toDim`/`timeDimension.dim`, and the conventional TIME_DIM
   * for every time-bound spec. Time is a STRUCTURAL (spec-type-driven) dependency the
   * resolvers always read — declared by spec shape, NOT hidden in a closure — so it is
   * captured here by the typed spec scan, keeping totality intact under Law 2.
   */
  dims:        ReadonlySet<string>
  /** Filter-param keys (`filterParams`): `visibleWhen` params, `$param` refs, and expr `$ctx` in `vars`. */
  params:      ReadonlySet<string>
  /** Derived page-var keys: `$ref` (data layer), `$derived` (expr layer), and the vars an encoding/pipe `$ctx` may resolve against. */
  vars:        ReadonlySet<string>
  /** Perspective AXIS param keys the node's `visibleWhen` depends on (param-less op ⇒ the conventional axis). */
  perspective: ReadonlySet<string>
  /** Classifier dim keys referenced via `$cl`/`$d` (lookup/join/display joins). */
  classifiers: ReadonlySet<string>
  /** Store keys the node routes to: explicit `storeKey`, a referenced metric's `dataSource`, and any `blend` store. */
  stores:      ReadonlySet<string>
  /** Measure refs (raw SDMX codes AND metric-ids) the node reads — the warm/prefetch measure set. */
  measures:    ReadonlySet<string>
  /** True when the node renders any localized label / template — depends on the active locale. */
  locale:      boolean
  /**
   * Concrete `(code × dims)` reads for warm/prefetch — the `extractRequirements`
   * output, subsumed. Present only when a `SectionContext` is supplied (it is
   * ctx-dependent); the structural KEY sets above are ctx-independent.
   */
  requirements: readonly Requirement[]
}

// ── Analysis context (optional) ───────────────────────────────────────────────
export interface DepScanCtx {
  /**
   * SectionContext — supplied to compute concrete `requirements` (the warm plan).
   * The structural key sets (dims/params/vars/…) are extracted WITHOUT it, so a
   * ctx-free call still yields the complete edge set.
   */
  section?:        SectionContext
  /**
   * Known perspective ids of the page's axes — enables precise detection of a
   * PERSPECTIVE CARRIER display field (`Record<perspectiveId, LocaleString>`,
   * config/template.ts). Absent ⇒ carriers are treated as plain locale-bearing
   * display (still marks `locale`, coarse on `perspective`).
   */
  perspectiveIds?: readonly string[]
  /**
   * The page's AMBIENT OLAP dim-coordinate keys (`ctx.dims` keys — the active filter/
   * perspective-scoped dimensions). A `val`-based spec (timeseries/growth/row-list/
   * ratio-list) resolves each cell as an OLAP point-read at the WHOLE ambient coordinate
   * (`storeVal → _val → matchedValues(code, ctx.dims)`, store-impl/store-filter): the
   * matching loop iterates EVERY dim in `ctx.dims`, so the cell's value depends on every
   * active dim, not merely the structural TIME_DIM. Supplied ⇒ those keys are added to
   * such a spec's `deps.dims` (the precise ambient read-set — the exact coordinate the
   * matching loop reads, dims-only, never params/vars/stores). Absent ⇒ the model falls
   * back to TIME_DIM alone (V1 behaviour — the documented ambient-dim under-fire). An
   * `obs` `query` is NOT included here: its rows are scoped ONLY by `query.filter`
   * (`matchesFilter` reads the declared filter, never the ambient coordinate), so its
   * exact dim edges come from `scanObsQuery`. Generic keys (Law 1), never hardcoded names.
   */
  ambientDims?:    readonly string[]
}

/** A renderable's declarative config. Structurally a generic node — extractDeps reads its known slots + sweeps its display fields. */
export type DepNode = Record<string, unknown>

// ── Mutable accumulator (internal) ────────────────────────────────────────────
interface Acc {
  dims:        Set<string>
  params:      Set<string>
  vars:        Set<string>
  perspective: Set<string>
  classifiers: Set<string>
  stores:      Set<string>
  measures:    Set<string>
  locale:      boolean
  requirements: Requirement[]
}

function newAcc(): Acc {
  return {
    dims: new Set(), params: new Set(), vars: new Set(), perspective: new Set(),
    classifiers: new Set(), stores: new Set(), measures: new Set(),
    locale: false, requirements: [],
  }
}

// Slots handled by a TYPED scanner (never swept as display fields) + interaction
// slots (click/write-side, NOT read-side render deps — a drill-down `$row`/`$param`
// is resolved on click, not on render, so it is out of scope for RENDER dependency).
const TYPED_SLOTS   = new Set(['data', 'transforms', 'vars', 'view', 'storeKey'])
const INTERACTION_SLOTS = new Set(['on', 'actions', 'dataLinks'])

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
/** A separate renderable (has a `type` string) — its deps belong to IT, so the sweep stops here. */
function isChildNode(v: unknown): boolean {
  return isObj(v) && typeof v['type'] === 'string'
}

/**
 * Compute the total dependency set of ONE renderable.
 *
 * ```ts
 * const deps = extractDeps(node, { section: ctx.sectionCtx, perspectiveIds })
 * deps.dims.has('geo')      // does this node re-read when geo changes?
 * deps.requirements         // the exact (code,dims) slices to warm
 * ```
 */
export function extractDeps(node: DepNode, ctx: DepScanCtx = {}): NodeDeps {
  const acc = newAcc()

  // 1 · data (DataSpec) — measures, stores, structural dims, encoding/pipe refs
  const data = node['data']
  if (isSpec(data)) scanSpec(data, acc, ctx.ambientDims)

  // 2 · transforms (TransformStep[]) — $ctx/$cl/$d refs + blend store/measures
  const transforms = node['transforms']
  if (Array.isArray(transforms)) scanTransforms(transforms as TransformStep[], acc)

  // 3 · vars (VarMap) — expr refs: $ctx→params, $derived/$ref→vars
  const vars = node['vars']
  if (isObj(vars)) for (const expr of Object.values(vars)) sweepExprRefs(expr, acc)

  // 4 · explicit storeKey — top tier of the effectiveStoreKey cascade
  const sk = node['storeKey']
  if (typeof sk === 'string' && sk) acc.stores.add(sk)

  // 5 · visibility (view.visibleWhen) — params + perspective axes
  const view = node['view']
  if (isObj(view) && isObj(view['visibleWhen'])) {
    scanVisibility(view['visibleWhen'] as VisibilityExpr, acc)
  }

  // 6 · display fields — locale + {token} dims + perspective carriers + stray $-refs
  sweepDisplay(node, acc, ctx.perspectiveIds)

  // 7 · concrete requirements (warm plan) — ctx-dependent, best-effort (never throws)
  if (ctx.section && isSpec(data)) {
    try { acc.requirements.push(...extractRequirements(data, ctx.section)) }
    catch { /* unknown/malformed spec emits no requirements — mirrors warm.ts */ }
  }

  return acc as NodeDeps
}

function isSpec(v: unknown): v is DataSpec {
  return isObj(v) && typeof v['type'] === 'string'
}

// A `val`-based spec reads the WHOLE ambient dim coordinate (matchedValues iterates
// ctx.dims), so it depends on EVERY active dim — the precise ambient read-set. Adding
// the ambient keys is idempotent with the structural TIME_DIM the caller already added
// (TIME_DIM is normally itself an ambient key). Generic, dims-only (Law 1).
function addAmbient(acc: Acc, ambientDims?: readonly string[]): void {
  if (ambientDims) for (const d of ambientDims) acc.dims.add(d)
}

// ── scanSpec — the typed DataSpec dependency scan ─────────────────────────────
function scanSpec(spec: DataSpec, acc: Acc, ambientDims?: readonly string[]): void {
  // Measures + metric-declared store routing (the middle tier of effectiveStoreKey).
  for (const ref of specMeasureRefs(spec)) {
    acc.measures.add(ref)
    const ds = resolveMeasureRef(ref).dataSource
    if (ds) acc.stores.add(ds)
  }
  const specStore = specDataSource(spec)
  if (specStore) acc.stores.add(specStore)

  switch (spec.type) {
    case 'query':
      scanObsQuery(spec.query, acc)
      addTimeBinding(acc, spec.fromDim, spec.toDim, spec.timeDimension)
      if (spec.pipe) scanTransforms(spec.pipe, acc)
      if (spec.encoding) scanEncoding(spec.encoding, acc)
      break
    case 'timeseries':
    case 'growth':
      // Time-bound point/series specs: the resolver reads a year range from ctx —
      // a STRUCTURAL time dependency (declared by spec type, not a closure). Each
      // enumerated year is a `val` point-read at `{ ...ctx.dims, [TIME_DIM]: y }`, so
      // the value ALSO depends on every OTHER ambient dim (geo/sector/…): a non-time
      // dim change re-sums the cell. Record the whole ambient read-set, not just time.
      acc.dims.add(TIME_DIM)
      addAmbient(acc, ambientDims)
      addTimeBinding(acc, spec.fromDim, spec.toDim, spec.timeDimension)
      break
    case 'row-list':
      // Each row is a `val` point-read at the active coordinate ⇒ time-bound AND
      // ambient: `matchedValues(code, ctx.dims)` reads every active dim.
      acc.dims.add(TIME_DIM)
      addAmbient(acc, ambientDims)
      break
    case 'ratio-list':
      // Numerator/denominator are `val` reads at the active coordinate — the whole
      // ambient coordinate, as row-list.
      acc.dims.add(TIME_DIM)
      addAmbient(acc, ambientDims)
      if (spec.pipe) scanTransforms(spec.pipe, acc)
      break
    case 'transform':
      scanTransforms(spec.steps, acc)
      if (spec.encoding) scanEncoding(spec.encoding, acc)
      break
    case 'pivot':
      // Inline `rows` data, no store read, no ctx time — deps come only from the
      // (client-side) pipeline/encoding the host node carries (scanned in steps 2/6).
      break
  }
}

// ── scanObsQuery — filter dims + $ctx pins ────────────────────────────────────
function scanObsQuery(query: ObsQuery, acc: Acc): void {
  const filter = query.filter
  if (!filter) return
  for (const [dim, fv] of Object.entries(filter)) {
    // A `$ctx`/`$ne+$ctx` filter value binds this slice to a runtime dim value —
    // the referenced dim is the dependency (the filter KEY itself is only a state
    // dep when the VALUE reads state; a literal pin is a constant, not an edge).
    // NeRef ({$ne}) alone carries no $ctx — cast through a record for the probe.
    const rec = isObj(fv) ? (fv as Record<string, unknown>) : undefined
    if (rec && typeof rec['$ctx'] === 'string') {
      acc.dims.add(rec['$ctx'] as string)
      acc.dims.add(dim) // the pinned dim varies with the referenced value
    }
  }
}

// fromDim/toDim/timeDimension name ctx DIM KEYS whose values bound the time clamp.
function addTimeBinding(acc: Acc, fromDim?: string, toDim?: string, td?: TimeDimensionSpec): void {
  if (fromDim) acc.dims.add(fromDim)
  if (toDim)   acc.dims.add(toDim)
  if (td) {
    if (td.dim) acc.dims.add(td.dim)
    // A [from,to] tuple bound may be a `{ $ctx: key }` ref — sweep it.
    if (Array.isArray(td.range)) for (const b of td.range) {
      if (isObj(b) && typeof (b as Record<string, unknown>)['$ctx'] === 'string') {
        acc.dims.add((b as Record<string, unknown>)['$ctx'] as string)
      }
    }
  }
}

// A `{ $ctx: key }` value resolved dims-first, vars-fallback (resolveEncodingRefs /
// resolvePipeRefs) → record BOTH edges; the graph keeps whichever source exists.
function dualCtx(v: unknown, acc: Acc): void {
  if (isObj(v) && typeof v['$ctx'] === 'string') {
    const key = v['$ctx'] as string
    acc.dims.add(key)
    acc.vars.add(key)
  }
}

// ── scanEncoding — state-bound channels (AR-36 P0) ────────────────────────────
//  A `{ $ctx: key }` channel is lowered by resolveEncodingRefs dims-first,
//  vars-fallback. The real source is either ctx.dims[key] OR vars[key], so both
//  edges are recorded; the graph keeps the one whose source exists (a non-existent
//  edge never fires — safe). Bare-string / ChannelDef channels carry no state dep.
const CHANNELS = ['label', 'value', 'color', 'series'] as const
function scanEncoding(enc: EncodingSpec, acc: Acc): void {
  for (const k of CHANNELS) dualCtx(enc[k] as EncodingChannel | undefined, acc)
}

// ── scanTransforms — pipeline refs + blend cross-store deps ────────────────────
function scanTransforms(steps: readonly TransformStep[], acc: Acc): void {
  for (const step of steps) {
    // Generic $-ref sweep over the whole step (filter.where $ctx → dims,
    // lookup.from/join.with $cl/$d → classifiers) — one pass, no per-op special-casing.
    sweepRefs(step, acc)
    // resolvePipeRefs-governed params (aggregate.by, sort.by/dir) resolve dims-first,
    // vars-fallback — the pipeline sibling of scanEncoding. The real binding is almost
    // always a DERIVED var (_byDims/_sortBy, AR-36), so the vars edge is load-bearing:
    // recording dims alone would MISS it and under-fire. Dual-record (inert dim edge if
    // no such dim exists — safe).
    if (step.op === 'aggregate' && 'by' in step) dualCtx((step as Record<string, unknown>)['by'], acc)
    if (step.op === 'sort') { dualCtx(step.by, acc); dualCtx(step.dir, acc) }
    if (step.op === 'blend') {
      acc.stores.add(step.from.storeKey)
      const m = step.from.query.measure
      for (const ref of Array.isArray(m) ? m : [m]) {
        acc.measures.add(ref)
        const ds = resolveMeasureRef(ref).dataSource
        if (ds) acc.stores.add(ds)
      }
      // blend's secondary query filter $ctx + encoding refs
      scanObsQuery(step.from.query, acc)
      if (step.from.encoding) scanEncoding(step.from.encoding, acc)
    }
  }
}

// ── scanVisibility — VisibilityExpr params + perspective axes ─────────────────
function scanVisibility(expr: VisibilityExpr, acc: Acc): void {
  switch (expr.op) {
    case 'eq': case 'neq': case 'in': case 'isset':
      acc.params.add(expr.param); break
    case 'and': case 'or':
      for (const e of expr.exprs) scanVisibility(e, acc); break
    case 'not':
      scanVisibility(expr.expr, acc); break
    case 'perspective-is': case 'perspective-in': case 'perspective-not':
      // Explicit `param` selects the axis; param-less resolves the conventional axis.
      acc.perspective.add(expr.param ?? PERSPECTIVE_PARAM); break
  }
}

// ── sweepRefs — generic $-ref backbone (data-layer scopes) ────────────────────
//  Recurses any value; records every `$`-ref by scope via the ONE taxonomy
//  (ref/ref.ts R4): ctx→dims, param→params, var→vars, dim($cl/$d)→classifiers.
//  Stops at child nodes (separate renderables). $row is click-time drill-down —
//  out of render-dep scope — so it is recorded to no read-side bucket.
function sweepRefs(value: unknown, acc: Acc): void {
  if (value === null || typeof value !== 'object') return
  if (isChildNode(value)) return
  const scope = refScope(value)
  if (scope) {
    const rec = value as Record<string, unknown>
    switch (scope) {
      case 'ctx':   if (typeof rec['$ctx']   === 'string') acc.dims.add(rec['$ctx'] as string); break
      case 'param': if (typeof rec['$param'] === 'string') acc.params.add(rec['$param'] as string); break
      case 'var':   if (typeof rec['$ref']   === 'string') acc.vars.add(rec['$ref'] as string); break
      case 'dim': {
        const key = (rec['$cl'] ?? rec['$d'])
        if (typeof key === 'string') acc.classifiers.add(key)
        // A `$d` (DISPLAY) join resolves display attributes that carry per-locale
        // LocaleStrings: resolveDisplayRef TAGS every object-valued attr (codelist.ts →
        // tagLocaleString), and the boundary (resolveRowLocales) resolves the tagged
        // cell to the active locale — so the joined row LABELS change with locale. The
        // display view exists to carry localized content, so a `$d` join is a locale
        // dependency. A `$cl` (STRUCTURAL) view never tags (resolveClassifierRef returns
        // raw entries — a code/parent/hierarchy join is locale-independent), so it does
        // NOT mark locale: precise, not broad. Keyed on the ref TOKEN (`$d`), never a
        // dim name (Law 1). This closes the row-label-join under-fire (Finding B).
        if (typeof rec['$d'] === 'string') acc.locale = true
        break
      }
      case 'row': break // click-time, not a render dep
    }
    // A ref object may ALSO carry a narrowing sub-ref (e.g. $ne+$ctx) — keep walking.
  }
  if (Array.isArray(value)) { for (const v of value) sweepRefs(v, acc); return }
  for (const v of Object.values(value)) sweepRefs(v, acc)
}

// ── sweepExprRefs — expr-layer refs inside a VarMap value ─────────────────────
//  A `vars` expression (@statdash/expr) resolves `$ctx` against scope.dims — which
//  evalVarMap binds to FILTER PARAMS, not SectionContext.dims — so `$ctx`→params
//  HERE (the documented scope split, ref/ref.ts header). `$derived`/`$ref`→vars.
//  This is why vars are scanned by a TYPED pass, never the data-layer sweepRefs.
function sweepExprRefs(value: unknown, acc: Acc): void {
  if (value === null || typeof value !== 'object') return
  const rec = value as Record<string, unknown>
  if (typeof rec['$ctx']     === 'string') acc.params.add(rec['$ctx'] as string)
  if (typeof rec['$derived'] === 'string') acc.vars.add(rec['$derived'] as string)
  if (typeof rec['$ref']     === 'string') acc.vars.add(rec['$ref'] as string)
  if (typeof rec['$param']   === 'string') acc.params.add(rec['$param'] as string)
  if (Array.isArray(value)) { for (const v of value) sweepExprRefs(v, acc); return }
  for (const v of Object.values(value)) sweepExprRefs(v, acc)
}

// ── sweepDisplay — locale, template {token} dims, perspective carriers ─────────
//  Walks the node's OWN display fields (everything that is NOT a typed slot, an
//  interaction slot, or a child-node subtree). Detects:
//    • a LocaleString / perspective-carrier display value  → locale = true
//    • a perspective carrier (keys ⊇ a known perspective id) → perspective dep
//    • a `{token}` in a display string / LocaleString arm  → dims (resolveTemplate
//      expands `{key}` against ctx.dims)
//    • any stray data-layer `$`-ref in a display field      → sweepRefs
//  locale detection is intentionally COARSE-BUT-SAFE in V1 (a locale toggle
//  re-localizes broadly today anyway); V2 can refine it to exact label-bearing nodes.
const TOKEN_RE = /\{(\w+)\}/g
function sweepDisplay(node: DepNode, acc: Acc, perspectiveIds?: readonly string[]): void {
  for (const [key, val] of Object.entries(node)) {
    if (TYPED_SLOTS.has(key) || INTERACTION_SLOTS.has(key)) continue
    sweepDisplayValue(val, acc, perspectiveIds)
  }
}

function sweepDisplayValue(val: unknown, acc: Acc, perspectiveIds?: readonly string[]): void {
  if (typeof val === 'string') { addTokens(val, acc); return }
  if (val === null || typeof val !== 'object') return
  if (isChildNode(val)) return                      // separate renderable
  if (Array.isArray(val)) { for (const v of val) sweepDisplayValue(v, acc, perspectiveIds); return }

  const rec = val as Record<string, unknown>
  if (refScope(rec)) { sweepRefs(rec, acc); return } // a $-ref, not a display carrier

  // A perspective carrier: an object keyed by perspective ids. Depends on the
  // perspective axis AND (its arms being LocaleStrings) the locale.
  if (perspectiveIds && perspectiveIds.some((id) => id in rec)) {
    acc.perspective.add(PERSPECTIVE_PARAM)
    acc.locale = true
  }
  // A localized display carrier (LocaleString `{ en, ka, … }`): all-scalar values,
  // no `op`/`$` structural markers — resolving it depends on the active locale.
  if (looksLocalized(rec)) acc.locale = true

  // Recurse (nested display objects — a carrier of LocaleStrings, a badge config, …).
  for (const v of Object.values(rec)) sweepDisplayValue(v, acc, perspectiveIds)
}

function addTokens(s: string, acc: Acc): void {
  for (const m of s.matchAll(TOKEN_RE)) acc.dims.add(m[1]!)
}

/** A LocaleString-shaped bag: a non-empty object whose every value is a scalar and no key is structural. */
function looksLocalized(rec: Record<string, unknown>): boolean {
  const keys = Object.keys(rec)
  if (keys.length === 0) return false
  for (const k of keys) {
    if (k.startsWith('$') || k === 'op' || k === 'type') return false
    const v = rec[k]
    if (v !== null && (typeof v === 'object')) return false // nested → a carrier/config, handled by recursion
  }
  return true
}
