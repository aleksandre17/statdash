// ── Engine Types — Context layer ──────────────────────────────────────
//
//  Split from the former monolithic types.ts. This file owns the RENDER
//  vocabulary threaded through the tree:
//    RenderContext · SlotChildren · ChildrenArg · NodeRenderer
//
//  Renderer contract (Builder.io/Grafana standard):
//    Engine traverses the node tree — NOT the renderer.
//    Renderer receives pre-rendered children: ReactNode.
//    Renderer handles layout only — never dispatches children itself.
//    ctx.view carries parent view params so children (e.g. Chart) can
//    apply legend/tooltip overrides without the renderer knowing.
//
//  Key principle: Any node renders recursively at N levels.
//    Engine calls renderNode(child) — renderer NEVER does.
//

import type { ReactNode }        from 'react'
import type {
  SectionContext,
  DataStore,
  DataRow,
  SelectOption,
  ChipOption,
  Effect,
  PerspectiveContext,
  FieldConfig,
  DataLinkDef,
  ResolvedLink,
}                                from '@statdash/engine'
import type { EventBus }         from '../../events/EventBus'
import type { PlatformEventMap } from '../../events/events'
import type { CommandBus }       from '../commands/CommandBus'
import type { NavSection }       from '../navUtils'
import type { ViewParams, NodeDef } from './node'
import type { AuthContext }      from './auth'
import type { Crumb }            from '../pageVars'
import type { Container }        from '../di/Container'
import type { ExtensionRegistry } from '../extensions/ExtensionRegistry'

// ── RenderContext — threaded through the render tree ──────────────────
//
//  Two conceptually distinct halves — kept in one interface for threading
//  convenience, but the seam is explicit:
//
//  A) SERIALIZABLE DATA — safe to JSON.stringify, snapshot, diff, or pass
//     to the Constructor. These fields carry current filter/locale/mode state
//     and pre-resolved display values. NO functions.
//
//  B) RUNTIME SERVICES — function references created once by SiteRenderer,
//     closed over React state. NOT serializable. Shells call these but never
//     store or serialize them. These are the service-locator half of ctx.
//     (Grafana PanelData vs PanelPlugin services split — same seam.)
//
export interface RenderContext {
  // ── A: Serializable data ──────────────────────────────────────────────
  sectionCtx:    SectionContext
  stores:        Record<string, DataStore>
  pageStoreKey?: string
  filterParams:  Record<string, unknown>
  vars:          Record<string, unknown>
  locale:        string
  fallbackLocale: string
  /** URL param of the page's conventional perspective axis (PerspectiveAxis key). */
  perspectiveKey: string
  /** Active-perspective triad ({ current, available, set }) for the page axis. */
  perspective:   PerspectiveContext
  /**
   * Resolved identity for RBAC visibility [N41]. Injected by the app tier;
   * absent ⇒ anonymous (no roles). Read by renderNode to enforce
   * node.visibleToRoles. Serializable (no functions) — part of the "A" half.
   */
  auth?:         AuthContext
  paramOptions?: number[] | SelectOption[] | ChipOption[]
  effects:       Effect[]
  rows?:         DataRow[]
  /** Active UI theme — shells may adapt contrast/colour (N44). */
  theme?:        'default' | 'high-contrast'
  view?:         ViewParams
  /** Cascaded field display config — inherited from nearest ancestor node. */
  fieldConfig?:  FieldConfig
  /**
   * Bridge for InnerPageShell — populated by SiteRenderer, consumed by the
   * inner-page shell to render InnerLayout (sidebar + section nav).
   * packages/react stays agnostic: no InnerLayout import here.
   */
  navContext?: {
    sections:       NavSection[]
    perspectiveKey: string
    crumbs?:        Crumb[]
  }

  // ── B: Runtime services (functions — NOT serializable) ────────────────
  /**
   * Extension point registry — plugins contribute into named slots via
   * ExtensionRegistry.contribute(point, contribution). Shells resolve
   * contributions with useExtensions(ctx.extensions, POINT, host).
   * Created once by NodePageRenderer; default is an empty registry so
   * shells that call useExtensions always get a valid (possibly empty) result.
   */
  extensions:    ExtensionRegistry
  /**
   * UI component DI container — use ctx.ui.PanelLayout, ctx.ui.EmptyState, etc.
   * Defaults are the platform's built-in components; NodePageRenderer accepts
   * optional overrides that are spread onto the defaults at assembly time.
   */
  ui:            Container
  /** Set a filter param — closes over React state, triggers re-render. */
  set:           (key: string, val: unknown) => void
  /** Recursive renderer — creates child ReactNodes on demand. */
  renderNode:    (node: NodeDef, ctxOverride?: Partial<RenderContext>) => ReactNode
  /**
   * Resolve DataLinks for a clicked row → navigate or open context menu.
   * Created by SiteRenderer, closes over locale + filterParams.
   */
  resolveLinks:  (links: DataLinkDef[], row: Record<string, unknown>) => ResolvedLink[]
  /** Typed pub/sub for cross-node communication (Grafana EventBus pattern). */
  eventBus:      EventBus<PlatformEventMap>
  /**
   * Typed command bus — all platform state mutations flow through here (CQS).
   * Replaces direct calls to ctx.set / ctx.perspective.set in shells.
   * Strangler-Fig: ctx.set and ctx.perspective remain until shells migrate.
   */
  bus:           CommandBus
}

// ── SlotChildren + ChildrenArg ────────────────────────────────────────
//
//  SlotChildren — typed children for a single named slot (Builder.io slots pattern).
//    renderChild(i) — lazy: renderNode called on first access, cached thereafter.
//    Used by shells that want selective rendering (e.g. TabsShell: only active tab).
//
//  ChildrenArg — full children descriptor passed to every shell.
//    rendered    — lazy proxy: renderNode called on first index/method access.
//                  Backward-compatible: shells using rendered[i] / rendered.map()
//                  get the same output, but renderNode is deferred until access.
//    renderChild — same lazy cache as rendered (alias for slots['primary'].renderChild).
//    slots       — named slot access by SlotDef key (multi-slot nodes).
//

export type SlotChildren = {
  /** Raw NodeDef array for this slot. */
  defs:        NodeDef[]
  /** Lazy render: renderNode(defs[i], ctx) called on first access, cached. */
  renderChild: (i: number) => ReactNode
}

export type ChildrenArg = {
  /** Flat list of all primary-slot child defs (after transparent expansion). */
  defs:        NodeDef[]
  /**
   * Lazy-rendered array — renderNode called on first index/method access.
   * Proxy: rendered[i], rendered.map(), rendered.filter() all trigger lazy compute.
   * Backward-compatible: shells using rendered[i] or rendered.map() unchanged.
   */
  rendered:    ReactNode[]
  /** Lazy render of primary slot child i (same cache as rendered). */
  renderChild: (i: number) => ReactNode
  /**
   * Named slot access — populated from SlotDef registry.
   * If no SlotDef registered: empty object (falls back to rendered/renderChild).
   * Usage: children.slots['content'].renderChild(activeIndex)
   */
  slots:       Record<string, SlotChildren>
}

export type NodeRenderer<T extends { type: string } = { type: string }> = (
  def:      T,
  ctx:      RenderContext,
  children: ChildrenArg,
) => ReactNode
