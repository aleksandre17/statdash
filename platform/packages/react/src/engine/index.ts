// ── @statdash/react/engine — Public API ────────────────────────────────
//
//  JSON-driven rendering engine — app-agnostic statistical dashboard renderer.
//
//  Architecture (Grafana/Builder.io/Retool/AppSmith patterns):
//    nodeRegistry    — type+variant → shell dispatch
//    registerSlice() — OCP extension point: new type = zero engine change
//    renderNode()    — free function: engine entry point
//
//  Usage:
//    import { NodePageRenderer, nodeRegistry } from '@statdash/react/engine'
//    import type { NodePageConfig, NodeDef, RenderContext } from '@statdash/react/engine'
//
//  Extension:
//    import { registerSlice } from '@statdash/react/engine'
//    registerSlice(mySlice)   // done. Zero other changes.
//

// ── Types ─────────────────────────────────────────────────────────────
export type {
  ViewParams,
  NodeBase,
  NodeTypeMap,
  NodeDef,
  RenderContext,
  ChildrenArg,
  SlotChildren,
  NodeRenderer,
  // slice taxonomy
  SliceCategory,
  NodeSliceMeta,
  PageSliceMeta,
  PanelSliceMeta,
  ChromeSliceMeta,
  ChromeSlotConfig,
  ChromeEntry,
  FilterControlMeta,
  SliceMeta,
  SlotDef,
  PropertyGroup,
  ValidationError,
  PropFieldType,
  PropFieldSource,
  PropFieldOption,
  PropFieldValidation,
  PropField,
  PropSchema,
  VariantDef,
  VariantSchema,
  LocaleString,
  PageConfigBase,
  PagePresentation,
  VarExpr,
  NodePageConfig,
  // N41: app-tier auth context for RBAC visibility
  AuthContext,
  // engine-owned node types (still accessible via @statdash/react/engine)
  FilterBarNode,
  // pipeline + display types (re-exported from @statdash/engine for shell use)
  TransformStep,
  FieldConfig,
  DataLinkDef,
  ResolvedLink,
  VarMap,
}                                  from './types'
export { VIEW_DEFAULTS }           from './types'

// ── Core classes ──────────────────────────────────────────────────────
export { NodeRegistry, CAPS }                        from './NodeRegistry'
export type { RegistryManifest, NodeCap, Cap }       from './NodeRegistry'

// ── Chart renderer registry (Grafana PanelPlugin pattern) ─────────────
export { ChartRendererRegistry, chartRendererRegistry } from './ChartRendererRegistry'
export type { ChartRendererProps }                      from './ChartRendererRegistry'

// ── Dispatch API ──────────────────────────────────────────────────────
export { renderNode }              from './renderNode'

// ── Router scroll parity — reset scroll to top (or a cross-page anchor) on
//  route change, so a soft-nav renders at the same scroll position as a hard
//  load. Mount once inside the Router. See RouteScrollManager for the why.
export { RouteScrollManager }      from './RouteScrollManager'

// ── Registry composition — look up a shell by name, render it (Option D) ──
//  <NodeView type="chart" def={…} ctx={…} />   — high-level JSX composition
//  nodeRegistry.getShell(type, variant?)        — low-level renderer lookup
export { NodeView }                from './NodeView'
export type { NodeViewProps }      from './NodeView'

// ── Constructor form seam — schema-driven property panel ──────────────────
//  describeApp()             → full Constructor manifest (palette + schemas + …)
//  propSchemaToJsonSchema()  → PropSchema → JSON Schema Draft-7 (external forms)
//  <PropSchemaForm/>         → render a property form FROM a PropSchema (Pattern D)
//  A new node type gets its Constructor form for free — schema is the SSOT.
export { describeApp }                       from './constructor'
export type { AppManifest }                  from './constructor'
export { propSchemaToJsonSchema, propSchemaToSubSchema, DRAFT_07, DRAFT_2020_12 } from './propSchemaToJsonSchema'
export type { JsonSchemaObject, JsonSubSchema, JsonSchemaProperty } from './propSchemaToJsonSchema'
// ── Whole-config JSON Schema generator (ADR §7.7) — the wire contract ──────
//  Composes describeApp() into a Draft-2020-12 document; emitted as a build
//  artifact at packages/contracts/schema/page-config.schema.json.
export { generatePageConfigSchema, PAGE_ROOT_TYPES } from './generatePageConfigSchema'
export type { PageConfigSchema }                     from './generatePageConfigSchema'
export { PropSchemaForm }                    from '../components/PropSchemaForm'
export type { PropSchemaFormProps, FieldRenderProps } from '../components/PropSchemaForm'
// ── Authoring config-semantics SSOT (P1) — re-exported from @statdash/engine ──
//  The ONE dot-path reader/writer + the ONE PropField.showWhen evaluator, so the
//  Constructor (apps/panel) consumes them via @statdash/react/engine and never
//  forks a second copy. (DESIGN-authoring-schema-ssot §4 P1.)
export { getAtPath, setAtPath, evalShowWhen } from '@statdash/engine'
export { resolveNodeRows, resolveStore } from './resolveNodeRows'
export { resolvePreliminary }      from './resolvePreliminary'
// ── Panel title-badge seam — the reusable PANEL_TITLE_BADGE ritual ────────
//  usePanelTitleBadge(ctx, def, nodeType) → memoized badge node | undefined.
//  Folds resolvePreliminary + useExtensions(PANEL_TITLE_BADGE) so every panel
//  shell consumes ONE capability instead of re-deriving the badge inline.
export { usePanelTitleBadge }      from './usePanelTitleBadge'
export { useNodeStream }           from './useNodeStream'
// ── KPI warm seam — async-store-safe KpiSpec[] → KpiDef[] resolution ───────
//  useKpiRows(specs, ctx) gives the kpi-strip read surface the SAME Cache-Aside
//  warm-then-read treatment useNodeRows gives the DataSpec surface — warming the
//  year-1 comparison period a 'yoy' KPI reads (extractKpiRequirements, core) so
//  interpretKpis' querySync is never cold against an async store.
export { useKpiRows }              from './useKpiRows'

