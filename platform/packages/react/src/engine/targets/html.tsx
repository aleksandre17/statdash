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
import type { PerspectiveContext, DataStore, SectionContext } from '@statdash/engine'
import { LEGACY_MODE_PARAM }            from '@statdash/engine'
import type { NavSection }                                     from '../navUtils'
import { EventBus }                      from '../../events/EventBus'
import type { PlatformEventMap }         from '../../events/events'
import { PageStoreProvider }             from '../../context/PageStoreContext'
import { PerspectiveProvider }           from '../../context/PerspectiveContext'
import { FiltersProvider }               from '../../context/FiltersContext'
import { renderNode as renderNodeFn }    from '../renderNode'
import { projectPresentation }           from '../presentation'
import type { ProjectorEvalCtx, EvalExpr } from '../presentation'
import { evalVarMap }                    from '../evalVarMap'
import type { PagePresentation, VarExpr } from '../types/node'
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

// ── Snapshot wrapper class ────────────────────────────────────────────────
//
//  Generic, brand-neutral class on the outermost element of a static HTML
//  snapshot. Apps that want to scope snapshot CSS may override this per render
//  via `StaticRenderContext.snapshotClassName` (Law 3: no tenant literal here).
//
export const SNAPSHOT_WRAPPER_CLASS = 'statdash-snapshot'

// ── StaticRenderContext ───────────────────────────────────────────────────
//
//  The serializable half of RenderContext — no functions, no React state closures.
//  Corresponds to RenderContext's "A: Serializable data" fields.
//
//  Build this from the current page filter state for a specific snapshot:
//    { sectionCtx: { dims: { time: 2024 }, perspectiveState: { mode: 'year' }, … }, … }
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
  perspectiveKey: string
  perspective:    PerspectiveContext
  /** Visual theme for the snapshot — forwarded to `ctx.theme` and the
   *  `data-theme` attribute on the outermost element. Optional ⇒ 'default'. */
  theme?:         'default' | 'high-contrast'
  /** CSS class on the outermost snapshot element. Optional ⇒
   *  `SNAPSHOT_WRAPPER_CLASS` (brand-neutral default). Apps override to scope
   *  their own snapshot styles — no tenant literal lives in this layer (Law 3). */
  snapshotClassName?: string
  /**
   * Resolved identity for the snapshot [N41] — forwarded to `ctx.auth` so
   * `view.visibleToRoles` is enforced in static renders too. Optional ⇒
   * anonymous (no roles): a public snapshot sees only ungated nodes.
   */
  auth?:          AuthContext
  /**
   * Breadcrumb trail — a pre-resolved convenience input. `buildStaticContext`
   * folds this into the generic `presentation` bag (under the crumbs projector's
   * key) so it is projected to `ctx.navContext.crumbs` through the SAME
   * presentation-projector registry the dynamic renderer uses [N-ADR-0029 v2].
   */
  crumbs?:        { label: string; href?: string }[]
  /**
   * Section navigation — forwarded to `ctx.navContext` so InnerPageShell
   * renders the sidebar nav correctly in static snapshots.
   */
  navContext?:    { sections: NavSection[]; perspectiveKey: string }
  /**
   * Presentation-projection contributions [N-ADR-0029 v2] — the generic bag the
   * registry projects (CSS vars on the wrapper, nav patch into navContext). When
   * absent, `renderPageToHTML` projects from `page.presentation`. The legacy
   * `color`/`crumbs` convenience inputs above are folded into this by
   * `buildStaticContext`; the renderer itself names no presentation concern.
   */
  presentation?:  PagePresentation
}

