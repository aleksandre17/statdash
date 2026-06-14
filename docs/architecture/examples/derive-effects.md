# derive-effects.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Computed · Derive · Effects: framework-level design
 *
 * Three distinct enrichment mechanisms — different scopes, different moments:
 *
 *   FilterSchemaInput.computed  — ExprVal only.     Scope: filter params.  Time: useFilters().
 *   NodeBase.derive             — ExprVal | Lookup.  Scope: dims + stores.  Time: engine step 1.
 *   FilterSchemaInput.effects   — ExprVal → set.    Scope: filter params.  Time: useFilters().
 *
 * "Request or expression" model — every entry is one of:
 *   ExprVal    — declare how to compute (logic, no external data)
 *   LookupSpec — declare what to fetch + what to extract (request + extract)
 *
 * Both are JSON-serializable. Constructor stores both in DB. Zero functions in config.
 *
 * Topological sort: entries can be declared in any order.
 *   Evaluator detects $derived references → builds dependency graph → Kahn's algorithm.
 *   Cycle → throws at evaluation time (clear error, not silent wrong result).
 *   Independent entries (no shared deps) → evaluated in declaration order
 *   (Suspense parallelizes their data fetches automatically).
 *
 * Platform precedents:
 *   Grafana  — variable chaining (single-pass, explicit dependency, topological resolve)
 *   dbt      — macros (pure expression) vs refs (data request) — strict separation
 *   Observable — reactive cells, auto-dependency, topological evaluation
 *   Retool   — transformer (expression) vs query (request) — always two distinct primitives
 */

import type { ExprVal, DimVal, DataRow, DataSpec } from '@geostat/engine'


// ═══════════════════════════════════════════════════════════════════════════
// Types — FilterSchemaInput.computed
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ComputedEntry — one derived value inside FilterSchemaInput.computed.
 *
 * Rule: expr may ONLY reference:
 *   { $ctx: 'filterKey' }     — any filter param value
 *   { $derived: 'key' }       — any earlier computed entry (auto-ordered)
 *
 * No DataStore access. No DataSpec. Pure logic.
 * Evaluator: evalComputed() inside useFilters().
 * Output namespace: ctx.dims (joins filter params).
 */
export interface ComputedEntry {
  key:   string
  expr:  ExprVal   // pure expression — no DataStore, no $rows
  deps?: string[]  // optional explicit dep hint — auto-detected from expr if absent
}

export type ComputedMap = ComputedEntry[]


// ═══════════════════════════════════════════════════════════════════════════
// Types — NodeBase.derive
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DeriveEntry — one derived value inside NodeBase.derive.
 *
 * Two shapes:
 *   ExprEntry    — pure expression (same ExprVal as computed, but with full ctx scope)
 *   LookupEntry  — data request + field extraction (DataSpec + field accessor)
 *
 * ExprEntry can reference:
 *   { $ctx: 'filterKey' }       — filter params + computed values (ctx.dims)
 *   { $derived: 'key' }         — earlier derive entries (ctx.derived)
 *
 * LookupEntry.lookup.by can reference:
 *   { $ctx: 'key' } / { $derived: 'key' } — same scope as ExprEntry
 *
 * Evaluator: evalDerived() in engine renderNode step 1.
 * Output namespace: ctx.derived (separate from ctx.dims).
 *
 * JSON.parse(JSON.stringify(entry)) === entry ✅ — all shapes are plain JSON.
 */
export type DeriveEntry =
  | ExprDeriveEntry
  | LookupDeriveEntry

export interface ExprDeriveEntry {
  key:   string
  expr:  ExprVal   // full scope: $ctx + $derived
  deps?: string[]
}

export interface LookupDeriveEntry {
  key:    string
  lookup: LookupSpec
  deps?:  string[]
}

/**
 * LookupSpec — request + extract in one JSON object.
 * Replaces DataLookupOp (op: 'map-field' | 'tree-field').
 *
 * Discriminated by `type`:
 *   'map'    — flat lookup: find row where row[idField] === by, return row[field]
 *   'tree'   — hierarchical lookup: find ancestor/descendant matching by, return row[field]
 *   'first'  — return first matching row's field (no ref matching needed)
 *   'reduce' — aggregate over all rows: count / sum / avg / min / max
 */
export type LookupSpec =
  | MapLookup
  | TreeLookup
  | FirstLookup
  | ReduceLookup

