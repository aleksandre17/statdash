// ── RenderTarget: HTML / SSR [N27] ─────────────────────────────────────
//
//  Produces a static HTML snapshot from any NodePageConfig + a snapshot context.
//  Uses the SAME renderNode() pipeline as NodePageRenderer — zero engine/shell change.
//
//  Architecture (multi-target from one config):
//    NodePageRenderer(page)             → interactive DOM (React mount)
//    renderPageToHTML(page, staticCtx)  → static HTML (bulletin · cache · PDF pipeline)
//
//  Adding a further target (PDF via Puppeteer, API JSON) follows the same seam:
//    consume this HTML (PDF) or build renderPageToJSON() (API) — no engine change.
//
//  Grafana equivalent: "Panel as image" / "Render service" — same panel config,
//  different output channel. No panel code change.
//

import React, { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup }          from 'react-dom/server'
import type { ModeContext, DataStore, SectionContext, Effect } from '@statdash/engine'
import type { NavSection }                                     from '../navUtils'
import { EventBus }                      from '../../events/EventBus'
import type { GeostatEventMap }          from '../../events/events'
import { PageStoreProvider }             from '../../context/PageStoreContext'
import { ModeProvider }                  from '../../context/ModeContext'
import { FiltersProvider }               from '../../context/FiltersContext'
import { renderNode as renderNodeFn }    from '../renderNode'
import { isCrumbs }                     from '../pageVars'
import type { RenderContext, NodeBase, NodeDef, NodePageConfig, AuthContext } from '../types'
import { createDefaultUI }              from '../createDefaultUI'
import { ExtensionRegistry }            from '../extensions/ExtensionRegistry'
import { DefaultCommandBus }            from '../commands/CommandBus'

// ── RenderTarget discriminant ─────────────────────────────────────────────
//
//  'dom'  — interactive React mount (NodePageRenderer — current default)
//  'html' — static markup snapshot (renderPageToHTML — this file)
//  'pdf'  — PDF via Puppeteer consuming the HTML target (Phase 10.2b)
//  'api'  — data JSON via extractRequirements + store resolution (Phase 10.2c)
//
export type RenderTarget = 'dom' | 'html' | 'pdf' | 'api'

// ── StaticRenderContext ───────────────────────────────────────────────────
//
//  The serializable half of RenderContext — no functions, no React state closures.
//  Corresponds to RenderContext's "A: Serializable data" fields.
//
//  Build this from the current page filter state for a specific snapshot:
//    { sectionCtx: { dims: { time: 2024 }, timeMode: 'year', … }, … }
//
export interface StaticRenderContext {
  sectionCtx:     SectionContext
  stores:         Record<string, DataStore>
  pageStoreKey?:  string
  filterParams:   Record<string, unknown>
  vars?:          Record<string, unknown>
  color?:         string
  locale:         string
  fallbackLocale: string
  timeModeKey:    string
  mode:           ModeContext
  effects:        Effect[]
  /** Visual theme for the snapshot — forwarded to `ctx.theme` and the
   *  `data-theme` attribute on the outermost element. Optional ⇒ 'default'. */
  theme?:         'default' | 'high-contrast'
  /**
   * Resolved identity for the snapshot [N41] — forwarded to `ctx.auth` so
   * `view.visibleToRoles` is enforced in static renders too. Optional ⇒
   * anonymous (no roles): a public snapshot sees only ungated nodes.
   */
  auth?:          AuthContext
  /**
   * Breadcrumb trail — forwarded to `ctx.navContext.crumbs` so
   * PageHeaderShell renders the correct breadcrumb path in static snapshots.
   */
  crumbs?:        { label: string; href?: string }[]
  /**
   * Section navigation — forwarded to `ctx.navContext` so InnerPageShell
   * renders the sidebar nav correctly in static snapshots.
   */
  navContext?:    { sections: NavSection[]; timeModeKey: string }
}

// ── buildStaticContext — factory for StaticRenderContext ─────────────────
//
//  Fills in sensible snapshot defaults so callers only supply what they know.
//  All defaults match the same values renderPageToHTML uses internally when
//  fields are absent — no behaviour difference, just less boilerplate.
//
//  Minimal usage:
//    renderPageToHTML(page, buildStaticContext({
//      sectionCtx: { dims: { time: 2024 }, timeMode: 'year' },
//      stores: { main: myStore },
//    }))
//

/**
 * Build a `StaticRenderContext` with safe snapshot defaults.
 *
 * Only `sectionCtx` and `stores` are required; all other fields have
 * sensible defaults for a static snapshot (no filter UI, no interactions).
 *
 * Override any field in the argument to customise the snapshot.
 */
