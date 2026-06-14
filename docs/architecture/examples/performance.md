# performance.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Performance — five-layer model
 *
 * Problem: collection ops + expensive computations (interpretChart, row transforms) run
 * on every React render. At 10k rows × many nodes this accumulates into a slow page.
 *
 * Five independent layers — each eliminates a different cost:
 *
 *   Layer 1 — Render gate        (SiteRenderer useMemo)
 *     engine.renderNode re-runs only when dims or rows actually change.
 *     Cost without: O(nodes × rows) on every React re-render.
 *     Cost with:    O(nodes × rows) only on filter change.
 *
 *   Layer 2 — Allocation gate    (evalExpr innerScope mutation)
 *     10k DataRow iterations = 1 object allocation, not 10k.
 *
 *   Layer 3 — Stability chain    (ctx reference stability)
 *     Makes Layer 1 effective — same URL → same dims object → same ctx reference.
 *
 *   Layer 4 — Computation gate   (renderer inner component + useMemo)
 *     Per-node: expensive computation (interpretChart, formatRows) re-runs only when
 *     ctx.rows changes. ctx.rows stable (store cache hit) → output stable.
 *     Pattern: inner component (for hooks) + useMemo inside. NO outer React.memo.
 *     Why no outer React.memo: ctx is a new spread object per node → memo always misses.
 *     Custom comparator avoids this but risks stale renders (missed ctx field = silent bug).
 *     Solution: useMemo inside (stable output) + React.memo on Shell (Layer 5).
 *
 *   Layer 5 — Shell gate         (Shell React.memo in src/)
 *     Shell re-renders only when its ISP-clean props change.
 *     def:    module-level constant → always stable.
 *     output: stable when Layer 4 useMemo hits (ctx.rows unchanged).
 *     React.memo default shallow eq sufficient — no custom comparator.
 *
 * Platform references:
 *   Grafana: PanelRenderer — React.memo on panel component; data reference stable on cache hit.
 *            interpretChart equivalent: panel transform memoized by (data, options) references.
 *   Builder.io: each block component is React.memo; receives only its own props (ISP).
 *   Layer 6 (full stability cascade) NOT implemented:
 *     Would require React.memo + custom comparator on inner components → stale render risk.
 *     SectionShell re-renders its wrapper (cheap); child shells skip via Layer 5 (correct).
 */

import React, { useMemo }  from 'react'
import type {
  RenderContext, PageConfig, FilterSchemaInput,
  DimContract, ChartNode, ChartShellProps, SectionShellProps,
} from '@geostat/react'
import type { ExprScope, ExprVal, ListRef } from '@geostat/expr'
import type { DataRow, ChartOutput }        from '@geostat/engine'
import {
  engine, defineFilters, useTheme, useStores, useFilters, interpretChart,
} from '@geostat/react'
import type { ReactNode } from 'react'


// ═══════════════════════════════════════════════════════════════════════════
// Layer 1 + Layer 3 — SiteRenderer with useMemo + stable ctx
// ═══════════════════════════════════════════════════════════════════════════

export function SiteRenderer({ page }: { page: PageConfig }): ReactNode {
  const theme  = useTheme()    // stable: ThemeProvider creates ThemeConfig once
  const stores = useStores()   // stable: SiteProvider creates stores map once at setup

  // defineFilters: memoized by page.id — re-runs only when navigating to a new page
  const schema = useMemo(
    () => defineFilters(page.filterSchema ?? { bars: {} }),
    [page.id],
  )

  // useFilters: internally memoizes dims by URL string
  // same URL params → same dims object reference (Layer 3)
  const filters = useFilters(schema)

  // baseCtx: stable reference when theme + stores + dims unchanged (Layer 3)
  // rows/derived/view start empty — renderNode fills them per-node via spread-copy.
  //
  // scope starts as { dims, derived: {}, rows: [] } — the ROOT node's base.
  // renderNode syncs scope at each evaluation step per node:
  //   step a: ctx = { ...ctx, derived, scope: { ...scope, derived } }
  //   step c: ctx = { ...ctx, rows,    scope: { ...scope, rows    } }
  // Each node in the tree receives a fully populated scope.rows before
  // evalViewParams (step d) and the renderer (step f) run.
  // Do NOT keep a stale scope reference — always sync alongside the field it mirrors.
  const baseCtx = useMemo((): RenderContext => ({
    theme,
    stores,
    dims:         filters.ctx.dims,   // ← stable reference (see useFilters below)
    derived:      {},
    rows:         [],
    view:         {},
    scope:        { dims: filters.ctx.dims, derived: {}, rows: [] },
    pageStoreKey: page.storeKey,
    dimContracts: buildDimContracts(schema),
  }), [theme, stores, filters.ctx.dims, page.id, page.storeKey])

  // Render gate (Layer 1):
  // engine.renderNode is a pure function — same inputs → same ReactNode tree.
  // useMemo skips it entirely when baseCtx reference is unchanged.
  // With Layer 3: baseCtx only changes when user changes a filter or store updates.
  // Unrelated React re-renders (parent state, context unrelated to page) → 0 cost.
  return useMemo(
    () => engine.renderNode(page, baseCtx),
    [page, baseCtx],
  )
}