export interface MapLookup {
  type:     'map'
  data:     DataSpec   // DataSpec to query
  by:       ExprVal    // value to look up (evaluated against current scope)
  idField?: string     // field in rows to match against (default: 'code')
  field:    string     // field to return from matched row
  fallback?: DimVal    // returned if no matching row found
}

export interface TreeLookup {
  type:     'tree'
  data:     DataSpec
  by:       ExprVal    // current value to locate in tree
  idField?: string     // default: 'code'
  field:    string     // field to return from matched node
  fallback?: DimVal
}

export interface FirstLookup {
  type:     'first'
  data:     DataSpec   // DataSpec (may include dims filter)
  field:    string     // field to return from first row
  fallback?: DimVal    // returned if no rows
}

export interface ReduceLookup {
  type:     'reduce'
  data:     DataSpec
  op:       'count' | 'sum' | 'avg' | 'min' | 'max'
  field?:   string     // required for sum/avg/min/max; omitted for count
  fallback?: DimVal
}

// JSON.parse(JSON.stringify(lookup)) === lookup ✅ for all four shapes


// ═══════════════════════════════════════════════════════════════════════════
// Types — FilterSchemaInput.effects
// ═══════════════════════════════════════════════════════════════════════════

export interface Effect {
  when:  ExprVal                        // condition over current filter state
  set:   Record<string, ExprVal | null> // params to set (null = clear)
  // Note: ExprVal in `set` has scope: { dims: currentFilterParams + computed }
  // Effects run AFTER computed — computed values available in `when` and `set`.
}

// Effect evaluation contract:
//   1. evalComputed(schema.computed, params) → augmented dims (computed joins params)
//   2. applyEffects(schema.effects, augmented) → dims with side effects applied
//   3. Single pass in array order — no cascading re-evaluation
//   4. If Effect B reads a value set by Effect A → place A before B in the array


// ═══════════════════════════════════════════════════════════════════════════
// Dependency graph — shared by computed + derive
// ═══════════════════════════════════════════════════════════════════════════

interface DepNode { key: string; deps: string[]; level: number }
interface DepGraph { order: string[]; hasCycle: boolean; cycleKeys: string[] }

/**
 * buildDependencyGraph — topological sort for both computed and derive entries.
 *
 * Algorithm: Kahn's BFS — O(V + E).
 * Cycle detection: any key remaining in queue after sort has a cycle.
 * Auto-detects deps from ExprVal (scans for { $derived: key }) when deps? absent.
 *
 * Same algorithm used by:
 *   Grafana  — variable.resolveOrder()
 *   dbt      — model dependency graph
 *   Observable — reactive cell evaluation order
 */
export function buildDependencyGraph(
  entries: Array<{ key: string; deps?: string[]; expr?: ExprVal; lookup?: LookupSpec }>
): DepGraph {
  const keys = new Set(entries.map(e => e.key))

  // For each entry: declared deps || auto-detected from expr/lookup.by
  const depMap = new Map<string, string[]>()
  for (const entry of entries) {
    const declared = entry.deps ?? []
    const scanned  = entry.deps
      ? []
      : [
          ...(entry.expr   ? scanDerivedRefs(entry.expr)   : []),
          ...(entry.lookup && 'by' in entry.lookup ? scanDerivedRefs(entry.lookup.by) : []),
        ].filter(d => keys.has(d))
    depMap.set(entry.key, [...new Set([...declared, ...scanned])])
  }

  // Kahn's BFS
  const inDegree = new Map<string, number>()
  const adjList  = new Map<string, string[]>()
  for (const key of keys) { inDegree.set(key, 0); adjList.set(key, []) }

  for (const [key, deps] of depMap) {
    for (const dep of deps) {
      adjList.get(dep)!.push(key)
      inDegree.set(key, (inDegree.get(key) ?? 0) + 1)
    }
  }

  const queue: string[] = []
  for (const [key, deg] of inDegree) { if (deg === 0) queue.push(key) }

  const order: string[] = []
  while (queue.length > 0) {
    const key = queue.shift()!
    order.push(key)
    for (const neighbour of adjList.get(key) ?? []) {
      const newDeg = inDegree.get(neighbour)! - 1
      inDegree.set(neighbour, newDeg)
      if (newDeg === 0) queue.push(neighbour)
    }
  }

  const remaining  = [...keys].filter(k => !order.includes(k))
  return { order, hasCycle: remaining.length > 0, cycleKeys: remaining }
}

