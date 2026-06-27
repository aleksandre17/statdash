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
//  Page presentation (color, breadcrumbs, …) is applied generically through the
//  presentation-projector registry [N-ADR-0029 v2]: each registered projector
//  evaluates its contribution and projects it into a sink (CSS custom properties
//  on a wrapper div; a nav patch merged into navContext). The renderer names no
//  concern — a new presentation capability is a registration, not a renderer edit.
//

import React, { useCallback, useMemo, memo, type ReactNode } from 'react'
import {
  useFilter, FilterProvider,
  useStores, useFilterState,
  useLocale, useI18n,
  PageStoreProvider,
  useModeContext, ModeProvider,
} from '@statdash/react'
import { GlobalStateProvider }         from '../context/GlobalState'
import { applyEffects, resolveDataLinks } from '@statdash/engine'
import { parsePerspectiveAxes, scopeCtxByPerspective,
         perspectiveOwnedParamKeys } from '@statdash/engine'
import type { ModeId }                from '@statdash/engine'
import { FiltersProvider }             from '../context/FiltersContext'
import { evalVarMap }                  from './evalVarMap'
import { EventBus }                    from '../events/EventBus'
import type { PlatformEventMap }       from '../events/events'
import { renderNode as renderNodeFn }  from './renderNode'
import { extractNavSectionsFromChildren } from './navUtils'
import { projectPresentation }         from './presentation'
import type { PresentationSink, ProjectorEvalCtx } from './presentation'
import type { VarExpr }                from './types/node'
import type { DataLinkDef, DimVal }   from '@statdash/engine'
import type { NodeBase, RenderContext, NodePageConfig } from './types'
import { createDefaultUI }            from './createDefaultUI'
import type { Container }             from './di/Container'
import { ExtensionRegistry }          from './extensions/ExtensionRegistry'
import { DefaultCommandBus }          from './commands/CommandBus'
import type { CommandBus }            from './commands/CommandBus'
import { devLoggerMiddleware }        from './commands/middleware/devLogger'

/**
 * ContainerSetup — caller-supplied function that adds overrides to the
 * platform-default Container. Fully typed: callers call c.provide(TOKEN, value)
 * and the token type constrains the value — no correlated-union cast needed.
 */
export type ContainerSetup = (c: Container) => void

