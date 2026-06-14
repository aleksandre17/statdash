# phase2.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Mode System — Phase 2: Full Isolation
 *
 * Removes all three Phase 1 coupling points:
 *   1. FilterContext.state no longer contains mode key
 *   2. interpretSpec(spec, ctx, store, mode?) — mode is own param, not in SectionContext
 *   3. evalVisibility — split into focused leaf evaluators, composed by tree walker
 *
 * See phase2.md for architecture decisions and Strangler Fig migration steps.
 *
 * Files changed vs Phase 1:
 *   engine/core/src/mode/evaluator.ts      ← NEW
 *   engine/core/src/config/section.ts      ← VisibilityExpr + evaluators
 *   engine/core/src/core/context.ts        ← SectionContext (timeMode removed)
 *   engine/core/src/data/spec.ts           ← interpretSpec signature
 *   engine/react/src/context/FilterContext   ← excludeKeys support
 *   engine/react/src/context/ModeContext     ← direct URL (not via FilterContext)
 *   engine/react/src/engine/types.ts         ← RenderContext cleanup
 *   engine/react/src/engine/SiteRenderer     ← bridge removed
 */

import {
  createContext, useContext, useMemo, useCallback,
  type ReactNode,
}                                from 'react'
import { useSearchParams }       from 'react-router-dom'
import type { DataRow, DataStore } from '@geostat/engine'


// ═══════════════════════════════════════════════════════════════════════════
// 1. engine/core/src/mode/types.ts  (unchanged from Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

export type ModeId = string

export interface ModeDef {
  id:       ModeId
  label:    string
  icon?:    string
  dataKey?: string
}

export interface ModeContext {
  current:   ModeId
  available: ModeDef[]
  set:       (id: ModeId) => void
}


// ═══════════════════════════════════════════════════════════════════════════
// 2. engine/core/src/config/section.ts — VisibilityExpr Phase 2
//
//    ISP: three separate concerns, each with its own type + evaluator.
//    Tree operators (and/or/not) compose them — no concern bleeds into another.
// ═══════════════════════════════════════════════════════════════════════════

import type { DimVal } from '@geostat/engine'

// ── FilterCondition — operates on filterParams only ───────────────────────
//
//  Knows nothing about mode. Pure filter state evaluation.
//  Evaluator: evalFilterCondition(expr, filterParams)

export type FilterCondition =
  | { op: 'eq';    param: string; is:     DimVal | null }
  | { op: 'neq';   param: string; is:     DimVal | null }
  | { op: 'in';    param: string; values: DimVal[]      }
  | { op: 'isset'; param: string                        }


// ── ModeCondition — operates on current ModeId only ─────────────────────
//
//  Knows nothing about filterParams. Pure mode evaluation.
//  Evaluator: evalModeCondition(expr, mode)

export type ModeCondition =
  | { op: 'mode-is';  mode:  ModeId   }
  | { op: 'mode-in';  modes: ModeId[] }
  | { op: 'mode-not'; mode:  ModeId   }


// ── TreeOp — composition layer — composes FilterCondition + ModeCondition ─
//
//  No own evaluation logic. Delegates to leaf evaluators.
//  JSON tree: Constructor generates any boolean combination without code.

export type TreeOp =
  | { op: 'and'; exprs: VisibilityExpr[] }
  | { op: 'or';  exprs: VisibilityExpr[] }
  | { op: 'not'; expr:  VisibilityExpr  }


// ── VisibilityExpr — unified discriminated union ──────────────────────────
//
//  JSON-serializable. Constructor generates any combination.
//  evalVisibility dispatches to the correct leaf evaluator.

export type VisibilityExpr =
  | FilterCondition
  | ModeCondition
  | TreeOp


// ── VisibilityCtx — unified evaluation context ────────────────────────────
//
//  Single object passed to evalVisibility — avoids growing param list.
//  evalFilterCondition reads filterParams only.
//  evalModeCondition reads mode only.
//  Neither reads the other field.

export interface VisibilityCtx {
  filterParams: Record<string, unknown>
  mode:         ModeId
}


// ── evalFilterCondition — pure, focused ───────────────────────────────────
//
//  No mode knowledge. Returns boolean from filterParams only.
//  Testable in complete isolation from mode system.