// ── Cross-filter interaction seam — the ONE gesture→selection adapter ─────
//  useNodeInteractions(def, ctx).emit(trigger, row) routes EVERY surface's
//  selection gesture (chart point:click, table row:click, map selection:change)
//  through the single CommandBus write point via the pure applySelection reducer.
//  No shell wires selection itself (FF-XF-ONE-WRITE-POINT).
export { useNodeInteractions, resolveActionField } from './useNodeInteractions'
export type { NodeInteractions }   from './useNodeInteractions'
export type {
  NodeEventTrigger,
  NodeEventHandler,
  NodeAction,
  FilterAction,
  ActionField,
  SelectionMode,
}                                  from './node-events'

// ── Shell UI hooks — app-agnostic, reusable by ANY shell ──────────────────
//  useCollapsible — disclosure state + header a11y/keyboard contract (accordion,
//    panel, drawer, section). useViewToggle — role-tagged sibling-children view
//    switch (chart/table), persisted in GlobalState under viewStateKey(ns, id).
//    accentStyle — per-node `color → { '--sc' }` override of the page cascade.
export { useCollapsible }          from './hooks/useCollapsible'
export type { Collapsible, CollapsibleHeadProps } from './hooks/useCollapsible'
export { useDisclosure }           from './hooks/useDisclosure'
export type { Disclosure }         from './hooks/useDisclosure'
export { useViewToggle }           from './hooks/useViewToggle'
export type { ViewToggle }         from './hooks/useViewToggle'
export { viewStateKey }            from './hooks/viewStateKey'
export { accentStyle }             from './hooks/accentStyle'
// useContainerVisible — laid-out-container gate. Any renderer that measures its
// own DOM box at mount (ApexCharts' SVG sizing is the motivating case — a
// 0×0/detached box produces NaN transforms) gates its mount on `visible`
// instead of re-deriving the clientWidth/offsetParent check inline.
export { useContainerVisible }      from './hooks/useContainerVisible'
export type { ContainerVisible }    from './hooks/useContainerVisible'
// ── Node template resolution — the ONE canonical shell seam ───────────────
//  resolveNodeTemplate(tpl, sectionCtx, params) — pure, reusable in non-hook spots.
//  useNodeTemplate(ctx) → resolve(tpl?) binds the canonical { ...filterParams, ...vars }
//  param merge so NO shell hand-rolls the merge or the `{`-guard.
export { resolveNodeTemplate, useNodeTemplate } from './hooks/useNodeTemplate'

// ── Registries ────────────────────────────────────────────────────────
export { ChromeRegistry, chromeRegistry, NullChromeSlot } from './chromeRegistry'
export { ChromeSlot }                                      from './ChromeSlot'
export { FilterControlRegistry, filterControlRegistry }   from './filterControlRegistry'
export type { FilterControlSlice, FilterCodec }           from './filterControlRegistry'
export { SkeletonRegistry, skeletonRegistry }             from './skeletonRegistry'
export type { SkeletonFn }                                from './skeletonRegistry'

// ── DataSource manifest factory ───────────────────────────────────────
export { registerStoreBuilder, buildStoreManifest, registeredKinds } from './storeManifest'
export {
  registerStoreCapabilities, getStoreCapabilities, getSourceMetadata, testSource,
}                                                   from './storeManifest'
export type { StoreBuilderFn, StoreCapabilities }   from './storeManifest'

// ── Slice registration hub ─────────────────────────────────────────────
export { registerSlice }               from './registerSlice'
export type { RegistrableSlice, NodeSliceExport, ChromeSliceExport } from './registerSlice'

// ── Singleton registry ────────────────────────────────────────────────
export { nodeRegistry } from './register-all'

// ── Frame system — page frame provider + hook ─────────────────────────
export { FrameProvider, usePageFrame }    from '../context/FrameContext'

// ── Chrome override — per-page chrome slot overrides ─────────────────
export { ChromeOverrideProvider, useChromeOverrides } from '../context/ChromeOverrideContext'

