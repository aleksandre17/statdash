# mode-system.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Mode System — framework-level implementation reference
 *
 * Full isolation of rendering mode (year / range / compare) from filter params.
 * Grafana time range pattern: mode = first-class concern, not a variable.
 *
 * Layer map:
 *   engine/core/src/mode/         ← pure types + registry + evaluator (zero React)
 *   engine/core/src/config/       ← VisibilityExpr extension + evalVisibility
 *   engine/core/src/core/context  ← SectionContext.timeMode: ModeId (widened)
 *   engine/react/src/context/       ← ModeContext React provider + hook
 *   engine/react/src/engine/types   ← RenderContext.mode: ModeContext
 *   engine/react/src/engine/SiteRenderer ← useModeContext injection
 *   plugins/nodes/mode-bar/           ← ModeBarShell renderer + NodeTypeMap augmentation
 *   src/setupRegistrations.ts         ← built-in mode registration
 *
 * See architecture/19-mode-system.md for decisions + migration plan.
 */

import {
  createContext, useContext, useMemo, useCallback,
  type ReactNode, type ComponentType,
}                                    from 'react'
import { useSearchParams }           from 'react-router-dom'
import type { DataStore, DataRow }   from '@geostat/engine'
import type { RenderContext, NodeDef } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// 1. ENGINE LAYER — engine/core/src/mode/
//    Pure. Zero React. Zero Geostat.
// ═══════════════════════════════════════════════════════════════════════════

// ── types.ts ─────────────────────────────────────────────────────────────

/** Open string — new mode = registration, not a code change. Constructor-ready. */
export type ModeId = string

/**
 * ModeDef — one registered rendering mode.
 *
 * Grafana: TimeRange is a top-level concept with its own picker + label.
 * We model modes the same way: first-class, registered, discovered at runtime.
 *
 * dataKey: matches DataSpec.by-mode key. Defaults to id if not set.
 * icon:    agnostic key (string) — resolved by icon registry at render time.
 *          Never an SVG or import. Never hardcoded.
 */
export interface ModeDef {
  id:       ModeId
  label:    string
  icon?:    string
  dataKey?: string   // for DataSpec.by-mode lookup — defaults to id
}

/**
 * ModeContext — injected into RenderContext.mode.
 *
 * current:   the active mode id ('year' | 'range' | 'compare' | any registered)
 * available: resolved ModeDef[] for this page's declared modes
 * set:       writes to URL param (via FilterContext — same URL, no race)
 *
 * Consumers:
 *   ModeBarShell     — reads available, current; calls set on tab click
 *   evalVisibility   — reads current for mode-is/mode-in/mode-not ops
 *   interpretSpec    — reads current for by-mode DataSpec branch selection
 *   SectionRenderer  — reads current for NavSection mode sorting
 */
export interface ModeContext {
  current:   ModeId
  available: ModeDef[]
  set:       (id: ModeId) => void
}


// ── registry.ts ──────────────────────────────────────────────────────────

/**
 * ModeRegistry — open registry, singleton.
 *
 * Grafana equivalent: each variable type is registered in variableAdapters.
 * Our equivalent: each mode is registered here.
 * New mode: one register() call in setupRegistrations. Zero other changes.
 */
class ModeRegistryImpl {
  private readonly defs = new Map<ModeId, ModeDef>()

  register(def: ModeDef): void {
    this.defs.set(def.id, def)
  }

  get(id: ModeId): ModeDef | undefined {
    return this.defs.get(id)
  }

  /** Constructor palette: all registered modes */
  list(): ModeDef[] {
    return [...this.defs.values()]
  }

  /** Resolve a declared id list to ModeDef[] (skips unknown ids gracefully) */
  resolve(ids: ModeId[]): ModeDef[] {
    return ids.flatMap(id => {
      const def = this.defs.get(id)
      return def ? [def] : []
    })
  }
}

export const modeRegistry = new ModeRegistryImpl()


// ── VisibilityExpr extension — engine/core/src/config/section.ts ─────
//
//  Add these three variants to the existing VisibilityExpr discriminated union.
//  evalVisibility gains an optional third param: mode?: ModeId
//
//  Existing ops (param-based) — unchanged. Mode ops — new, isolated.
//  Old callers omit mode → mode ops return false (conservative, hidden).
//
//  Why same `op` discriminant (not `{ modeIs }`)?
//    Existing evalVisibility is a single switch on expr.op.
//    Same discriminant = one switch handles all ops — no separate dispatch path.
//    Evaluator stays linear, testable, exhaustive.