export function evalFilterCondition(
  expr: FilterCondition,
  fp:   Record<string, unknown>,
): boolean {
  const val = fp[expr.param] ?? null
  switch (expr.op) {
    case 'eq':    return val == expr.is
    case 'neq':   return val != expr.is
    case 'in':    return expr.values.includes(val as DimVal)
    case 'isset': return val !== null && val !== '' && val !== undefined
  }
}


// ── evalModeCondition — pure, focused ────────────────────────────────────
//
//  No filterParams knowledge. Returns boolean from ModeId only.
//  Testable in complete isolation from filter system.
//
//  engine/core/src/mode/evaluator.ts

export function evalModeCondition(
  expr: ModeCondition,
  mode: ModeId,
): boolean {
  switch (expr.op) {
    case 'mode-is':  return mode === expr.mode
    case 'mode-in':  return expr.modes.includes(mode)
    case 'mode-not': return mode !== expr.mode
  }
}


// ── evalVisibility — tree walker, pure composition ────────────────────────
//
//  Single entry point. Dispatches to leaf evaluators by op type.
//  Never implements leaf logic itself — delegates entirely.
//  New leaf type: add variant to VisibilityExpr + new leaf evaluator.
//  evalVisibility: zero change needed. Open for extension, closed for modification.
//
//  Grafana equivalent: ThresholdMapper.evaluate — dispatches to type-specific
//  evaluators, never mixes their logic.

export function evalVisibility(
  expr: VisibilityExpr,
  ctx:  VisibilityCtx,
): boolean {
  switch (expr.op) {
    // ── tree operators ────────────────────────────────────────────────────
    case 'and':      return expr.exprs.every(e  => evalVisibility(e, ctx))
    case 'or':       return expr.exprs.some(e   => evalVisibility(e, ctx))
    case 'not':      return !evalVisibility(expr.expr, ctx)

    // ── mode leaf ─────────────────────────────────────────────────────────
    case 'mode-is':
    case 'mode-in':
    case 'mode-not': return evalModeCondition(expr, ctx.mode)

    // ── filter leaf ───────────────────────────────────────────────────────
    default:         return evalFilterCondition(expr as FilterCondition, ctx.filterParams)
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// 3. engine/core/src/core/context.ts — Phase 2
//
//    SectionContext: timeMode removed. Pure OLAP coordinate.
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 SectionContext:
//
//   export interface SectionContext {
//     dims: Record<string, DimVal>
//     // timeMode removed — mode is injected via interpretSpec(..., mode)
//   }
//
// Phase 2 EMPTY_CTX:
//   const EMPTY_CTX: SectionContext = { dims: {} }
//
// Deprecated alias (keep during migration, delete after Step 8):
//   /** @deprecated — use ModeId from @geostat/engine/mode */
//   export type TimeMode = ModeId


// ═══════════════════════════════════════════════════════════════════════════
// 4. interpretSpec — Phase 2 signature
//
//    engine/core/src/registry/interpreters.ts (or data/spec.ts)
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 signature (mode is own param, not in SectionContext):
//
//   export function interpretSpec(
//     spec:   DataSpec,
//     ctx:    SectionContext,     // dims only — no timeMode
//     store:  DataStore,
//     mode?:  ModeId,             // NEW — direct injection, no bridge
//   ): DataRow[]
//
// by-mode handler:
//
//   case 'by-mode': {
//     const key    = mode ?? 'year'
//     const branch = spec.modes[key] ?? spec.modes['default']
//     if (!branch) {
//       console.warn(`[engine] interpretSpec: no DataSpec for mode '${key}' in by-mode spec`)
//       return []
//     }
//     return interpretSpec(branch, ctx, store, mode)  // pass mode to nested spec
//   }
//
// Migration: mode? is optional → all existing callers zero-change (Step 1).
// After Step 4: SiteRenderer passes mode explicitly. bridge removed.
// SectionContext.timeMode gone → interpretSpec reads mode only from its own param.


// ═══════════════════════════════════════════════════════════════════════════
// 5. engine/react/src/context/FilterContext.tsx — Phase 2
//
//    FilterProvider excludes mode key from state.
//    FilterContext.state never contains mode.
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 FilterProvider:
//
//   interface FilterProviderProps {
//     children:    React.ReactNode
//     excludeKeys?: string[]   // keys managed externally (e.g. ['mode'])
//   }
//
//   export function FilterProvider({ children, excludeKeys = [] }: FilterProviderProps) {
//     const [params, setSearchParams] = useSearchParams()
//     const paramsKey = params.toString()
//
//     const state = useMemo(() => {
//       const all = Object.fromEntries(new URLSearchParams(paramsKey))
//       // Remove externally-managed keys — they belong to other providers
//       for (const key of excludeKeys) delete all[key]
//       return all
//     }, [paramsKey, excludeKeys])
//
//     // set / setMany: write to URL but exclude excluded keys from state reads
//     // (set() still works for excluded keys if called directly — graceful)
//     // ...
//   }
//
// SiteRenderer wires:
//   <FilterProvider excludeKeys={[modeKey]}>
//     <ModeProvider value={mode}>
//       ...
//     </ModeProvider>
//   </FilterProvider>
//
// Result:
//   FilterContext.state = { year: '2024', sector: 'S1' }   // mode absent ✅
//   ModeProvider reads  mode from URL directly              // no FilterContext dep ✅


// ═══════════════════════════════════════════════════════════════════════════
// 6. engine/react/src/context/ModeContext.tsx — Phase 2
//
//    useModeContext: reads URL directly. Zero FilterContext dependency.
// ═══════════════════════════════════════════════════════════════════════════

import { modeRegistry } from '../mode-registry-ref'  // engine/core/src/mode/registry

export function useModeContext(
  modeKey:   string,
  available: ModeId[],
): ModeContext {
  const [params, setSearchParams] = useSearchParams()

  // Phase 1 vs Phase 2: same implementation — BUT now FilterContext excludes
  // this key, so there is no shared ownership. Each provider owns its slice.

  const defs    = useMemo(() => modeRegistry.resolve(available), [available])
  const current = useMemo((): ModeId => {
    const fromUrl = params.get(modeKey) as ModeId | null
    return (fromUrl && available.includes(fromUrl))
      ? fromUrl
      : (available[0] ?? 'year')
  }, [params, modeKey, available])

  const set = useCallback((id: ModeId): void => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(modeKey, id)
      return next
    }, { replace: true })  // replace: no extra browser history entry on mode change
  }, [modeKey, setSearchParams])

  return useMemo(
    () => ({ current, available: defs, set }),
    [current, defs, set],
  )
}