// ── NodePageRendererInner — component with hook access ─────────────────
//
//  memo(): page prop is stable (same object reference from PageLoader state).
//  Prevents re-renders when FilterProvider re-renders due to useLocation /
//  useSearchParams on navigation — only context value changes (filter interactions)
//  can trigger re-renders here, not parent re-renders from navigation.
//
const NodePageRendererInner = memo(function NodePageRendererInner({
  page,
  uiSetup,
  extensionsIn,
  onNavigate,
}: {
  page:          NodePageConfig
  uiSetup?:      ContainerSetup
  extensionsIn?: ExtensionRegistry
  /**
   * Navigation handler for nav:drill commands.
   * SiteRenderer is not inside a Router context, so navigation is provided by
   * the app layer (e.g. useNavigate() result, or a router adapter).
   * When absent, nav:drill throws — register a handler via NodePageRenderer.onNavigate.
   */
  onNavigate?:   (href: string, target: 'page' | 'url' | 'external') => void
}): ReactNode {
  const stores         = useStores()
  const locale         = useLocale()
  const { fallbackLocale } = useI18n()

  // Resolved once per page — used for vars, PageStoreContext, and Tier 3 default resolution.
  const pageStore = useMemo(
    () => stores[page.storeKey ?? Object.keys(stores)[0]] ?? null,
    [stores, page.storeKey],
  )

  // ── Perspective ownership (P4.5 (c)) — computed BEFORE useFilterState ─────────
  //  The default-resolution gate now follows PERSPECTIVE ownership (not bar
  //  visibility) for params an active timeBinding owns. We need the axes + active id
  //  BEFORE the hook resolves defaults, so they are derived here from the page config
  //  + the URL filter state directly (timeModeKey = the legacy context.timeMode param
  //  ?? 'mode' — the same value useFilterState returns). Empty ownership (no axis / no
  //  timeBinding — an un-migrated page) ⇒ the gate reduces to the legacy bar branch exactly.
  const { state, set: filterSet, setMany } = useFilter()

  const timeModeKeyPre = page.filterSchema?.context?.timeMode ?? 'mode'
  const axes = useMemo(
    () => parsePerspectiveAxes({
      perspectives:  page.perspectives,
      modeOrder:     page.modeOrder,
      timeModeParam: timeModeKeyPre,
    }),
    [page.perspectives, page.modeOrder, timeModeKeyPre],
  )

  const ownership = useMemo(() => {
    const perspectiveState = { [timeModeKeyPre]: state[timeModeKeyPre] ?? '' }
    return perspectiveOwnedParamKeys(axes, perspectiveState)
    // active id falls back to perspectives[0] inside activeDefs when state is unset.
  }, [axes, timeModeKeyPre, state])

  const {
    ctx: rawSectionCtx,
    raw,
    timeModeKey,
    effects,
    bars,
  } = useFilterState(page.filterSchema ?? null, pageStore, ownership)

  const filtersCtx = useMemo(
    () => ({ bars, timeModeKey, effects }),
    [bars, timeModeKey, effects],
  )

  const modeList   = useMemo(() => page.modeOrder ?? [], [page.modeOrder])
  const mode       = useModeContext(timeModeKey, modeList)

  // ── Perspective axis [VISION #3 / P1] ─────────────────────────────────────
  //  `axes` is parsed above (it now ALSO feeds the P4.5 perspective-ownership gate
  //  threaded into useFilterState); `timeModeKey` returned by the hook === the
  //  pre-hook `timeModeKeyPre`, so the single parse is canonical.

  // Bridge: sectionCtx.timeMode = mode.current (Postel — legacy template
  // readers still consult it until P6). The active perspective id now ALSO flows
  // through the ctx.perspectiveState SSOT (HIGH-3): the ONE source the visibility
  // gate + the SSR walkers read. `perspectiveState[timeModeKey] = mode.current` —
  // mode.current is itself the URL param value (useModeContext reads FilterContext),
  // so the SSOT is seeded from the SAME source ModeContext reads (one source).
  // Destructure current first so the dep is a stable string, not a property access.
  const { current: currentMode } = mode
  const sectionCtx = useMemo(
    () => {
      const perspectiveState = { [timeModeKey]: currentMode }
      const withState: typeof rawSectionCtx = {
        ...rawSectionCtx,
        timeMode: currentMode,
        perspectiveState,
      }
      // Scope ctx.dims by the active perspective's timeBinding BEFORE resolution —
      // the declarative replacement for the legacy imperative time-mode. Identity
      // when no axis / no scope.timeBinding (legacy pages, until P5 authors it).
      return scopeCtxByPerspective(withState, axes, perspectiveState)
    },
    [rawSectionCtx, currentMode, timeModeKey, axes],
  )

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

  // One EventBus per page — created once, survives filter changes (same ref).
  const eventBus = useMemo(() => new EventBus<PlatformEventMap>(), [])

  // Extensions registry — caller-supplied or a fresh empty registry per page.
  // An empty registry is a safe default: useExtensions always returns [].
  const extensions = useMemo(
    () => extensionsIn ?? new ExtensionRegistry(),
    [extensionsIn],
  )

  const resolveLinks = useCallback(
    (links: DataLinkDef[], row: Record<string, unknown>) =>
      resolveDataLinks(links, row as Record<string, DimVal>, mergedFilterParams, locale, fallbackLocale),
    [mergedFilterParams, locale, fallbackLocale],
  )

  // CommandBus — wires platform state mutations to their React-state closures.
  // Recreated when handler deps change (filterSet, setMany, timeModeKey, state, effects).
  // nav:drill delegates to the caller-supplied onNavigate (app layer provides router).
  // data:export is a stub — shells can dispatch for programmatic export; ExportBar
  // retains its own download logic untouched.
  const bus = useMemo((): CommandBus => {
    const b = new DefaultCommandBus()
    b.handle('filter:set',     ({ key, value }) => filterSet(key, value))
    b.handle('filter:setMany', ({ values })     => setMany(values))
    b.handle('filter:clear',   ({ key })        => filterSet(key, ''))
    b.handle('mode:set',       ({ id })         => applyEffects(timeModeKey, id, state, effects, setMany))
    b.handle('nav:drill',      ({ href, target }) => {
      if (onNavigate) {
        onNavigate(href, target)
      } else if (target === 'external') {
        window.open(href, '_blank', 'noopener,noreferrer')
      } else {
        // No router adapter supplied — log a warning rather than silently drop.
        console.warn(`[command] nav:drill: no onNavigate handler. href="${href}" target="${target}"`)
      }
    })
    b.handle('data:export', ({ format, rows, meta }) => {
      // Stub — shells may dispatch for programmatic export.
      // ExportBar's download logic is independent and unaffected.
      console.info('[command] data:export', format, rows.length, 'rows', meta)
    })
    if (import.meta.env.DEV) b.use(devLoggerMiddleware)
    return b
  }, [filterSet, setMany, timeModeKey, state, effects, onNavigate])

  // Container: platform defaults, then caller overrides applied via uiSetup.
  // Fully typed — callers call c.provide(TOKEN, value); token type constrains value.
  const uiContainer = useMemo(() => {
    const c = createDefaultUI()
    uiSetup?.(c)
    return c
  }, [uiSetup])

  // ── Presentation projection [N-ADR-0029 v2] ─────────────────────────────
  //
  //  The renderer is a GENERIC visitor over the presentation-projector registry.
  //  It names NO presentation concern: it runs every registered projector over
  //  `page.presentation` and folds each into a generic sink (cssVars → wrapper
  //  div; nav → navContext). A new concern is a new registration in
  //  @statdash/plugins, with ZERO edits to this file.
  //
  //  Projectors reuse the SAME evalVarMap / VarExpr machinery via `evalOne`, so
  //  data-driven contributions keep working.
  //
  const evalOne = useCallback(
    (e: VarExpr): unknown =>
      evalVarMap({ v: e }, { filterParams: mergedFilterParams, vars: {}, stores, pageStoreKey: page.storeKey }).v,
    [mergedFilterParams, stores, page.storeKey],
  )

  const sink = useMemo<PresentationSink>(() => {
    const evalCtx: ProjectorEvalCtx = {
      filterParams: mergedFilterParams,
      stores,
      pageStoreKey: page.storeKey,
    }
    return projectPresentation(page.presentation, evalOne, evalCtx)
  }, [page.presentation, page.storeKey, mergedFilterParams, stores, evalOne])

  const baseCtx: Omit<RenderContext, 'renderNode'> = {
    sectionCtx,
    stores,
    pageStoreKey: page.storeKey,
    filterParams: { ...mergedFilterParams, ...vars },
    set,
    vars,
    locale,
    fallbackLocale,
    timeModeKey,
    effects,
    mode:         modeCtx,
    extensions,
    eventBus,
    bus,
    resolveLinks,
    // Merge the generic nav patch — the renderer does NOT know which nav fields
    // (e.g. crumbs) a projector contributed; it spreads the sink's nav bag.
    navContext:   { sections: navSections, timeModeKey, ...sink.nav },
    ui:           uiContainer,
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

  // Apply the generic CSS-var bag on a wrapper div. The renderer does NOT know
  // which custom properties a projector set (e.g. the page-color var) — it
  // spreads sink.cssVars. Shells read the resulting custom properties via the
  // CSS cascade. No wrapper when no projector contributed a CSS var.
  const pageContent = Object.keys(sink.cssVars).length
    ? <div style={sink.cssVars as React.CSSProperties}>{content}</div>
    : content

  return (
    <FiltersProvider value={filtersCtx}>
      <GlobalStateProvider>
        <PageStoreProvider store={pageStore}>
          <ModeProvider value={modeCtx}>{pageContent}</ModeProvider>
        </PageStoreProvider>
      </GlobalStateProvider>
    </FiltersProvider>
  )
})

// ── NodePageRenderer — public API ─────────────────────────────────────

export function NodePageRenderer({
  page,
  ui,
  extensions,
  onNavigate,
}: {
  page: NodePageConfig
  /**
   * Optional Container setup — called with the platform-default Container so
   * callers can provide overrides: `ui={(c) => c.provide(PANEL_LAYOUT, MyPanel)}`.
   * Fully typed: TOKEN type constrains the provided value — no cast needed.
   */
  ui?:         ContainerSetup
  /**
   * Optional extension registry — plugins register contributions before the
   * page mounts; the registry is threaded into ctx.extensions for all shells.
   * Absent ⇒ an empty registry (useExtensions always returns []).
   */
  extensions?: ExtensionRegistry
  /**
   * Navigation handler for `nav:drill` commands — wired to ctx.bus.
   * SiteRenderer is not inside a Router context, so the app layer supplies this.
   * Typical usage: `onNavigate={(href, target) => navigate(href)}` where
   * `navigate` comes from `useNavigate()` in the calling app component.
   * When absent, `nav:drill` for 'external' opens a new tab; 'page'/'url'
   * logs a warning.
   */
  onNavigate?: (href: string, target: 'page' | 'url' | 'external') => void
}): ReactNode {
  return (
    <FilterProvider>
      <NodePageRendererInner page={page} uiSetup={ui} extensionsIn={extensions} onNavigate={onNavigate} />
    </FilterProvider>
  )
}
