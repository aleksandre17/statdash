// ── @geostat/react/engine — Public API ────────────────────────────────
//
//  JSON-driven rendering engine for Geostat National Accounts Dashboard.
//
//  Architecture (Grafana/Builder.io/Retool/AppSmith patterns):
//    nodeRegistry    — type+variant → shell dispatch
//    registerSlice() — OCP extension point: new type = zero engine change
//    renderNode()    — free function: engine entry point
//
//  Usage:
//    import { NodePageRenderer, nodeRegistry } from '@geostat/react/engine'
//    import type { NodePageConfig, NodeDef, RenderContext } from '@geostat/react/engine'
//
//  Extension:
//    import { registerSlice } from '@geostat/react/engine'
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
  PropFieldOption,
  PropFieldValidation,
  PropField,
  PropSchema,
  LocaleString,
  PageConfigBase,
  NodePageConfig,
  // engine-owned node types (still accessible via @geostat/react/engine)
  FilterBarNode,
  // pipeline + display types (re-exported from @geostat/engine for shell use)
  TransformStep,
  FieldConfig,
  DataLinkDef,
  ResolvedLink,
  VarMap,
}                                  from './types'
export { VIEW_DEFAULTS }           from './types'

// ── Core classes ──────────────────────────────────────────────────────
export { NodeRegistry }            from './NodeRegistry'
export type { RegistryManifest }   from './NodeRegistry'

// ── Chart renderer registry (Grafana PanelPlugin pattern) ─────────────
export { ChartRendererRegistry, chartRendererRegistry } from './ChartRendererRegistry'
export type { ChartRendererProps }                      from './ChartRendererRegistry'

// ── Dispatch API ──────────────────────────────────────────────────────
export { renderNode }              from './renderNode'
export { resolveNodeRows, resolveStore } from './resolveNodeRows'

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

// ── Global State — cross-page reactive state (Gap 11) ─────────────────
export { GlobalStateProvider, useGlobalStore, useGlobalVar } from '../context/GlobalState'

// ── Var evaluation — shared util for page-level and node-level vars ────
export { evalVarMap }                 from './evalVarMap'

// ── Nav utils — section nav extraction + scroll offset ────────────────
export { stickyOffset, extractNavSectionsFromChildren, extractNavSections } from './navUtils'
export type { NavSection }            from './navUtils'

// ── Style system — types, resolvers, adapters (re-exported from @geostat/styles) ──
export type { NodeStyles, ResponsiveVal, ResolvedResponsive, StyleValue, StyleAttrs, BodyStyleAttrs } from '@geostat/styles'
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
}                                                                                           from '@geostat/styles'

// ── React components ──────────────────────────────────────────────────
export { NodePageRenderer } from './SiteRenderer'