export function buildStaticContext(
  input: Pick<StaticRenderContext, 'sectionCtx' | 'stores'> & Partial<Omit<StaticRenderContext, 'sectionCtx' | 'stores'>>,
): StaticRenderContext {
  return {
    // ── required ───────────────────────────────────────────────────────
    sectionCtx:     input.sectionCtx,
    stores:         input.stores,
    // ── common overrides ───────────────────────────────────────────────
    pageStoreKey:   input.pageStoreKey,
    filterParams:   input.filterParams ?? {},
    vars:           input.vars          ?? {},
    // No brand default (Law 3: engine/react is app-agnostic). undefined ⇒ the
    // shell applies its own fallback at its layer (CSS var / prop default).
    color:          input.color,
    locale:         input.locale        ?? 'en',
    fallbackLocale: input.fallbackLocale ?? 'en',
    timeModeKey:    input.timeModeKey   ?? 'mode',
    // mode: default to the sectionCtx.timeMode for consistency
    mode: input.mode ?? {
      current:   input.sectionCtx.timeMode ?? 'year',
      available: [],
      set:       () => {},
    },
    effects:    input.effects    ?? [],
    crumbs:     input.crumbs,
    navContext: input.navContext,
    theme:      input.theme,
    auth:       input.auth,
  }
}

// ── renderPageToHTML ──────────────────────────────────────────────────────

/**
 * Render a `NodePageConfig` to a static HTML string.
 *
 * Identical rendering pipeline to `NodePageRenderer` — `renderNode()` is shared.
 * Runtime services (filter set, eventBus, dataLinks) are no-ops in the snapshot.
 *
 * ```ts
 * const html = renderPageToHTML(myPage, {
 *   sectionCtx: { dims: { time: 2024 }, timeMode: 'year' },
 *   stores:     { main: myStore },
 *   filterParams: { time: '2024' },
 *   locale: appLocale, fallbackLocale: 'en',
 *   timeModeKey: 'mode',
 *   mode: { current: 'year', modes: [], set: () => {} },
 *   effects: [],
 * })
 * ```
 */
export function renderPageToHTML(
  page:      NodePageConfig,
  staticCtx: StaticRenderContext,
): string {
  const pageStore = staticCtx.stores[
    staticCtx.pageStoreKey ?? Object.keys(staticCtx.stores)[0] ?? ''
  ] ?? null

  // EventBus: functional instance — no subscribers in SSR, publish is a no-op.
  const bus = new EventBus<GeostatEventMap>()

  // Self-referential ctx holder — mirrors SiteRenderer to handle renderNode circularity.
  const ctxHolder = { ctx: null as unknown as RenderContext }

  // Merge static crumbs into navContext.crumbs (validated via isCrumbs) so
  // PageHeaderShell gets the correct breadcrumb path in static snapshots.
  const staticNavContext = staticCtx.navContext
    ? {
        ...staticCtx.navContext,
        ...(staticCtx.crumbs !== undefined && isCrumbs(staticCtx.crumbs)
          ? { crumbs: staticCtx.crumbs }
          : {}),
      }
    : staticCtx.crumbs !== undefined && isCrumbs(staticCtx.crumbs)
      ? { sections: [], timeModeKey: staticCtx.timeModeKey, crumbs: staticCtx.crumbs }
      : staticCtx.navContext

  ctxHolder.ctx = {
    sectionCtx:     staticCtx.sectionCtx,
    stores:         staticCtx.stores,
    pageStoreKey:   staticCtx.pageStoreKey,
    filterParams:   staticCtx.filterParams,
    vars:           { ...(staticCtx.vars ?? {}) },
    locale:         staticCtx.locale,
    fallbackLocale: staticCtx.fallbackLocale,
    timeModeKey:    staticCtx.timeModeKey,
    mode:           staticCtx.mode,
    effects:        staticCtx.effects,
    navContext:     staticNavContext,
    theme:          staticCtx.theme,
    auth:           staticCtx.auth,
    // Static snapshots have no plugin contributions — empty registry is correct.
    extensions:     new ExtensionRegistry(),
    ui:             createDefaultUI(),
    eventBus:       bus,
    // CommandBus: no-op instance — SSR snapshot has no state mutations.
    bus:            new DefaultCommandBus(),
    // Runtime no-ops — SSR snapshot has no interactions.
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNodeFn(n as NodeBase, o ? { ...ctxHolder.ctx, ...o } : ctxHolder.ctx),
  }

  const content = renderNodeFn(page as NodeBase, ctxHolder.ctx)

  // Scope --sc to this snapshot when a page color is present (CSS cascade).
  const innerContent = staticCtx.color
    ? createElement('div', { style: { '--sc': staticCtx.color } as React.CSSProperties }, content)
    : content

  // Wrap with the minimum providers shells may read via context hooks.
  // FiltersContext default (empty) is fine for snapshot — no filter UI.
  // GlobalStateProvider default is a no-op store — no provider needed.
  const wrapped = createElement(
    FiltersProvider,
    { value: { bars: [], timeModeKey: staticCtx.timeModeKey, effects: staticCtx.effects } },
    createElement(
      PageStoreProvider,
      { store: pageStore },
      createElement(
        ModeProvider,
        { value: staticCtx.mode },
        createElement(
          'div',
          {
            className: 'geostat-snapshot',
            'data-render-target': 'html',
            'data-theme': staticCtx.theme ?? 'default',
          },
          innerContent,
        ),
      ),
    ),
  )

  return renderToStaticMarkup(wrapped)
}