// Add to VisibilityExpr union (in engine/core/src/config/section.ts):
//
//   | { op: 'mode-is';  mode:  ModeId   }
//   | { op: 'mode-in';  modes: ModeId[] }
//   | { op: 'mode-not'; mode:  ModeId   }
//
// Extended evalVisibility signature:
//
//   export function evalVisibility(
//     expr:  VisibilityExpr,
//     fr:    Record<string, unknown>,
//     mode?: ModeId,           // ← new optional param — backward compatible
//   ): boolean {
//     switch (expr.op) {
//       // ... existing cases unchanged ...
//       case 'mode-is':  return mode != null && mode === expr.mode
//       case 'mode-in':  return mode != null && expr.modes.includes(mode)
//       case 'mode-not': return mode != null && mode !== expr.mode
//     }
//   }
//
// evalVisibility call sites in RenderEngine.ts:
//   evalVisibility(expr, ctx.filterParams, ctx.mode?.current)
//
// Result:
//   Old configs `{ op: 'eq', param: 'mode', is: 'year' }` — still work
//   (mode is in filterParams via FilterContext backward compat).
//   New configs `{ op: 'mode-is', mode: 'year' }` — use ModeContext.current.
//   Both coexist during migration (Strangler Fig).


// ── SectionContext change — engine/core/src/core/context.ts ───────────
//
//  Current:
//    export type TimeMode = 'year' | 'range' | 'compare'   // closed union
//    export interface SectionContext {
//      timeMode: TimeMode
//      dims:     Record<string, DimVal>
//    }
//
//  Change to (non-breaking type widening):
//    export type ModeId = string                             // re-export from mode/types.ts
//    export type TimeMode = ModeId                           // backward compat alias
//    export interface SectionContext {
//      timeMode: ModeId   // widened — string superset of closed union
//      dims:     Record<string, DimVal>
//    }
//
//  Existing callers using TimeMode: no change needed — ModeId = string is a supertype.
//  DataSpec.by-mode: `spec.modes[ctx.timeMode]` — still works (string key lookup).
//  EMPTY_CTX: `{ timeMode: 'year', dims: {} }` — still valid (string literal).


// ═══════════════════════════════════════════════════════════════════════════
// 2. REACT LAYER — engine/react/src/context/ModeContext.tsx
//    React. Zero Geostat. Zero app content.
// ═══════════════════════════════════════════════════════════════════════════

// ── ModeBarNode — NodeDef type ────────────────────────────────────────────
//
//  JSON-serializable. Constructor-ready. No functions, no JSX.
//  Declared in plugins/nodes/mode-bar/types.ts via NodeTypeMap augmentation.
//
//  declare module '@geostat/react' {
//    interface NodeTypeMap { 'mode-bar': ModeBarNode }
//  }

export interface ModeBarNode {
  type:  'mode-bar'
  /** URL search param key for mode state — default: 'mode'. */
  key?:  string
  /** Ordered list of registered ModeId values available on this page. */
  modes: ModeId[]
}


// ── useModeContext — hook ─────────────────────────────────────────────────
//
//  Produces ModeContext from URL state.
//  Uses useSearchParams directly (same URL as FilterContext, no race —
//  React Router deduplicates concurrent writes via setSearchParams queue).
//
//  Phase 1: mode URL param is shared with FilterContext (backward compat).
//  Phase 2: extract ModeProvider with independent URL param management.
//
//  modeKey:   URL param name — matches ModeBarNode.key (default: 'mode')
//  available: ModeId[] declared in ModeBarNode.modes
//
//  Grafana equivalent: useTimeRange() — reads global time range state,
//  exposes { from, to, raw } + setTimeRange(). Dashboard state, not variable.

