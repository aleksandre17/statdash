// ── Engine Types — JSON-driven rendering system ────────────────────────
//
//  Architecture (Grafana/Builder.io/Retool/AppSmith patterns):
//    named slot  → WHERE (header, kpis, sections, links)
//    type        → WHAT  (registry dispatch, recursion, portability)
//    view        → HOW/WHEN (layout · visibility · display behavior)
//    data        → DataSpec — engine layer
//
//  Three rules:
//    1. Homogeneous array → type on container, items clean
//    2. Portable/recursive → type on each node
//    3. Named slot → slot=WHERE, type=WHAT
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
//  Node types (concrete interfaces) live co-located with their shells:
//    plugins/nodes/[type]/default/[TypeName]Node.ts
//    Each augments NodeTypeMap via `declare module '@geostat/react/engine'`.
//    Engine has zero knowledge of concrete node shapes → OCP.
//

import type { ReactNode }        from 'react'
import type {
  SectionContext,
  DataStore,
  DataRow,
  VisibilityExpr,
  SelectOption,
  ChipOption,
  Effect,
  BarNode,
  ParamNode,
  FilterBarNode,
  FilterSchemaInput,
  VarMap,
  ModeContext,
  LocaleString,
  TransformStep,
  FieldConfig,
  DataLinkDef,
  ResolvedLink,
}                                from '@geostat/engine'
import type { NodeStyles }       from '@geostat/styles'
import type { EventBus }         from '../events/EventBus'
import type { GeostatEventMap }  from '../events/events'
import type { NavSection }       from './navUtils'

// ── ViewParams — display/layout/visibility configuration ──────────────

export interface ViewParams {
  width?:       'full' | 'half' | 'third'
  subtitle?:    string
  visibleWhen?: VisibilityExpr
  default?:     'chart' | 'table'
  toggle?:      boolean
  legend?:      'bottom' | 'right' | 'none'
  tooltip?:     'multi' | 'single' | 'none'
  compact?:     boolean
  defaultOpen?: boolean
  noCollapse?:  boolean
  hero?:        boolean
  exportable?:  boolean
  cols?:        string | number
  styles?:      NodeStyles
  role?:        string
  label?:       string
  position?:    string
}

// ── VIEW_DEFAULTS — Eurostat/ONS standard defaults ─────────────────────

export const VIEW_DEFAULTS: Required<Omit<ViewParams,
  'width' | 'subtitle' | 'visibleWhen' | 'defaultOpen' | 'noCollapse' |
  'hero' | 'exportable' | 'cols' | 'styles' | 'role' | 'label' | 'position'
>> = {
  default: 'chart',
  toggle:  true,
  legend:  'bottom',
  tooltip: 'multi',
  compact: false,
}

// ── NodeBase — shared base for all NodeDef members ───────────────────
//
//  Builder.io BuilderElement / Grafana PanelModel standard:
//  every registry block shares common fields.
//
export interface NodeBase {
  type:        string
  id?:         string
  variant?:    string
  data?:       import('@geostat/engine').DataSpec
  view?:       ViewParams
  storeKey?:   string

  // ── Data pipeline extensions ─────────────────────────────────────────
  /** Declarative post-processing steps applied after interpretSpec (Grafana Transform pipeline). */
  transforms?: TransformStep[]
  /** Per-field display configuration cascaded to child nodes (Grafana FieldConfig). */
  fieldConfig?: FieldConfig
  /** Node-scoped derived variables evaluated with this node's filter context (Retool Transformer). */
  vars?:       VarMap
  /** Drill-down / navigation links resolved against a clicked DataRow (Grafana DataLinks). */
  dataLinks?:  DataLinkDef[]
}

// ── NodeTypeMap — open plugin extensibility (Builder.io module augmentation) ──
//
//  Platform declares empty interface; plugins augment via `declare module`:
//    declare module '@geostat/react/engine' {
//      interface NodeTypeMap { 'section': SectionNode }
//    }
//  Empty NodeTypeMap → NodeDef = CoreNodeDef. Plugin augments → auto-extends. ✅
//  Zero packages/ change for new node types.
//
export interface NodeTypeMap {}

