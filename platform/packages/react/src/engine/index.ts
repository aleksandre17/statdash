// ── @statdash/react/engine — Public API ────────────────────────────────
//
//  JSON-driven rendering engine for Geostat National Accounts Dashboard.
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
  LocaleString,
  PageConfigBase,
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
export { propSchemaToJsonSchema }            from './propSchemaToJsonSchema'
export type { JsonSchemaObject, JsonSchemaProperty } from './propSchemaToJsonSchema'
export { PropSchemaForm }                    from '../components/PropSchemaForm'
export type { PropSchemaFormProps, FieldRenderProps } from '../components/PropSchemaForm'
export { resolveNodeRows, resolveStore, resolveCompareRows } from './resolveNodeRows'
export { resolvePreliminary }      from './resolvePreliminary'
export { useNodeStream }           from './useNodeStream'

// ── Registries ────────────────────────────────────────────────────────
export { ChromeRegistry, chromeRegistry, NullChromeSlot } from './chromeRegistry'
export { ChromeSlot }                                      from './ChromeSlot'
export { FilterControlRegistry, filterControlRegistry }   from './filterControlRegistry'
export type { FilterControlSlice, FilterCodec }           from './filterControlRegistry'
export { SkeletonRegistry, skeletonRegistry }             from './skeletonRegistry'
export type { SkeletonFn }                                from './skeletonRegistry'

// ── DataSource manifest factory ───────────────────────────────────────
export { registerStoreBuilder, buildStoreManifest } from './storeManifest'
export type { StoreBuilderFn }                      from './storeManifest'

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
export { LayoutItemProvider, useLayoutItem } from './layoutItemContext'

// ── Wrap style context — distribute NodeStyles from WrapNode to children ──
export { WrapStyleContext, useWrapStyle } from './wrapStyleContext'

// ── Shell factory — abstract base for all NodeRenderer implementations ──
export { defineShell }        from './defineShell'
export type { ShellProps }    from './defineShell'

// ── Middleware — AOP interceptors for render pipeline (Gap 10) ─────────
export { middlewareRegistry }         from './middleware/registry'
export { composeMiddleware }          from './middleware/compose'
export type { RenderMiddleware }      from './middleware/types'

// ── Events — typed pub/sub cross-node communication (Gap 6) ───────────
export { EventBus }                   from '../events/EventBus'
export type { GeostatEventMap }       from '../events/events'

// ── Node status — publish 'node:status' on the bus (Pattern E seam) ───
//  Foundation for the deferred NodeStatusContext (SectionShell ADR): panels
//  adopt useNodeStatus one at a time; the aggregator lands with its first consumer.
export { useNodeStatus, deriveNodeStatus } from './useNodeStatus'
export type { NodeStatus }                 from './useNodeStatus'

// ── Global State — cross-page reactive state (Gap 11) ─────────────────
export { GlobalStateProvider, useGlobalStore, useGlobalVar } from '../context/GlobalState'

// ── Var evaluation — shared util for page-level and node-level vars ────
export { evalVarMap }                 from './evalVarMap'

// ── Page var types — Crumb shape + runtime guard ──────────────────────
//
//  isCrumbs validates the `_pageCrumbs` slot value at the SiteRenderer
//  boundary. Plugin authors building dynamic breadcrumbs import Crumb +
//  isCrumbs here.
//
//  Color is a CSS custom property (--sc) on wrapper elements — no constant.
//  Breadcrumb key '_pageCrumbs' is a plain string literal in page configs.
//
export { isCrumbs }        from './pageVars'
export type { Crumb }      from './pageVars'

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