function buildDimContracts(schema: FilterSchemaInput): Record<string, DimContract> {
  return schema.contracts ?? {}
}


// ═══════════════════════════════════════════════════════════════════════════
// Layer 3 — useFilters: dims reference stability
// ═══════════════════════════════════════════════════════════════════════════
//
// engine/react/src/filters/useFilters.ts — implementation contract
//
// dims must be a stable reference when URL params haven't changed.
// Without this: baseCtx is a new object every render → useMemo in SiteRenderer misses every time.
//
// The URL string is a stable primitive key for useMemo.
// Same URL → same parsed dims object → same baseCtx → useMemo cache hit → zero re-render cost.

function useFilters_stabilityPattern(schema: FilterSchemaInput) {
  // useSearchParams() returns a URLSearchParams whose toString() is stable per navigation.
  // useMemo keyed by the string value — parse only when URL actually changes.
  //
  // const [searchParams] = useSearchParams()
  // const urlKey = searchParams.toString()
  //
  // const dims = useMemo(
  //   () => parseDimsFromUrl(schema, searchParams),
  //   [schema, urlKey],   // ← urlKey: same URL → same string → useMemo hits → same dims reference
  // )
  //
  // return { ctx: { dims, timeMode: ... }, ... }
}


// ═══════════════════════════════════════════════════════════════════════════
// Layer 2 — evalExpr collection ops: single mutable innerScope
// ═══════════════════════════════════════════════════════════════════════════
//
// engine/expr/src/collection.ts — implementation pattern
//
// evalExpr contract: reads scope fields at call time. Does NOT cache scope reference.
// ExprScope.row is intentionally mutable — this contract enables the optimization below.