// ── SlotDef — typed children contract (Builder.io slots pattern) ──────
//
//  Constructor reads: which types can be dragged into this slot?
//  Engine reads: validation when loading config.
//
export interface SlotDef {
  field:    string             // node field name: 'children' | 'items'
  label:    LocaleString
  accepts?: string[]           // allowed node types; empty = any
  multi:    boolean
  min?:     number
  max?:     number
}

// ── PropertyGroup — Constructor property panel grouping (Retool/Appsmith) ──
//
//  Organises schema fields into labelled accordion sections in the
//  Constructor property panel. `fields` are JSON pointer paths into the node.
//
export interface PropertyGroup {
  label:  LocaleString
  fields: string[]
}

// ── ValidationError — per-node validation result ──────────────────────

export interface ValidationError {
  field:   string
  message: string
  level:   'error' | 'warning'
}

// ── CoreNodeDef — engine-package-owned node types ─────────────────────
//
//  These types originate in @geostat/engine, not in plugin shells, so they
//  are not co-located. Plugin shells for filter-bar / bar / param augment
//  NodeTypeMap separately to provide full type coverage.
//
export type { FilterBarNode, FilterSchemaInput, BarNode, ParamNode, VarMap } from '@geostat/engine'
export type { LocaleString, TransformStep, FieldConfig, DataLinkDef, DataLinkParam, ResolvedLink } from '@geostat/engine'
export type { EventBus }        from '../events/EventBus'
export type { GeostatEventMap } from '../events/events'

type CoreNodeDef = FilterBarNode | BarNode | ParamNode

// ── NodeDef — discriminated union of all renderable node types ─────────
//
//  CoreNodeDef: engine-package-owned types.
//  NodeTypeMap[keyof NodeTypeMap]: plugin-registered types (module augmentation).
//  Empty NodeTypeMap → NodeDef = CoreNodeDef.  Plugin augments → auto-extends. ✅
//
export type NodeDef = CoreNodeDef | NodeTypeMap[keyof NodeTypeMap]

// ── RenderContext — threaded through the render tree ──────────────────

export interface RenderContext {
  sectionCtx:    SectionContext
  stores:        Record<string, DataStore>
  pageStoreKey?: string
  filterParams:  Record<string, unknown>
  set:           (key: string, val: unknown) => void
  vars:          Record<string, unknown>
  color:         string
  crumbs?:       { label: string; href?: string }[]
  locale:        string
  fallbackLocale: string
  timeModeKey:   string
  mode:          ModeContext
  paramOptions?: number[] | SelectOption[] | ChipOption[]
  effects:       Effect[]
  rows?:         DataRow[]
  view?:         ViewParams
  renderNode:    (node: NodeDef, ctxOverride?: Partial<RenderContext>) => ReactNode

  // ── Rendering platform extensions ─────────────────────────────────────
  /** Typed pub/sub for cross-node communication (Grafana EventBus pattern). */
  eventBus:      EventBus<GeostatEventMap>
  /** Cascaded field display config — inherited from nearest ancestor node. */
  fieldConfig?:  FieldConfig
  /**
   * Resolve DataLinks for a clicked row → navigate or open context menu.
   * Created by SiteRenderer, closes over locale + filterParams.
   */
  resolveLinks:  (links: DataLinkDef[], row: Record<string, unknown>) => ResolvedLink[]
  /**
   * Bridge for InnerPageShell — populated by SiteRenderer, consumed by the
   * inner-page shell to render InnerLayout (sidebar + section nav).
   * packages/react stays agnostic: no InnerLayout import here.
   */
  navContext?: {
    sections:    NavSection[]
    timeModeKey: string
  }
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

// ── Slice META types — discriminated by sliceType ─────────────────────

/** META for a node type slice (panel plugin equivalent) */
export interface NodeSliceMeta {
  sliceType:  'node' | 'page' | 'panel'
  type:       string
  variant?:   string

  // ── Palette (Constructor picker)
  label?:     LocaleString
  icon?:      string
  category?:  string
  preview?:   string

  // ── Schema + defaults (Constructor property panel)
  schema?:    object
  defaults?:  Record<string, unknown>
  groups?:    PropertyGroup[]