// ── Chrome resolution — 4-layer layout engine ─────────────────────────
export { resolveChrome }                              from './resolveChrome'
export type { ChromeLayout, ResolvedChromeEntry }     from './resolveChrome'
export { ChromeRegion }                               from './ChromeRegion'

// ── Chrome slot config — per-instance config via hooks ───────────────
export { ChromeSlotConfigProvider, useSlotConfig }    from '../context/ChromeSlotConfigContext'

// ── Filter context hooks ───────────────────────────────────────────────
export { useFiltersContext, FiltersProvider } from '../context/FiltersContext'
export type { FiltersCtx }                   from '../context/FiltersContext'

// ── Layout item context — zero-DOM grid/flex placement for child shells ──
export { LayoutItemProvider, useLayoutItem, mergePlacement } from './layoutItemContext'

// ── Wrap style context — distribute NodeStyles from WrapNode to children ──
export { WrapStyleContext, useWrapStyle } from './wrapStyleContext'

// ── Node status — page-scoped data-integrity publish/subscribe (AR-39/AR-40) ──
export { NodeStatusProvider, useNodeStatusScope, useReportNodeStatus, useNodeStatusAggregate } from './NodeStatusContext'
export type { IntegrityStatus, NodeStatusAggregate } from './NodeStatusContext'

// ── Shell factory — abstract base for all NodeRenderer implementations ──
export { defineShell }        from './defineShell'
export type { ShellProps }    from './defineShell'

// ── Variant seam — declared variants → data-attrs / Constructor PropFields ──
//  variantPropSchema(meta.variants) → PropField[] (mirrors presentationPropSchema):
//  variants are Constructor-authorable + flow into generatePageConfigSchema.
//  The resolveVariants resolver itself lives in @statdash/styles (beside resolveViewState).
//  nodeSchemaWithVariants is the ONE schema-folding SSOT every registration path
//  (registerSlice, the emit-schema tool, schema fitness) routes through.
export { variantPropSchema, nodeSchemaWithVariants } from './variant-meta'

// ── Middleware — AOP interceptors for render pipeline (Gap 10) ─────────
export { middlewareRegistry }         from './middleware/registry'
export { composeMiddleware }          from './middleware/compose'
export type { RenderMiddleware }      from './middleware/types'

// ── Events — typed pub/sub cross-node communication (Gap 6) ───────────
export { EventBus }                   from '../events/EventBus'
export type { PlatformEventMap, EventType } from '../events/events'

// ── Node status — publish 'node:status' on the bus (Pattern E seam) ───
//  Foundation for the deferred NodeStatusContext (SectionShell ADR): panels
//  adopt useNodeStatus one at a time; the aggregator lands with its first consumer.
export { useNodeStatus, deriveNodeStatus } from './useNodeStatus'
export type { NodeStatus }                 from './useNodeStatus'

// ── Global State — cross-page reactive state (Gap 11) ─────────────────
export { GlobalStateProvider, useGlobalStore, useGlobalVar } from '../context/GlobalState'

// ── Var evaluation — shared util for page-level and node-level vars ────
export { evalVarMap }                 from './evalVarMap'

// ── Page var types — Crumb structural shape ───────────────────────────
//
//  Crumb is the structural shape of ctx.navContext.crumbs — part of the GENERIC
//  RenderContext contract consumed by page shells (PageHeaderShell), so it lives
//  in the app-agnostic engine. The runtime guard + the projection of a page's
//  crumbs live WITH the crumbs projector (@statdash/plugins), behind the
//  presentation registry [N-ADR-0029 v2].
//
export type { Crumb }      from './pageVars'

// ── Presentation-Projection Registry [N-ADR-0029 v2] ──────────────────
//
//  The open registry the renderer iterates generically. Concrete projectors
//  (color → --sc, crumbs → navContext.crumbs) live in @statdash/plugins and
//  register at app boot. The engine knows the protocol (evaluate → project),
//  never a concern. A new concern = a new registration, ZERO renderer edits.
//
export type {
  PresentationProjector,
  PresentationSink,
  ProjectorEvalCtx,
  ProjectedValue,
  EvalExpr,
}                                       from './presentation'
export {
  registerPresentationProjector,
  listPresentationProjectors,
  presentationPropSchema,
  projectPresentation,
}                                       from './presentation'

// ── Nav utils — section nav extraction + scroll offset ────────────────
export { stickyOffset, extractNavSectionsFromChildren, extractNavSections } from './navUtils'
export type { NavSection }            from './navUtils'

// ── Style system — types, resolvers, adapters (re-exported from @statdash/styles) ──
export type { NodeStyles, ResponsiveVal, ResolvedResponsive, StyleValue, StyleAttrs, BodyStyleAttrs } from '@statdash/styles'
export {
  resolveResponsive,
  parseStyleValue,
  isAspectRatio,
  applyNodeStyles,
  applyPanelStyles,
  applyViewStyles,
  applyContainerVars,
  resolveColumns,
  resolveLayoutItem,
  resolveViewState,
  mergeStyles,
  overrideStyles,
}                                                                                           from '@statdash/styles'

// ── React components ──────────────────────────────────────────────────
export { NodePageRenderer } from './SiteRenderer'