function evalCollectionOp(
  node:    { op: string; list: ListRef; expr?: ExprVal },
  scope:   ExprScope,
  evalFn:  (expr: ExprVal, scope: ExprScope) => unknown,
): unknown {
  const rows = scope.rows ?? []

  // ❌ Naive — N object allocations for N rows:
  // return rows.some(row => evalFn(node.expr!, { ...scope, row }))
  //                                              ↑ new object per row

  // ✅ Single mutable innerScope — 1 object allocation per collection op call:
  // evalExpr reads scope.row once per call and does not cache the scope reference.
  // Mutating innerScope.row between iterations is safe by contract.
  const inner: ExprScope = { ...scope, row: undefined }

  switch (node.op) {
    case 'count':
      // count: no expr — counts all rows unconditionally
      return rows.length

    case 'some':
      // Short-circuits on first true — best case O(1) iterations
      return rows.some(row => {
        inner.row = row
        return evalFn(node.expr!, inner) as boolean
      })

    case 'every':
      // Short-circuits on first false — best case O(1) iterations
      return rows.every(row => {
        inner.row = row
        return evalFn(node.expr!, inner) as boolean
      })

    case 'filter':
      // Full pass — always O(n) iterations (no short-circuit possible)
      return rows.filter(row => {
        inner.row = row
        return evalFn(node.expr!, inner) as boolean
      })

    case 'map':
      // Full pass — always O(n) iterations
      return rows.map(row => {
        inner.row = row
        return evalFn(node.expr!, inner)
      })

    default:
      return null
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Layer 4 — Computation gate: renderer inner component + useMemo
// ═══════════════════════════════════════════════════════════════════════════
//
// engine/react/src/engine/renderers/ChartRenderer.tsx — implementation pattern
//
// NodeRenderer is a plain function — no hooks directly (renderer hooks rule).
// Inner component enables useMemo for expensive computations.
// NO outer React.memo on inner component — ctx is a new spread object per node,
// so default shallow eq always misses. Custom comparator risks stale renders.
// The memo boundary lives on the Shell (Layer 5), not the inner component.

// ❌ Without Layer 4 — interpretChart runs every render even when rows unchanged:
// function ChartRenderer(def: ChartNode, ctx: RenderContext): ReactNode {
//   const output = interpretChart(def.def, ctx.rows)   // ← new object every render
//   return <Shell def={def} output={output} />          // Shell memo always misses (new output)
// }

// ✅ With Layer 4 — output stable when ctx.rows unchanged (store cache hit):
function ChartRenderer(def: ChartNode, ctx: RenderContext): ReactNode {
  return <ChartRendererInner def={def} ctx={ctx} />
}

// Inner component: NOT React.memo — see header for why.
// useMemo key: [def.def, ctx.rows]
//   def.def   = module-level ChartDef constant → always same reference ✅
//   ctx.rows  = store cache hit → same array reference ✅
//   → output: same reference on cache hit → Shell React.memo hits (Layer 5) ✅
function ChartRendererInner({ def, ctx }: { def: ChartNode; ctx: RenderContext }): ReactNode {
  const output = useMemo(
    () => interpretChart(def.def, ctx.rows),
    [def.def, ctx.rows],
  )
  const Shell = ctx.theme.shells['chart']
  return <Shell def={def} output={output} />
}

// Same pattern for every renderer with expensive per-render computation:
//   TableRenderer:    useMemo(() => sortAndFormat(ctx.rows), [def, ctx.rows])
//   KpiStripRenderer: useMemo(() => aggregateKpis(ctx.rows), [def, ctx.rows])
//   SectionRenderer:  useMemo(() => evalViewParams(def.view, ctx.scope), [def.view, ctx.scope])
// FilterBarRenderer: no expensive computation — no inner component needed.


// ═══════════════════════════════════════════════════════════════════════════
// Layer 5 — Shell gate: React.memo on shell components (src/)
// ═══════════════════════════════════════════════════════════════════════════
//
// src/components/theme/ — implementation pattern
//
// Shells live in src/ — React components, React.memo is straightforward.
// ISP-clean props (ChartShellProps = { def, output }) make default shallow eq work:
//   def:    module-level constant → always stable ✅
//   output: stable when Layer 4 useMemo hits ✅
//   → React.memo hits → shell body does NOT execute → no ReactApexChart re-render ✅
//
// No custom comparator needed — ISP ensures minimal, stable props.
// Custom comparators (for shells with ChildrenArg) risk silent stale renders → avoid.

// ✅ GeostatChartShell — React.memo, default shallow eq:
export const GeostatChartShell = React.memo(function GeostatChartShell({
  def, output,
}: ChartShellProps): ReactNode {
  // toApexOptions: also memoized — output stable → apexOpts stable
  const apexOpts = useMemo(() => toApexOptions(output), [output])
  // ReactApexChart only re-renders when apexOpts reference changes
  // With Layer 4: output stable → apexOpts stable → ReactApexChart skips update ✅
  return null // <ReactApexChart options={apexOpts} series={apexOpts.series} />
})

// declare to satisfy type check in example (actual impl in src/shared/chart/):
declare function toApexOptions(output: ChartOutput): Record<string, unknown>

// ✅ GeostatSectionShell — React.memo, default shallow eq:
// children: ChildrenArg — new object each render BUT:
//   children.defs[]     = module-level NodeDef constants → always same references
//   children.rendered[] = ReactNode[] — new element objects each render (no L-6)
// → SectionShell re-renders its wrapper code (cheap) but child shells skip via Layer 5.
// This is acceptable — wrapper re-render = O(1) JS, no DOM update unless content changed.
export const GeostatSectionShell = React.memo(function GeostatSectionShell({
  def, children, view,
}: SectionShellProps): ReactNode {
  // Shell renders layout/tabs — children.rendered[i] passed directly to React
  // React reconciler diffs efficiently — only actual DOM changes applied
  return null // <div className="section">...</div>
})

// Why NOT custom comparator on GeostatSectionShell:
//   (prev, next) => prev.children.rendered.every((r, i) => r === next.children.rendered[i])
//   rendered[i] is a new element each ChartRendererInner render (no outer React.memo on inner).
//   → comparator always returns false → same as no memo. Wasted complexity.
//   → If we added React.memo to inner components: custom comparator on ctx needed → stale risk.
//   SectionShell re-render is cheap (O(1) wrapper). Accept it. Protect the expensive parts (L-4+L-5).


// ═══════════════════════════════════════════════════════════════════════════
// Performance profile — five layers combined
// ═══════════════════════════════════════════════════════════════════════════
//
// Scenario: 15 nodes, 2 collection ops each, 1500 rows = 45k evals/renderNode, 5 chart nodes.
// "evals"   = predicate/mapper invocations inside collection ops
// "allocs"  = object allocations per collection-op call (scope spread)
// "calls"   = interpretChart() invocations
// "shells"  = chart shell React component body executions
//
// ── Unrelated React re-render (parent state, unrelated context) ─────────────
//   no fixes:    45k evals, 30 allocs/row, 5 calls, 5 shells
//   +L1+L3:      0 evals  (baseCtx unchanged → useMemo hits → renderNode skipped)
//   +L2,L4,L5:   no additional gain (L1 already eliminates all work)
//
// ── Filter change, store cache miss (rows actually differ) ──────────────────
//   no fixes:    45k evals, 1500 allocs/call, 5 calls, 5 shells
//   +L1+L3:      same          (filter change → ctx changes → L1 useMemo misses)
//   +L2:         45k evals, 1 alloc/call, 5 calls, 5 shells
//   +L4:         same          (rows changed → useMemo[ctx.rows] misses → calls run)
//   +L5:         same          (output changed → React.memo misses → shells run)
//
// ── Filter change, store cache hit (dim changed, same query result) ─────────
//   no fixes:    45k evals, 1500 allocs/call, 5 calls, 5 shells
//   +L1+L3:      same          (dim changed → ctx changed → L1 misses; rows = same ref)
//   +L2:         45k evals, 1 alloc/call, 5 calls, 5 shells
//   +L4:         45k evals, 1 alloc/call, 0 calls  (ctx.rows stable → useMemo hits)
//   +L5:         45k evals, 1 alloc/call, 0 calls, 0 shells (output stable → React.memo hits)
//
// Layer 1 is the biggest win: unrelated re-renders are O(0) instead of O(nodes × rows).
// Layer 3 is what makes Layer 1 work at all (stable ctx reference).
// Layer 2 cuts allocations 1500× on any renderNode run where rows change.
// Layer 4+5 eliminate expensive computation and DOM work on store cache hits.
//
// Geostat realistic ceiling: 45k evals per filter change.
// V8 ~50M simple ops/sec → ~1ms per change. Acceptable.
// 10k rows (rare): ~6ms evals alone without L4; ~0ms DOM work with L4+L5 on cache hit.


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// ❌ WeakMap memo keyed by (rows, expr):
//    evalExpr result depends on scope.dims too ($ctx refs in expr body).
//    rows unchanged + dims changed → stale cached result returned. Correctness bug.
//
// ❌ Pre-computed row summaries (Grafana PanelDataSummary pattern):
//    Requires static analysis of which predicates are used in config.
//    Too complex for current stage. Add if profiling shows > 5ms per filter change.
//
// ❌ Engine-level per-node ReactNode caching (useMemo per node inside renderNode):
//    The engine knows nothing about render cost — caching at this level couples engine to React.
//    The right place is inside renderer inner components (L-4): renderers know their expensive steps.
//    L-5 Shell React.memo IS per-component and correct — shells live in src/, React is expected there.
//
// ❌ React.memo with custom comparator on inner components (L-6):
//    Requires enumerating which ctx fields affect render output (e.g., only ctx.rows and ctx.dims).
//    Missing one field → stale render output (silent correctness bug — Rule 2 violation).
//    L-5 shells avoid this: ISP-clean props (def, output) mean default shallow eq is sufficient.
//    If shell props are unstable, fix the source (L-4 useMemo) rather than patching the comparator.
//
// ❌ Moving collection ops to DeriveMap + DataLookupOp to "avoid render cost":
//    evalNodeDerive also runs per-render inside renderNode. Same cost. No benefit.
//    Use collection ops where semantically correct; rely on L-1 for render gate.


// ═══════════════════════════════════════════════════════════════════════════
// Verifying Layer 3 is working — diagnostic pattern
// ═══════════════════════════════════════════════════════════════════════════
//
// In development, instrument SiteRenderer to count renderNode calls:
//
//   let renderCount = 0
//
//   return useMemo(() => {
//     if (process.env.NODE_ENV !== 'production') {
//       renderCount++
//       console.debug(`[SiteRenderer] renderNode call #${renderCount} for page "${page.id}"`)
//       // Expect: 1 call per filter change. Not 1 call per parent re-render.
//       // If count increments on unrelated interactions → ctx is not stable → fix Layer 3.
//     }
//     return engine.renderNode(page, baseCtx)
//   }, [page, baseCtx])
```
