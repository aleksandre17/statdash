// ── SiteRenderer — wires hooks + renderNode() into a page component ─────
//
//  NodePageRenderer is the universal entry point for JSON-configured pages.
//  Usage:
//    <NodePageRenderer page={myPageConfig} />
//
//  Wiring:
//    1. useFilterState(page.filterSchema)  → SectionContext + filter state
//    2. evalVarMap(page.vars, ...)         → ctx.vars (page-level derived variables)
//    3. schemaToBarNodes(page.filterSchema) → BarNode[] for FiltersProvider
//    4. Build baseCtx from above
//    5. renderNode(page, ctx)              → ReactNode tree
//
//  Convention keys consumed from ctx.vars:
//    _pageColor  → overrides page.color (accent color)
//    _pageCrumbs → overrides PageHeaderNode.crumbs (breadcrumb trail)
//

import { useCallback, useMemo, memo, type ReactNode } from 'react'
import { useFilter, FilterProvider }   from '@geostat/react'
import { useStores }                   from '@geostat/react'
import { useFilterState }              from '@geostat/react'
import { useLocale, useI18n }          from '../context/SiteContext'
import { PageStoreProvider }           from '../context/PageStoreContext'
import { GlobalStateProvider }         from '../context/GlobalState'
import { applyEffects, resolveDataLinks } from '@geostat/engine'
import type { ModeId }                from '@geostat/engine'
import { evalExpr, isDimVal }         from '@geostat/expr'
import type { ExprScope, ExprVal, DimVal } from '@geostat/expr'
import { FiltersProvider }             from '../context/FiltersContext'
import { useModeContext, ModeProvider } from '../context/ModeContext'
import { EventBus }                    from '../events/EventBus'
import type { GeostatEventMap }        from '../events/events'
import { renderNode as renderNodeFn }  from './renderNode'
import { extractNavSectionsFromChildren } from './navUtils'
import type { FilterSchemaInput, BarNode, ParamNode, DataLinkDef } from '@geostat/engine'
import type { NodeBase, RenderContext, NodePageConfig } from './types'

// ── schemaToBarNodes — convert FilterSchemaInput to BarNode[] for FiltersProvider ──
//
//  FiltersProvider holds this array. FilterBarShell reads it via useFiltersContext().
//

function schemaToBarNodes(schema: FilterSchemaInput | null | undefined): BarNode[] {
  if (!schema) return []
  return Object.entries(schema.bars).map(([barId, barDef]): BarNode => ({
    type:       'bar',
    id:         barId,
    position:   barDef.position,
    order:      barDef.order,
    layout:     barDef.layout,
    timeToggle: barDef.timeToggle,
    timeModes:  barDef.timeModes,
    showWhen:   barDef.showWhen,
    items:      Object.entries(barDef.filters).map(([key, paramDef]) => ({
      key,
      ...paramDef,
    } as ParamNode)),
  }))
}