const ModeReactCtx = createContext<ModeContext>({
  current: 'year', available: [], set: () => undefined,
})

export function ModeProvider({ value, children }: { value: ModeContext; children: ReactNode }): ReactNode {
  return <ModeReactCtx.Provider value={value}>{children}</ModeReactCtx.Provider>
}

export const useMode = (): ModeContext => useContext(ModeReactCtx)


// ═══════════════════════════════════════════════════════════════════════════
// 7. engine/react/src/engine/types.ts — Phase 2 RenderContext
//
//    Cleaned up: timeMode-related fields removed.
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 RenderContext (relevant changes only):
//
//   export interface RenderContext {
//     sectionCtx:   SectionContext          // dims only — NO timeMode
//     store:        DataStore
//     filterParams: Record<string, unknown> // mode key absent — excluded by FilterProvider
//     set:          (key: string, val: unknown) => void
//     color:        string
//     crumbs?:      { label: string; href?: string }[]
//     mode:         ModeContext             // isolated — parallel to sectionCtx
//     //
//     // DELETED in Phase 2:
//     //   timeModeKey: string              // was: URL param key for time mode
//     //
//     paramOptions?: ...
//     effects:       Effect[]
//     rows?:         DataRow[]
//     view?:         ViewParams
//     renderNode:    (node: NodeDef, ctxOverride?) => ReactNode
//   }


// ═══════════════════════════════════════════════════════════════════════════
// 8. engine/react/src/engine/SiteRenderer.tsx — Phase 2
//
//    Bridge removed. Clean injection. Both providers in correct order.
// ═══════════════════════════════════════════════════════════════════════════