// ── buildStaticContext — factory for StaticRenderContext ─────────────────
//
//  Fills in sensible snapshot defaults so callers only supply what they know.
//  All defaults match the same values renderPageToHTML uses internally when
//  fields are absent — no behaviour difference, just less boilerplate.
//
//  Minimal usage:
//    renderPageToHTML(page, buildStaticContext({
//      sectionCtx: { dims: { time: 2024 }, perspectiveState: { mode: 'year' } },
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
  // Fold the legacy pre-resolved convenience inputs into the generic
  // presentation bag [N-ADR-0029 v2]. These input field names ARE the matching
  // projector keys, so the fold is a plain spread of the defined ones — the
  // render loop never reads a concern key by name; only this input adapter does.
  const legacyPresentation: PagePresentation = {
    ...(input.color  !== undefined ? { color:  input.color  } : {}),
    ...(input.crumbs !== undefined ? { crumbs: input.crumbs } : {}),
  }
  const presentation: PagePresentation | undefined =
    input.presentation ?? (Object.keys(legacyPresentation).length ? legacyPresentation : undefined)

  const perspectiveKey = input.perspectiveKey ?? LEGACY_MODE_PARAM
  // perspective: default the active id from any seeded perspectiveState, else 'year'.
  const perspective = input.perspective ?? {
    current:   input.sectionCtx.perspectiveState?.[perspectiveKey] ?? 'year',
    available: [],
    set:       () => {},
  }
  // Seed the ctx.perspectiveState SSOT (VISION #3 / P1 — HIGH-3) so the SSR walkers
  // and the visibility gate read the SAME source the live DOM reads (one source).
  // Derived from the active id (`perspective.current`) keyed by the axis param.
  // Preserves any perspectiveState the caller already set.
  const sectionCtx: SectionContext = input.sectionCtx.perspectiveState
    ? input.sectionCtx
    : { ...input.sectionCtx, perspectiveState: { [perspectiveKey]: perspective.current } }

  return {
    // ── required ───────────────────────────────────────────────────────
    sectionCtx,
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
    perspectiveKey,
    perspective,
    crumbs:     input.crumbs,
    presentation,
    navContext: input.navContext,
    theme:      input.theme,
    auth:       input.auth,
    snapshotClassName: input.snapshotClassName,
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
 *   sectionCtx: { dims: { time: 2024 }, perspectiveState: { mode: 'year' } },
 *   stores:     { main: myStore },
 *   filterParams: { time: '2024' },
 *   locale: appLocale, fallbackLocale: 'en',
 *   perspectiveKey: 'mode',
 *   perspective: { current: 'year', available: [], set: () => {} },
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
  const bus = new EventBus<PlatformEventMap>()

  // Self-referential ctx holder — mirrors SiteRenderer to handle renderNode circularity.
  const ctxHolder = { ctx: null as unknown as RenderContext }

  // ── Presentation projection [N-ADR-0029 v2] ─────────────────────────────
  //
  //  IDENTICAL generic pass to SiteRenderer: iterate the presentation-projector
  //  registry over the page's presentation bag, fold each into a sink (cssVars →
  //  wrapper div; nav → navContext). The snapshot path names no concern.
  //
  //  evalOne mirrors evalVarMap but passes PRE-RESOLVED values (already-evaluated
  //  literals/arrays supplied by the caller, e.g. a Crumb[]) through unchanged —
  //  only true VarExpr op/ref objects are evaluated against the static context.
  //
  const evalOne: EvalExpr = (e: VarExpr): unknown => {
    const isExpression = e !== null && typeof e === 'object' && !Array.isArray(e)
    return isExpression
      ? evalVarMap({ v: e }, {
          filterParams: staticCtx.filterParams,
          vars:         {},
          stores:       staticCtx.stores,
          pageStoreKey: staticCtx.pageStoreKey,
        }).v
      : e
  }
  const projEvalCtx: ProjectorEvalCtx = {
    filterParams:      staticCtx.filterParams,
    stores:            staticCtx.stores,
    pageStoreKey:      staticCtx.pageStoreKey,
  }
  // Resolve the page's presentation bag. The snapshot `color` convenience input is
  // a render-context affordance (not a page-authored field): fold it under the
  // color projector's key when neither an explicit presentation bag nor the page's
  // own presentation.color supplies one — keeping the single-home contract (the
  // renderer names no concern; this input adapter folds by the projector key).
  const basePresentation = staticCtx.presentation ?? page.presentation
  const presentation: PagePresentation | undefined =
    staticCtx.color !== undefined && (basePresentation?.color === undefined)
      ? { ...(basePresentation ?? {}), color: staticCtx.color }
      : basePresentation
  const sink = projectPresentation(presentation, evalOne, projEvalCtx)

  // Merge the generic nav patch into navContext — the renderer does NOT know
  // which nav fields (e.g. crumbs) a projector contributed. When there is a
  // base navContext, patch it; otherwise build a minimal one only if a projector
  // contributed nav, preserving the previous "no navContext unless needed" shape.
  const navPatchKeys  = Object.keys(sink.nav)
  const staticNavContext = staticCtx.navContext
    ? { ...staticCtx.navContext, ...sink.nav }
    : navPatchKeys.length
      ? { sections: [], perspectiveKey: staticCtx.perspectiveKey, ...sink.nav }
      : staticCtx.navContext

  ctxHolder.ctx = {
    sectionCtx:     staticCtx.sectionCtx,
    stores:         staticCtx.stores,
    pageStoreKey:   staticCtx.pageStoreKey,
    filterParams:   staticCtx.filterParams,
    vars:           { ...(staticCtx.vars ?? {}) },
    locale:         staticCtx.locale,
    fallbackLocale: staticCtx.fallbackLocale,
    perspectiveKey: staticCtx.perspectiveKey,
    perspective:    staticCtx.perspective,
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

  // Apply the generic CSS-var bag on a wrapper div — the renderer does NOT know
  // which custom properties a projector set; it spreads sink.cssVars. Shells read
  // them via the CSS cascade. No wrapper when no projector contributed a CSS var.
  const innerContent = Object.keys(sink.cssVars).length
    ? createElement('div', { style: sink.cssVars as React.CSSProperties }, content)
    : content

  // Wrap with the minimum providers shells may read via context hooks.
  // FiltersContext default (empty) is fine for snapshot — no filter UI.
  // GlobalStateProvider default is a no-op store — no provider needed.
  const wrapped = createElement(
    FiltersProvider,
    { value: { bars: [], perspectiveKey: staticCtx.perspectiveKey } },
    createElement(
      PageStoreProvider,
      { store: pageStore },
      createElement(
        PerspectiveProvider,
        { value: staticCtx.perspective },
        createElement(
          'div',
          {
            className: staticCtx.snapshotClassName ?? SNAPSHOT_WRAPPER_CLASS,
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