export function useModeContext(
  modeKey:   string,
  available: ModeId[],
): ModeContext {
  const [params, setSearchParams] = useSearchParams()

  const defs    = useMemo(() => modeRegistry.resolve(available), [available])
  const current = useMemo((): ModeId => {
    const fromUrl = params.get(modeKey) as ModeId | null
    return (fromUrl && available.includes(fromUrl)) ? fromUrl : (available[0] ?? 'year')
  }, [params, modeKey, available])

  const set = useCallback((id: ModeId): void => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(modeKey, id)
      return next
    })
  }, [modeKey, setSearchParams])

  return useMemo(
    () => ({ current, available: defs, set }),
    [current, defs, set],
  )
}


// ── ModeReactContext — engine/react/src/context/ModeContext.tsx ─────────
//
//  For consumers deeper in the tree that can't reach RenderContext.
//  ModeBarShell reads this directly (it's a React component, not a renderer).

const ModeReactCtx = createContext<ModeContext>({
  current:   'year',
  available: [],
  set:       () => undefined,
})

export function ModeProvider({
  value,
  children,
}: {
  value:    ModeContext
  children: ReactNode
}): ReactNode {
  return <ModeReactCtx.Provider value={value}>{children}</ModeReactCtx.Provider>
}

export const useMode = (): ModeContext => useContext(ModeReactCtx)


// ═══════════════════════════════════════════════════════════════════════════
// 3. RenderContext extension — engine/react/src/engine/types.ts
//    Add `mode: ModeContext` alongside `sectionCtx`.
// ═══════════════════════════════════════════════════════════════════════════

// Add to RenderContext interface:
//
//   /** Isolated rendering mode context — parallel to sectionCtx, not inside it. */
//   mode: ModeContext
//
// RenderContext.sectionCtx  → filter dims + timeMode (OLAP coordinate)
// RenderContext.mode        → current mode + available modes + setter
//
// They are PARALLEL, not nested. mode changes HOW, sectionCtx changes WHAT.


// ═══════════════════════════════════════════════════════════════════════════
// 4. SiteRenderer wiring — engine/react/src/engine/SiteRenderer.tsx
//    Inject ModeContext into RenderContext. Wrap with ModeProvider.
// ═══════════════════════════════════════════════════════════════════════════

// In PageRendererInner:
//
//   function PageRendererInner({ page }: { page: PageConfig }): ReactNode {
//     const store      = usePageStore(page.storeKey)
//     const filterState = useFilterState(page.filterBar ?? EMPTY_FILTER_BAR, store)
//
//     // Resolve mode: find ModeBarNode in page to get modes list
//     const modeBarNode = findModeBarNode(page)
//     const modeKey     = modeBarNode?.key  ?? 'mode'
//     const modeList    = modeBarNode?.modes ?? ['year', 'range']
//     const mode        = useModeContext(modeKey, modeList)
//
//     // Sync sectionCtx.timeMode ← mode.current (bridge for DataSpec.by-mode)
//     // This keeps backward compat: interpretSpec reads sectionCtx.timeMode.
//     const sectionCtx = useMemo(() => ({
//       ...filterState.ctx,
//       timeMode: mode.current,   // ← always reflects ModeContext
//     }), [filterState.ctx, mode.current])
//
//     const baseRenderCtx: Omit<RenderContext, 'renderNode'> = {
//       sectionCtx,
//       store,
//       filterParams:  { ...filterState.raw, ...filterState.derived },
//       set:           ...,
//       color:         ...,
//       crumbs:        ...,
//       timeModeKey:   modeKey,     // backward compat — old toggle still works
//       effects:       filterState.effects,
//       mode,                       // NEW — isolated ModeContext
//     }
//
//     return (
//       <ModeProvider value={mode}>
//         <InnerLayout ...>
//           {engine.renderSlots(page, baseRenderCtx)}
//         </InnerLayout>
//       </ModeProvider>
//     )
//   }
//
// findModeBarNode(page): walks page slots, finds first ModeBarNode.
// Simple util: checks filterBar.bars[*].items and page.sections for type === 'mode-bar'.


// ═══════════════════════════════════════════════════════════════════════════
// 5. ModeBarShell — plugins/nodes/mode-bar/ModeBarShell.tsx
//    Token-driven. Zero brand. Generic names. Reads ctx.mode.
// ═══════════════════════════════════════════════════════════════════════════