// ── NodePageRendererInner — component with hook access ─────────────────
//
//  memo(): page prop is stable (same object reference from PageLoader state).
//  Prevents re-renders when FilterProvider re-renders due to useLocation /
//  useSearchParams on navigation — only context value changes (filter interactions)
//  can trigger re-renders here, not parent re-renders from navigation.
//
const NodePageRendererInner = memo(function NodePageRendererInner({ page }: { page: NodePageConfig }): ReactNode {
  const stores         = useStores()
  const locale         = useLocale()
  const { fallbackLocale } = useI18n()

  const {
    ctx: rawSectionCtx,
    raw,
    timeModeKey,
    effects,
  } = useFilterState(page.filterSchema ?? null)

  const modeList   = useMemo(() => page.modeOrder ?? [], [page.modeOrder])
  const mode       = useModeContext(timeModeKey, modeList)

  // Bridge: sectionCtx.timeMode = mode.current (validates against available modes;
  // interpretSpec reads sectionCtx.timeMode for DataSpec.by-mode branch selection).
  const sectionCtx = useMemo(
    () => ({ ...rawSectionCtx, timeMode: mode.current }),
    [rawSectionCtx, mode.current],
  )

  const { state, set: filterSet, setMany } = useFilter()

  const set = useCallback(
    (key: string, val: unknown) => filterSet(key, String(val)),
    [filterSet],
  )

  // Effects-aware mode setter — mirrors TimeModeToggle: atomically sets mode + clears
  // dependent params (e.g. year when switching to range, fromYear/toYear when leaving range).
  const modeSet = useCallback(
    (id: ModeId) => applyEffects(timeModeKey, id, state, effects, setMany),
    [timeModeKey, state, effects, setMany],
  )

  const modeCtx = useMemo(() => ({ ...mode, set: modeSet }), [mode, modeSet])

  const mergedFilterParams = useMemo(
    () => ({ ...raw, ...state }) as Record<string, unknown>,
    [raw, state],
  )

  // Resolved once per page — used for vars + PageStoreContext (filter control options).
  const pageStore = useMemo(
    () => stores[page.storeKey ?? Object.keys(stores)[0]] ?? null,
    [stores, page.storeKey],
  )

  const vars = useMemo(() => {
    if (!page.vars) return {} as Record<string, unknown>
    // ExprScope.ctx carries data-aware context for engine-registered ops (find, breadcrumbs, …).
    // dims = all filter params so { $ctx: 'key' } resolves to any param.
    // derived accumulates so each entry can reference earlier vars via { $derived: 'key' }.
    const scope: ExprScope = {
      dims:    mergedFilterParams as Record<string, DimVal>,
      derived: {},
      ctx:     { classifiers: pageStore?.classifiers, display: pageStore?.display, raw },
    }
    const result: Record<string, unknown> = {}
    for (const [k, expr] of Object.entries(page.vars)) {
      const value = evalExpr(expr as unknown as ExprVal, scope)
      result[k] = value
      if (isDimVal(value)) scope.derived[k] = value
    }
    return result
  }, [page.vars, mergedFilterParams, raw, pageStore])

  const navSections = useMemo(() => {
    const children = page.type === 'inner-page' ? page.children : []
    return extractNavSectionsFromChildren(children, timeModeKey, page.modeOrder)
      .filter(s => !s.navMode || s.navMode === modeCtx.current)
  }, [page, timeModeKey, modeCtx])

  const color  = (vars['_pageColor'] as string | undefined) ?? page.color ?? '#0080BE'
  const crumbs = vars['_pageCrumbs'] as { label: string; href?: string }[] | undefined

  // One EventBus per page — created once, survives filter changes (same ref).
  const eventBus = useMemo(() => new EventBus<GeostatEventMap>(), [])

  const resolveLinks = useCallback(
    (links: DataLinkDef[], row: Record<string, unknown>) =>
      resolveDataLinks(links, row as Record<string, DimVal>, mergedFilterParams, locale, fallbackLocale),
    [mergedFilterParams, locale, fallbackLocale],
  )

  const baseCtx: Omit<RenderContext, 'renderNode'> = {
    sectionCtx,
    stores,
    pageStoreKey: page.storeKey,
    filterParams: { ...mergedFilterParams, ...vars },
    set,
    vars,
    color,
    crumbs,
    locale,
    fallbackLocale,
    timeModeKey,
    effects,
    mode:         modeCtx,
    eventBus,
    resolveLinks,
    navContext:   { sections: navSections, timeModeKey },
  }

  // Self-referential: renderNode closure captures ctxHolder by reference so it
  // always reads the fully-assembled ctx (avoids temporal initialization issues).
  const ctxHolder = { ctx: baseCtx as RenderContext }
  ctxHolder.ctx = {
    ...baseCtx,
    renderNode: (n, o) =>
      renderNodeFn(n as unknown as NodeBase, o ? { ...ctxHolder.ctx, ...o } : ctxHolder.ctx),
  }
  const ctx = ctxHolder.ctx

  const content = renderNodeFn(page, ctx)

  return (
    <GlobalStateProvider>
      <PageStoreProvider store={pageStore}>
        <ModeProvider value={modeCtx}>{content}</ModeProvider>
      </PageStoreProvider>
    </GlobalStateProvider>
  )
})

// ── NodePageRenderer — public API ─────────────────────────────────────

export function NodePageRenderer({ page }: { page: NodePageConfig }): ReactNode {
  const filtersCtx = useMemo(() => ({
    bars:        schemaToBarNodes(page.filterSchema),
    timeModeKey: page.filterSchema?.context?.timeMode ?? 'mode',
    effects:     page.filterSchema?.effects ?? [],
  }), [page.filterSchema])

  return (
    <FilterProvider>
      <FiltersProvider value={filtersCtx}>
        <NodePageRendererInner page={page} />
      </FiltersProvider>
    </FilterProvider>
  )
}
