// ── SiteRenderer — wires hooks + renderNode() into a page component ─────
//
//  NodePageRenderer is the universal entry point for JSON-configured pages.
//  Usage:
//    <NodePageRenderer page={myPageConfig} />
//
//  Wiring:
//    1. useFilterState(page.filterSchema)  → SectionContext + filter state + BarNode[]
//    2. evalVarMap(page.vars, ...)         → ctx.vars (page-level derived variables)
//    3. Build baseCtx from above
//    4. renderNode(page, ctx)              → ReactNode tree
//
//  Convention keys consumed from ctx.vars:
//    _pageColor  → overrides page.color (accent color)
//    _pageCrumbs → overrides PageHeaderNode.crumbs (breadcrumb trail)
//

import { useCallback, useMemo, memo, type ReactNode } from 'react'
import {
  useFilter, FilterProvider,
  useStores, useFilterState,
  useLocale, useI18n,
  PageStoreProvider,
  useModeContext, ModeProvider,
} from '@geostat/react'
import { GlobalStateProvider }         from '../context/GlobalState'
import { applyEffects, resolveDataLinks } from '@geostat/engine'
import type { ModeId }                from '@geostat/engine'
import { FiltersProvider }             from '../context/FiltersContext'
import { evalVarMap }                  from './evalVarMap'
import { EventBus }                    from '../events/EventBus'
import type { GeostatEventMap }        from '../events/events'
import { renderNode as renderNodeFn }  from './renderNode'
import { extractNavSectionsFromChildren } from './navUtils'
import type { DataLinkDef, DimVal }                                from '@geostat/engine'
import type { NodeBase, RenderContext, NodePageConfig } from './types'

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

  // Resolved once per page — used for vars, PageStoreContext, and Tier 3 default resolution.
  const pageStore = useMemo(
    () => stores[page.storeKey ?? Object.keys(stores)[0]] ?? null,
    [stores, page.storeKey],
  )

  const {
    ctx: rawSectionCtx,
    raw,
    timeModeKey,
    effects,
    bars,
  } = useFilterState(page.filterSchema ?? null, pageStore)

  const filtersCtx = useMemo(
    () => ({ bars, timeModeKey, effects }),
    [bars, timeModeKey, effects],
  )

  const modeList   = useMemo(() => page.modeOrder ?? [], [page.modeOrder])
  const mode       = useModeContext(timeModeKey, modeList)

  // Bridge: sectionCtx.timeMode = mode.current (validates against available modes;
  // interpretSpec reads sectionCtx.timeMode for DataSpec.by-mode branch selection).
  // Destructure current first so the dep is a stable string, not a property access.
  const { current: currentMode } = mode
  const sectionCtx = useMemo(
    () => ({ ...rawSectionCtx, timeMode: currentMode }),
    [rawSectionCtx, currentMode],
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

  const vars = useMemo(
    () => page.vars
      ? evalVarMap(page.vars, { filterParams: mergedFilterParams, vars: {}, stores, pageStoreKey: page.storeKey })
      : {} as Record<string, unknown>,
    [page.vars, page.storeKey, mergedFilterParams, stores],
  )

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
    <FiltersProvider value={filtersCtx}>
      <GlobalStateProvider>
        <PageStoreProvider store={pageStore}>
          <ModeProvider value={modeCtx}>{content}</ModeProvider>
        </PageStoreProvider>
      </GlobalStateProvider>
    </FiltersProvider>
  )
})

// ── NodePageRenderer — public API ─────────────────────────────────────

export function NodePageRenderer({ page }: { page: NodePageConfig }): ReactNode {
  return (
    <FilterProvider>
      <NodePageRendererInner page={page} />
    </FilterProvider>
  )
}