  // ── Slot contracts (Constructor child insertion)
  slots?:     Record<string, SlotDef>

  // ── Capability flags (Constructor behaviour)
  transparent?:     boolean   // engine expands in-place — no DOM output
  canHaveChildren?: boolean   // Constructor shows child insertion UI
  singleton?:       boolean   // only one per page (e.g. page-header)
  rootOnly?:        boolean   // palette hides unless at root level

  // ── Data migration
  version?: number

  // ── System UI strings per locale
  i18n?:    Record<string, Record<string, string>>
}

// ── ChromeEntry — chrome slot configuration (JSON-serializable) ────────
//
//  String shorthand: 'transparent' → { variant: 'transparent' }.
//  Object form: full control over region · order · per-instance config.
//  Both forms are JSON-serializable → Constructor Phase 2 ready (JSONB).
//
//  Pattern: Grafana variable override chain · Builder.io slot config per page.
//

/** Per-instance chrome slot configuration — extended form of ChromeEntry. */
export interface ChromeSlotConfig {
  /** Which registered variant to render. */
  variant:  string
  /** Layout region to place this slot in. Overrides the slot's defaultRegion. */
  region?:  string
  /** Sort order within the region. Lower = earlier. Overrides defaultOrder. */
  order?:   number
  /** Per-instance config injected via useSlotConfig() — Constructor JSONB. */
  config?:  Record<string, unknown>
}

/** Chrome entry in SiteManifest.chrome or PageConfigBase.chrome. */
export type ChromeEntry = string | ChromeSlotConfig

/** META for a chrome slot slice (header/sidebar/footer variant) */
export interface ChromeSliceMeta {
  sliceType:     'chrome'
  slot:          string
  key:           string
  label:         LocaleString   // LocaleString = string | Record<string,string> — plain string still valid
  preview?:      string
  // ── Constructor chrome editor
  icon?:         string
  schema?:       object
  version?:      number
  // ── Layout defaults — where this slot lives when no override is set
  /** Default layout region: 'top' | 'bottom' | 'left' | 'right' | 'overlay' | 'inline'. */
  defaultRegion: string
  /** Default sort order within the region. Lower = earlier. */
  defaultOrder:  number
}

/** META for a filter control slice (year-select, cascade, select…) */
export interface FilterControlMeta {
  sliceType:   'control'
  controlType: string
  label:       string
  category?:   string
}

export type SliceMeta = NodeSliceMeta | ChromeSliceMeta | FilterControlMeta

// ── PageConfigBase + NodePageConfig — Track A page composition ────────
//
//  Intersection pattern: NodePageConfig = (InnerPageNode | …) & PageConfigBase
//  Page IS the root node. No `root` wrapper field.
//  Phase 2: src/pages/ deleted → manifest.ts fetches from API (one-line change).
//
//  Uses conditional type helper so NodePageConfig is valid whether or not
//  the page-node augmentations are in scope (graceful degradation).
//
type _PageNode<K extends string> = K extends keyof NodeTypeMap
  ? NodeTypeMap[K]
  : NodeBase & { type: K; children: NodeDef[] }

export interface PageConfigBase {
  id:            string
  /** Layout geometry frame — open string. Known: 'default' | 'landing' | 'minimal' | 'canvas'.
   *  AppChrome sets data-frame on .app-shell; co-located page CSS reads it for geometry only
   *  (content height, overflow). Visual chrome appearance = chrome field below.
   *  Constructor Phase 2: DB column pages.frame TEXT. */
  frame?:        string
  /** Per-page chrome slot overrides — string shorthand or full ChromeEntry object.
   *  ChromeSlot resolution: page override → site default → 'default'.
   *  JSON-serializable. Constructor Phase 2: DB column pages.chrome JSONB. */
  chrome?:       Record<string, ChromeEntry>
  path?:         string
  color?:        string
  filterSchema?: FilterSchemaInput
  vars?:         VarMap
  modeOrder?:    string[]
}

export type NodePageConfig =
  | (_PageNode<'inner-page'>     & PageConfigBase)
  | (_PageNode<'tab-page'>       & PageConfigBase)
  | (_PageNode<'container-page'> & PageConfigBase)