// Phase 2 PageRendererInner:
//
//   function PageRendererInner({ page }: { page: PageConfig }): ReactNode {
//     const store       = usePageStore(page.storeKey)
//     const filterState = useFilterState(page.filterBar ?? EMPTY_FILTER_BAR, store)
//
//     const modeBarNode = findModeBarNode(page)
//     const modeKey     = modeBarNode?.key  ?? 'mode'
//     const modeList    = modeBarNode?.modes ?? ['year', 'range']
//     const mode        = useModeContext(modeKey, modeList)
//
//     // Phase 2: sectionCtx has NO timeMode — pure dims
//     // No bridge needed. interpretSpec receives mode as own param.
//     const sectionCtx = filterState.ctx    // { dims: {...} } only
//
//     const baseRenderCtx: Omit<RenderContext, 'renderNode'> = {
//       sectionCtx,                          // ← no timeMode injection
//       store,
//       filterParams: { ...filterState.raw, ...filterState.derived },
//       set: ...,
//       color: ...,
//       crumbs: ...,
//       effects: filterState.effects,
//       mode,                                 // ← isolated ModeContext
//       // timeModeKey: DELETED
//     }
//
//     return (
//       <FilterProvider excludeKeys={[modeKey]}>   {/* mode excluded from filter state */}
//         <ModeProvider value={mode}>
//           <InnerLayout ...>
//             {engine.renderSlots(page, baseRenderCtx)}
//           </InnerLayout>
//         </ModeProvider>
//       </FilterProvider>
//     )
//   }
//
// ── findModeBarNode — walk page config for ModeBarNode ────────────────────
//
//   function findModeBarNode(page: PageConfig): ModeBarNode | undefined {
//     // Check sections (ModeBarNode as standalone node)
//     for (const s of page.sections ?? []) {
//       if (s.type === 'mode-bar') return s as ModeBarNode
//     }
//     // Check filterBar.bars items
//     for (const bar of page.filterBar?.bars ?? []) {
//       for (const item of bar.items) {
//         if (item.type === 'mode-bar') return item as ModeBarNode
//       }
//     }
//     return undefined
//   }


// ═══════════════════════════════════════════════════════════════════════════
// 9. RenderEngine.ts — Phase 2 call sites
//
//    evalVisibility and interpretSpec updated to Phase 2 signatures.
// ═══════════════════════════════════════════════════════════════════════════

// In RenderEngine.renderNode (wherever visibleWhen is evaluated):
//
//   // Phase 1:
//   if (view.visibleWhen && !evalVisibility(view.visibleWhen, ctx.filterParams, ctx.mode?.current))
//     return null
//
//   // Phase 2:
//   if (view.visibleWhen && !evalVisibility(view.visibleWhen, {
//     filterParams: ctx.filterParams,
//     mode:         ctx.mode.current,
//   })) return null
//
//
// In RenderEngine — wherever interpretSpec is called for data resolution:
//
//   // Phase 1:
//   const raw = interpretSpec(node.data, ctx.sectionCtx, ctx.store)
//
//   // Phase 2:
//   const raw = interpretSpec(node.data, ctx.sectionCtx, ctx.store, ctx.mode.current)


// ═══════════════════════════════════════════════════════════════════════════
// 10. Config examples — Phase 2 (clean, no param references to mode)
// ═══════════════════════════════════════════════════════════════════════════