/** Scan ExprVal tree for { $derived: 'key' } references. */
function scanDerivedRefs(expr: ExprVal): string[] {
  if (expr == null || typeof expr !== 'object') return []
  if ('$derived' in (expr as object)) return [(expr as { $derived: string }).$derived]
  return Object.values(expr as object).flatMap(v =>
    Array.isArray(v) ? v.flatMap(scanDerivedRefs) : scanDerivedRefs(v as ExprVal)
  )
}

/** Scan ExprVal tree for { $ctx: 'key' } references. Used by resolveDefaults topological sort. */
export function scanCtxRefs(expr: ExprVal): string[] {
  if (expr == null || typeof expr !== 'object') return []
  if ('$ctx' in (expr as object)) return [(expr as { $ctx: string }).$ctx]
  return Object.values(expr as object).flatMap(v =>
    Array.isArray(v) ? v.flatMap(scanCtxRefs) : scanCtxRefs(v as ExprVal)
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Evaluators
// ═══════════════════════════════════════════════════════════════════════════

/**
 * evalComputed — evaluate FilterSchemaInput.computed inside useFilters().
 *
 * Input:  filter params (from URL + defaults)
 * Output: computed values (merged into ctx.dims alongside filter params)
 *
 * Scope available to each expr:
 *   { $ctx: 'key' }     — any filter param value
 *   { $derived: 'key' } — any earlier computed entry (in topological order)
 *
 * No DataStore access. Pure, synchronous, testable without React.
 */
export function evalComputed(
  entries: ComputedMap,
  filterParams: Record<string, DimVal>,
): Record<string, DimVal> {
  if (!entries.length) return {}

  const graph = buildDependencyGraph(entries)
  if (graph.hasCycle) {
    throw new Error(`[computed] Circular dependency: ${graph.cycleKeys.join(' → ')}`)
  }

  const computed: Record<string, DimVal> = {}
  const entryMap = new Map(entries.map(e => [e.key, e]))

  for (const key of graph.order) {
    const entry = entryMap.get(key)!
    const scope = { dims: { ...filterParams, ...computed }, derived: computed }
    computed[key] = evalExpr(entry.expr, scope)
  }

  return computed  // caller merges with filterParams → ctx.dims
}


/**
 * evalDerived — evaluate NodeBase.derive in engine renderNode step 1.
 *
 * Input:  full RenderContext (ctx.dims contains filter params + computed)
 * Output: derived values → merged into ctx.derived for this node + all children
 *
 * Entry evaluation:
 *   ExprDeriveEntry  → evalExpr(expr, scope)  — pure, sync
 *   LookupDeriveEntry → interpretSpec(lookup.data, ctx) + resolveLookup  — may throw Promise (Suspense)
 *
 * Independent entries (no shared deps) fire interpretSpec in declaration order.
 * React Suspense deduplicates concurrent requests to the same DataSpec + dims.
 */
export function evalDerived(
  entries: DeriveEntry[],
  ctx: import('@geostat/react').RenderContext,
): Record<string, DimVal> {
  if (!entries.length) return {}

  const graph = buildDependencyGraph(entries)
  if (graph.hasCycle) {
    throw new Error(`[derive] Circular dependency: ${graph.cycleKeys.join(' → ')}`)
  }

  const derived:  Record<string, DimVal> = { ...ctx.derived }
  const entryMap = new Map(entries.map(e => [e.key, e]))

  for (const key of graph.order) {
    const entry = entryMap.get(key)!
    const scope = { dims: ctx.dims, derived }

    if ('expr' in entry) {
      derived[key] = evalExpr(entry.expr, scope)
    } else {
      // LookupDeriveEntry — interpretSpec may throw Promise (Suspense handles it)
      const rows = interpretSpec(entry.lookup.data, ctx.sectionCtx, ctx.stores)
      derived[key] = resolveLookup(entry.lookup, rows, scope)
    }
  }

  return derived
}

/** Resolve a LookupSpec against resolved rows + current scope. */
function resolveLookup(
  spec:  LookupSpec,
  rows:  DataRow[],
  scope: { dims: Record<string, DimVal>; derived: Record<string, DimVal> },
): DimVal {
  switch (spec.type) {
    case 'map':
    case 'tree': {
      const idField = spec.idField ?? 'code'
      const key     = evalExpr(spec.by, scope)
      const row     = rows.find(r => r[idField] === key)
      return row ? (row[spec.field] as DimVal ?? spec.fallback ?? null)
                 : (spec.fallback ?? null)
    }
    case 'first': {
      const row = rows[0]
      return row ? (row[spec.field] as DimVal ?? spec.fallback ?? null)
                 : (spec.fallback ?? null)
    }
    case 'reduce': {
      if (!rows.length) return spec.fallback ?? null
      switch (spec.op) {
        case 'count': return rows.length
        case 'sum':   return rows.reduce((s, r) => s + Number(r[spec.field!] ?? 0), 0)
        case 'avg':   return rows.reduce((s, r) => s + Number(r[spec.field!] ?? 0), 0) / rows.length
        case 'min':   return Math.min(...rows.map(r => Number(r[spec.field!])))
        case 'max':   return Math.max(...rows.map(r => Number(r[spec.field!])))
      }
    }
  }
}

/**
 * applyEffects — single-pass cross-filter side effect evaluation.
 *
 * Called after evalComputed. scope includes computed values.
 * Single pass, array order. No cascading re-evaluation.
 * Grafana variable chaining: same single-pass design decision.
 */
export function applyEffects(
  effects: Effect[],
  dims:    Record<string, DimVal>,
): Record<string, DimVal> {
  if (!effects.length) return dims

  const result = { ...dims }
  const scope  = { dims: result, derived: {} }

  for (const effect of effects) {
    if (!evalExpr(effect.when, scope)) continue
    for (const [key, val] of Object.entries(effect.set)) {
      result[key] = val === null ? null : evalExpr(val, scope)
    }
  }

  return result
}


// ═══════════════════════════════════════════════════════════════════════════
// Usage Example A — regional page (full scenario)
// ═══════════════════════════════════════════════════════════════════════════

const GEO_QUERY: DataSpec = { type: 'query', storeId: 'geo', indicator: 'GEO_LIST' }
declare const REG_FIRST: number, REG_LAST: number

// ── FilterSchemaInput.computed — filter-level, ExprVal only ─────────────
// These values derive FROM filter params, used to drive filter UI (showWhen, etc.).
// All ExprVal — no DataStore, no lookup.
// Auto-topological: entries can be in any order; evaluator sorts.

const regionalComputed: ComputedMap = [
  // Drives filter bar showWhen ('range-bar' visible when mode=range):
  {
    key:  'isRangeMode',
    expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' },
  },
  // Single vs multi selection — drives section layout:
  {
    key:  '_geoMode',
    expr: { op: 'contains', source: { $ctx: 'region' }, sub: ',', match: 'multi', fallback: 'single' },
  },
  // Subtitle string — references two computed values above (auto-ordered):
  {
    key:  'activeLabel',
    expr: {
      op:   'if',
      cond: { $derived: 'isRangeMode' },
      then: { op: 'template', tmpl: '{fromYear}–{toYear}' },
      else: { op: 'template', tmpl: '{year}' },
    },
  },
]

// ── FilterSchemaInput.effects — cross-filter reactive rules ─────────────
// When mode changes → clear incompatible params. Single pass. Array order.
// 'when' can reference computed values (evaluated after computed step).

const regionalEffects: Effect[] = [
  {
    // mode → range: clear point-in-time params
    when: { $derived: 'isRangeMode' },
    set:  { year: null, sector: '_T' },
  },
  {
    // mode → year/compare: clear range params
    when: { op: 'not', expr: { $derived: 'isRangeMode' } },
    set:  { fromYear: null, toYear: null },
  },
]

// ── InnerPageNode.derive — render-level, ExprVal + Lookup ───────────────
// These values derive from dims + DataStore.
// Available to ALL children (filter bar, sections, chrome) via ctx.derived.
// Entries declared in any order — topological sort handles evaluation.

const regionalDerive: DeriveEntry[] = [
  // Look up full geo record for selected region(s):
  {
    key:    'regionObj',
    lookup: { type: 'map', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: '*', fallback: null },
  },

  // Page accent color — from regionObj's color field:
  {
    key:    '_pageColor',
    lookup: { type: 'map', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: 'color', fallback: '#0080BE' },
  },

  // Breadcrumb path — from hierarchical geo tree:
  {
    key:    '_pageCrumbs',
    lookup: { type: 'tree', data: GEO_QUERY, by: { $ctx: 'region' }, idField: 'code', field: 'crumbs', fallback: [] },
  },

  // Display title for selected region — derived from regionObj (ExprEntry, depends on lookup):
  {
    key:  '_regionTitle',
    expr: { op: 'get', source: { $derived: 'regionObj' }, field: 'label', fallback: '' },
    // deps auto-detected: ['regionObj'] — evaluator places this after regionObj lookup
  },

  // Year count in selected range — aggregate:
  {
    key:    '_rangeYearCount',
    lookup: {
      type: 'reduce', op: 'count',
      data: { type: 'query', storeId: 'time', indicator: 'TIME_LIST',
              dims: { fromYear: { $ctx: 'fromYear' }, toYear: { $ctx: 'toYear' } } },
      fallback: 0,
    },
  },
]

// Evaluation order (topological):
//   regionObj, _pageColor, _pageCrumbs, _rangeYearCount — no deps on each other → any order (parallel data fetches)
//   _regionTitle — depends on regionObj → evaluated after regionObj ✅


// ═══════════════════════════════════════════════════════════════════════════
// Usage Example B — GDP page (simpler scenario)
// ═══════════════════════════════════════════════════════════════════════════

const gdpComputed: ComputedMap = [
  {
    key:  'isYearMode',
    expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },
  },
  {
    key:  'periodLabel',
    // References isYearMode — auto-topological, order doesn't matter here:
    expr: {
      op:   'if',
      cond: { $derived: 'isYearMode' },
      then: { op: 'template', tmpl: '{time} · SNA 2008' },
      else: { op: 'template', tmpl: '{fromYear}–{toYear}' },
    },
  },
]

// GDP page InnerPageNode.derive — just one lookup:
const gdpDerive: DeriveEntry[] = [
  {
    key:    'totalGDP',
    lookup: {
      type: 'first',
      data: { type: 'query', storeId: 'gdp', indicator: 'B1G',
              dims: { time: { $ctx: 'time' }, geo: { $ctx: 'geo' } } },
      field:    'value',
      fallback: null,
    },
  },
]

// totalGDP → ctx.derived['totalGDP'] → used in KPI strip subtitle or section derive


// ═══════════════════════════════════════════════════════════════════════════
// Cycle detection — what happens when there's a circular dep
// ═══════════════════════════════════════════════════════════════════════════

const cycleExample: ComputedMap = [
  { key: 'a', expr: { op: 'not', expr: { $derived: 'b' } } },  // a depends on b
  { key: 'b', expr: { op: 'not', expr: { $derived: 'a' } } },  // b depends on a → cycle!
]
// buildDependencyGraph(cycleExample) → { hasCycle: true, cycleKeys: ['a', 'b'] }
// evalComputed throws: "[computed] Circular dependency: a → b"
// Caught at page render time, shows NodeErrorBoundary with clear message.


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ DataStore access in computed (wrong scope — no DataStore at filter time):
// { key: 'regionObj', lookup: { type: 'map', data: GEO_QUERY, ... } }  ← in computed
// ✅ DataStore access → always in derive (engine-level)

// ❌ Manual array ordering as dependency management:
// [isYearMode, periodLabel]  // works by accident
// ✅ Declare in any order — buildDependencyGraph() sorts correctly

// ❌ Expr in derive referencing $derived key that comes from lookup, wrong order:
// derive: [{ key: 'title', expr: { op: 'get', source: { $derived: 'regionObj' }, field: 'label' } },
//          { key: 'regionObj', lookup: { type: 'map', ... } }]
// ✅ Correct — evaluator detects title depends on regionObj → evaluates regionObj first

// ❌ Using effects for validation:
// { when: { op: 'gt', left: { $ctx: 'fromYear' }, right: { $ctx: 'toYear' } },
//   set:  { toYear: { $ctx: 'fromYear' } } }  ← silently "fixes" invalid state
// ✅ effects = reactive reset. validation = crossValidate[]. both needed, both different.

// ❌ effect.set referencing ctx.derived (not available — effects run at filter time):
// { when: ..., set: { label: { $derived: '_pageColor' } } }  ← _pageColor is render-time
// ✅ effects.set scope = filter params + computed values only (ctx.dims)

// Declare for type checking in example:
declare function evalExpr(expr: ExprVal, scope: { dims: Record<string, DimVal>; derived: Record<string, DimVal> }): DimVal
declare function interpretSpec(spec: DataSpec, ctx: unknown, stores: unknown): DataRow[]
```