// NodeSlice (plugins/nodes/mode-bar/index.ts):
//
//   export const modeBarSlice: NodeSlice = {
//     Shell:    ModeBarShell,
//     Skeleton: ModeBarSkeleton,
//     META: {
//       type:     'mode-bar',
//       label:    'Mode Tab Bar',
//       icon:     'tabs',
//       category: 'layout',
//       schema: {
//         palette: { label: 'Mode Bar', icon: 'tabs', category: 'layout' },
//         fields: [
//           { name: 'modes', type: 'json',   label: 'Modes (ModeId[])', required: true },
//           { name: 'key',   type: 'string', label: 'URL param key (default: mode)' },
//         ],
//       },
//     },
//   }

// ModeBarShell implementation:
//
//   function ModeBarShellInner({ ctx }: { ctx: RenderContext }) {
//     const { current, available, set } = ctx.mode
//
//     if (available.length < 2) return null  // single mode = no tab needed
//
//     return (
//       <div className="mode-tab-group" role="tablist" aria-label="ნახვის რეჟიმი">
//         {available.map(def => (
//           <button
//             key={def.id}
//             role="tab"
//             aria-selected={current === def.id}
//             className={`mode-tab-btn${current === def.id ? ' mode-tab-btn--active' : ''}`}
//             onClick={() => set(def.id)}
//           >
//             {def.icon && <span className="mode-tab-icon" data-icon={def.icon} aria-hidden />}
//             {def.label}
//           </button>
//         ))}
//       </div>
//     )
//   }
//
//   export function ModeBarShell(
//     def:      ModeBarNode,
//     ctx:      RenderContext,
//     _children: ReactNode,
//   ): ReactNode {
//     return <ModeBarShellInner ctx={ctx} />
//   }
//
// CSS (token-driven — engine/react/src/styles/mode-bar.css):
//
//   .mode-tab-group {
//     display:     flex;
//     gap:         2px;
//     padding:     3px;
//     background:  var(--color-surface-alt, #f0f0f0);
//     border-radius: var(--radius-md, 6px);
//   }
//   .mode-tab-btn {
//     padding:      4px 14px;
//     border:       none;
//     background:   transparent;
//     border-radius: var(--radius-sm, 4px);
//     cursor:       pointer;
//     font-size:    0.85rem;
//     color:        var(--color-text-secondary);
//     transition:   background 120ms, color 120ms;
//   }
//   .mode-tab-btn--active {
//     background: var(--color-surface, white);
//     color:      var(--color-primary);
//     font-weight: 600;
//     box-shadow: 0 1px 3px rgba(0,0,0,.08);
//   }
//   .mode-tab-btn:hover:not(.mode-tab-btn--active) {
//     background: var(--color-surface-hover, rgba(0,0,0,.04));
//   }
//   /* Skeleton */
//   .mode-tab-group--skeleton .mode-tab-btn {
//     width: 72px; height: 28px;
//     background: var(--color-skeleton, #e8e8e8);
//     border-radius: var(--radius-sm);
//     animation: skeleton-pulse 1.4s ease-in-out infinite;
//   }


// ═══════════════════════════════════════════════════════════════════════════
// 6. setupRegistrations.ts — built-in modes
//    src/setupRegistrations.ts — app boundary. Knows Geostat. Knows Georgian.
// ═══════════════════════════════════════════════════════════════════════════

// Add to setupRegistrations():
//
//   modeRegistry.register({ id: 'year',    label: 'წელი',      icon: 'calendar',       dataKey: 'year'    })
//   modeRegistry.register({ id: 'range',   label: 'დიაპაზონი', icon: 'calendar-range', dataKey: 'range'   })
//   modeRegistry.register({ id: 'compare', label: 'შედარება',  icon: 'git-compare',    dataKey: 'compare' })
//
// New mode (any future org, any session):
//   modeRegistry.register({ id: 'yoy', label: 'წ/წ ზრდა', icon: 'trending-up', dataKey: 'yoy' })
//   → ModeBarNode: { type: 'mode-bar', modes: ['year', 'range', 'yoy'] }
//   → DataSpec.by-mode: { type: 'by-mode', modes: { year: ..., range: ..., yoy: ... } }
//   → visibleWhen: { op: 'mode-is', mode: 'yoy' }
//   → Zero engine changes. Zero renderer changes. Registration only.


// ═══════════════════════════════════════════════════════════════════════════
// 7. JSON config — full usage example (Constructor-ready)
// ═══════════════════════════════════════════════════════════════════════════