const gdpPagePhase2 = {
  id: 'gdp', storeKey: 'gdp', color: '#0080BE',

  // ModeBarNode — standalone in sections, before filter bar
  // Could also be inside filterBar.bars.items — both work
  sections: [

    // Mode selector
    { type: 'mode-bar', key: 'mode', modes: ['year', 'range', 'compare'] },

    // Year view — simple mode condition
    {
      type: 'section', id: 'gdp-year', title: 'წლიური მშპ',
      view: { visibleWhen: { op: 'mode-is', mode: 'year' } },
      data: { type: 'query', query: { measure: 'B1G' }, pipe: [] },
      chart: { type: 'chart', chartType: 'bar' },
      table: { type: 'table', columns: [{ key: 'value', label: 'მლნ ₾' }] },
    },

    // Range view
    {
      type: 'section', id: 'gdp-range', title: 'დინამიკა',
      view: { visibleWhen: { op: 'mode-is', mode: 'range' } },
      data: {
        type: 'by-mode',
        modes: {
          range:   { type: 'query', query: { measure: 'B1G' }, pipe: [{ op: 'sort', by: 'time', dir: 'asc' }] },
          compare: { type: 'query', query: { measure: 'B1G' }, pipe: [{ op: 'sort', by: 'time', dir: 'asc' }] },
        },
      },
      chart: { type: 'chart', chartType: 'line' },
      table: { type: 'table', columns: [{ key: 'value', label: 'მლნ ₾' }] },
    },

    // Compare view — compound condition (mode AND filter)
    {
      type: 'section', id: 'gdp-compare', title: 'შედარება',
      view: {
        visibleWhen: {
          op: 'and',
          exprs: [
            { op: 'mode-is', mode: 'compare' },   // mode condition
            { op: 'isset',   param: 'geo' },       // filter condition
            // evalFilterCondition knows nothing about mode ✅
            // evalModeCondition knows nothing about geo ✅
          ],
        },
      },
      data: { type: 'query', query: { measure: 'B1G' }, pipe: [] },
      chart: { type: 'chart', chartType: 'bar' },
      table: { type: 'table', columns: [{ key: 'value', label: 'მლნ ₾' }] },
    },
  ],
}

// JSON.parse(JSON.stringify(gdpPagePhase2)) deepEqual gdpPagePhase2 ✅
// No mode in filterParams. No mode in SectionContext. Mode = own concern. ✅


// ═══════════════════════════════════════════════════════════════════════════
// 11. Tests — Phase 2 (each evaluator tested in isolation)
// ═══════════════════════════════════════════════════════════════════════════

// engine/core/src/mode/evaluator.test.ts:
//
//   describe('evalModeCondition', () => {
//     it('mode-is: matches', () => expect(evalModeCondition({ op: 'mode-is', mode: 'year' }, 'year')).toBe(true))
//     it('mode-is: no match', () => expect(evalModeCondition({ op: 'mode-is', mode: 'year' }, 'range')).toBe(false))
//     it('mode-in: included', () => expect(evalModeCondition({ op: 'mode-in', modes: ['year','range'] }, 'range')).toBe(true))
//     it('mode-in: excluded', () => expect(evalModeCondition({ op: 'mode-in', modes: ['year'] }, 'range')).toBe(false))
//     it('mode-not: different', () => expect(evalModeCondition({ op: 'mode-not', mode: 'range' }, 'year')).toBe(true))
//     // Zero imports from filter system — pure isolation ✅
//   })
//
//   describe('evalFilterCondition', () => {
//     it('eq: match', () => expect(evalFilterCondition({ op: 'eq', param: 'geo', is: 'GE' }, { geo: 'GE' })).toBe(true))
//     it('isset: present', () => expect(evalFilterCondition({ op: 'isset', param: 'geo' }, { geo: 'GE' })).toBe(true))
//     it('isset: absent', () => expect(evalFilterCondition({ op: 'isset', param: 'geo' }, {})).toBe(false))
//     // Zero imports from mode system — pure isolation ✅
//   })
//
//   describe('evalVisibility (composition)', () => {
//     const ctx: VisibilityCtx = { filterParams: { geo: 'GE' }, mode: 'year' }
//     it('and: both pass', () => expect(evalVisibility(
//       { op: 'and', exprs: [{ op: 'mode-is', mode: 'year' }, { op: 'isset', param: 'geo' }] }, ctx
//     )).toBe(true))
//     it('and: one fails', () => expect(evalVisibility(
//       { op: 'and', exprs: [{ op: 'mode-is', mode: 'range' }, { op: 'isset', param: 'geo' }] }, ctx
//     )).toBe(false))
//   })


// suppress unused warnings (examples only)
export {
  evalFilterCondition, evalModeCondition, evalVisibility,
  useModeContext, ModeProvider, useMode,
  gdpPagePhase2,
}
export type { FilterCondition, ModeCondition, VisibilityCtx, VisibilityExpr }
```
