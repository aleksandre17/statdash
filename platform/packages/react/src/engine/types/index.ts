// ── Engine Types — public barrel ──────────────────────────────────────
//
//  Re-exports the full former types.ts surface from its split modules:
//    ./node    — ViewParams · VIEW_DEFAULTS · NodeBase · NodeTypeMap · NodeDef ·
//                PageConfigBase · NodePageConfig
//    ./context — RenderContext · SlotChildren · ChildrenArg · NodeRenderer
//    ./auth    — AuthContext [N41]
//    ./slice   — slice taxonomy + Constructor companion types (re-exported
//                from ../slice-meta)
//
//  Plus the cross-package and event re-exports the old types.ts surfaced so
//  every `from './types'` import continues to resolve unchanged.
//

// ── Node layer ─────────────────────────────────────────────────────────
export type {
  ViewParams,
  NodeBase,
  NodeTypeMap,
  NodeDef,
  PageConfigBase,
  PagePresentation,
  VarExpr,
  NodePageConfig,
}                                from './node'
export { VIEW_DEFAULTS }         from './node'

// ── Context layer ──────────────────────────────────────────────────────
export type {
  RenderContext,
  ChildrenArg,
  SlotChildren,
  NodeRenderer,
}                                from './context'

// ── Auth layer [N41] ───────────────────────────────────────────────────
export type { AuthContext }      from './auth'

// ── Slice layer (Constructor taxonomy) ─────────────────────────────────
export type {
  SliceCategory,
  SlotDef,
  PropertyGroup,
  ValidationError,
  PropFieldType,
  PropFieldSource,
  PropFieldOption,
  PropFieldValidation,
  PropField,
  PropSchema,
  ObjectMeta,
  PageSliceMeta,
  PanelSliceMeta,
  NodeSliceMeta,
  ChromeSlotConfig,
  ChromeEntry,
  ChromeSliceMeta,
  FilterControlMeta,
  SliceMeta,
  VariantDef,
  VariantSchema,
  BandDescriptor,
}                                from './slice'

// ── CoreNodeDef source types + pipeline/display types (from @statdash/engine) ──
//
//  These types originate in @statdash/engine. Re-exported here so all
//  `from './types'` imports continue to resolve without change.
//
export type { FilterBarNode, FilterSchemaInput, BarNode, ParamNode, VarMap } from '@statdash/engine'
export type { LocaleString, TransformStep, FieldConfig, DataLinkDef, DataLinkParam, ResolvedLink } from '@statdash/engine'

// ── Events — re-exported for shell use ─────────────────────────────────
export type { EventBus }        from '../../events/EventBus'
export type { PlatformEventMap, EventType } from '../../events/events'

// ── Declarative node-event handlers [N36 cross-filter] ─────────────────
export type {
  NodeEventTrigger,
  FilterAction,
  NodeAction,
  NodeEventHandler,
}                                from '../node-events'