// Page config (all JSON-serializable):
const gdpPageConfig = {
  id:       'gdp',
  storeKey: 'gdp',
  color:    '#0080BE',

  filterBar: {
    type: 'filter-bar',
    bars: [
      {
        type:  'bar',
        items: [
          // ModeBarNode as filter bar item (alternative: standalone in sections)
          { type: 'mode-bar', key: 'mode', modes: ['year', 'range'] },
          // Year param — visible in year mode only
          {
            type:      'year-select',
            key:       'year',
            default:   '2024',
            showWhen:  { mode: 'year' },   // still works — mode is in filterParams
          },
        ],
      },
    ],
    context: { timeMode: 'mode', dims: { time: 'year' } },
  },

  sections: [
    // Section visible only in year mode
    {
      type: 'section',
      id:   'gdp-year',
      view: {
        visibleWhen: { op: 'mode-is', mode: 'year' },  // NEW: clean, isolated
      },
      data: { type: 'query', query: { measure: 'B1G' } },
      chart: { type: 'chart', chartType: 'bar' },
      table: { type: 'table', columns: [{ key: 'value', label: 'მლნ ₾' }] },
    },

    // Section visible only in range mode
    {
      type: 'section',
      id:   'gdp-range',
      view: {
        visibleWhen: { op: 'mode-is', mode: 'range' },
      },
      // DataSpec.by-mode picks branch by mode.current === sectionCtx.timeMode
      data: {
        type:  'by-mode',
        modes: {
          range: { type: 'query', query: { measure: 'B1G' }, pipe: [{ op: 'sort', by: 'time', dir: 'asc' }] },
        },
      },
      chart: { type: 'chart', chartType: 'line' },
      table: { type: 'table', columns: [{ key: 'value', label: 'მლნ ₾' }] },
    },

    // Section visible in BOTH modes (no visibleWhen = always visible)
    {
      type:  'section',
      id:    'gdp-kpis',
      title: 'ძირითადი მაჩვენებლები',
      data:  { type: 'query', query: { measure: 'B1G' } },
    },
  ],
}

// JSON.parse(JSON.stringify(gdpPageConfig)) deepEqual gdpPageConfig ✅
// Constructor writes this object to DB. SiteRenderer reads from DB. Zero code change.


// ═══════════════════════════════════════════════════════════════════════════
// 8. DataSpec.by-mode — unchanged, still works
// ═══════════════════════════════════════════════════════════════════════════

// interpretSpec (engine/core/src/registry/interpreters.ts) reads:
//   sectionCtx.timeMode — which is now set from ModeContext.current by SiteRenderer
//
// The bridge:
//   mode.current ('year' | 'range' | ...) → sectionCtx.timeMode (same value)
//   → interpretSpec picks spec.modes[sectionCtx.timeMode]
//   → correct DataSpec branch for current mode
//
// No change to interpretSpec. No change to DataSpec.by-mode shape.
// The bridge in SiteRenderer: sectionCtx = { ...filterState.ctx, timeMode: mode.current }


// ═══════════════════════════════════════════════════════════════════════════
// 9. Dependency graph — runtime
// ═══════════════════════════════════════════════════════════════════════════
//
//  URL param 'mode'
//       │
//       ▼
//  useModeContext()  ──reads──  modeRegistry.resolve(available)
//       │
//       ▼
//  ModeContext { current, available, set }
//       │
//       ├──────────────────────────────────────────────────────────────┐
//       ▼                                                              ▼
//  RenderContext.mode                                          ModeProvider (React ctx)
//       │                                                              │
//       ├── evalVisibility(expr, filterParams, mode.current)   useMode() in ModeBarShell
//       │       ─── mode-is/mode-in/mode-not ops
//       │
//       ├── sectionCtx.timeMode = mode.current
//       │       ─── DataSpec.by-mode branch selection (interpretSpec)
//       │
//       └── ModeBarShell reads ctx.mode.available → renders tabs
//                          calls ctx.mode.set(id) → URL update → re-render
//
//  Mode has no deps. Others depend on mode. One-way. Clean.


// suppress unused warnings (examples only)
export { gdpPageConfig, useModeContext, ModeProvider, useMode, modeRegistry }
export type { ModeDef, ModeContext, ModeId, ModeBarNode }
```
