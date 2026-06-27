// ── Engine Types — Node layer ─────────────────────────────────────────
//
//  Split from the former monolithic types.ts (400-line ceiling). This file
//  owns the NODE vocabulary:
//    ViewParams · VIEW_DEFAULTS · NodeBase · NodeTypeMap · NodeDef ·
//    PageConfigBase · NodePageConfig
//
//  Architecture (Grafana/Builder.io/Retool/AppSmith patterns):
//    named slot  → WHERE (header, kpis, sections, links)
//    type        → WHAT  (registry dispatch, recursion, portability)
//    view        → HOW/WHEN (layout · visibility · display behavior)
//    data        → DataSpec — engine layer
//
//  Node types (concrete interfaces) live co-located with their shells:
//    plugins/nodes/[type]/default/[TypeName]Node.ts
//    Each augments NodeTypeMap via `declare module '@statdash/react/engine'`.
//    Engine has zero knowledge of concrete node shapes → OCP.
//

import type {
  VisibilityExpr,
  TransformStep,
  FieldConfig,
  DataLinkDef,
  VarMap,
  FilterSchemaInput,
  FilterBarNode,
  BarNode,
  ParamNode,
  ScopeOverride,
  PerspectivesByParam,
}                                from '@statdash/engine'
import type { NodeStyles }       from '@statdash/styles'
import type { ChromeEntry }       from '../slice-meta'

// ── ViewParams — display/layout/visibility configuration ──────────────

export interface ViewParams {
  width?:       'full' | 'half' | 'third'
  subtitle?:    string
  visibleWhen?: VisibilityExpr
  default?:     'chart' | 'table'
  toggle?:      boolean
  legend?:      'bottom' | 'right' | 'none'
  tooltip?:     'multi' | 'single' | 'none'
  // `compact` and `hero` retired (schema v4) into the section's declared
  // `variants.emphasis` enum — see migration.ts v3→v4 + section/default/meta.ts.
  defaultOpen?: boolean
  noCollapse?:  boolean
  exportable?:  boolean
  cols?:        string | number
  styles?:      NodeStyles
  role?:        string
  label?:       string
  position?:    string
  /** Per-panel context override — dimOverride wiring (Grafana scopedVars). */
  scope?:       ScopeOverride
  /**
   * Opt-in polling for non-streaming stores (N34d).
   * When set, useNodeStream re-queries on a fixed interval (milliseconds).
   * Ignored when the store has caps.streaming === true (push wins).
   */
  polling?:     { interval: number }
}

// ── VIEW_DEFAULTS — Eurostat/ONS standard defaults ─────────────────────

export const VIEW_DEFAULTS: Required<Omit<ViewParams,
  'width' | 'subtitle' | 'visibleWhen' | 'defaultOpen' | 'noCollapse' |
  'exportable' | 'cols' | 'styles' | 'role' | 'label' | 'position' |
  'scope' | 'polling'
>> = {
  default: 'chart',
  toggle:  true,
  legend:  'bottom',
  tooltip: 'multi',
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
  data?:       import('@statdash/engine').DataSpec
  view?:       ViewParams
  storeKey?:   string

  /**
   * Authored visual-variant values — a generic bag keyed by variant NAME
   * (e.g. `{ emphasis: 'hero' }`), declared per-slice in META (NodeSliceMeta.
   * variants). defineShell resolves these against the slice's VariantSchema to
   * `data-*` attrs the shell spreads (resolveVariants). The engine names no
   * specific variant — zero privileged keys, mirroring `presentation`/`vars`.
   * Constructor-authored via variantPropSchema(); JSON-Schema-validated.
   */
  variants?:   Record<string, string | boolean>

  /**
   * RBAC visibility gate [N41]. If set and non-empty, the node is hidden
   * unless ctx.auth.roles includes at least one of these roles. Absent or
   * empty ⇒ visible to everyone (anonymous included). Enforced in
   * renderNode.ts — the engine/react render seam, keeping auth out of
   * engine/core (auth is an app-tier concern, Law 3).
   */
  visibleToRoles?: string[]

  // ── Data pipeline extensions ─────────────────────────────────────────
  /** Declarative post-processing steps applied after interpretSpec (Grafana Transform pipeline). */
  transforms?: TransformStep[]
  /** Per-field display configuration cascaded to child nodes (Grafana FieldConfig). */
  fieldConfig?: FieldConfig
  /** Node-scoped derived variables evaluated with this node's filter context (Retool Transformer). */
  vars?:       VarMap
  /** Drill-down / navigation links resolved against a clicked DataRow (Grafana DataLinks). */
  dataLinks?:  DataLinkDef[]
  /**
   * Declarative event handlers [N36 cross-filter] — maps an interaction
   * (row:click, row:hover…) to actions (set a filter param from a row field).
   * JSON-only, Constructor-ready; shells read this and wire to ctx.set at runtime.
   */
  on?:         import('../node-events').NodeEventHandler[]
}

// ── NodeTypeMap — open plugin extensibility (Builder.io module augmentation) ──
//
//  Platform declares empty interface; plugins augment via `declare module`:
//    declare module '@statdash/react/engine' {
//      interface NodeTypeMap { 'section': SectionNode }
//    }
//  Empty NodeTypeMap → NodeDef = CoreNodeDef. Plugin augments → auto-extends. ✅
//  Zero packages/ change for new node types.
//
//  The empty body is intentional and load-bearing: it is the augmentation seam
//  plugins extend via `declare module`. `object`/`unknown` would defeat the
//  per-key merge that gives `NodeDef = CoreNodeDef | <plugin keys>`.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NodeTypeMap {}

// ── CoreNodeDef — engine-package-owned node types ─────────────────────
//
//  These types originate in @statdash/engine, not in plugin shells, so they
//  are not co-located. Plugin shells for filter-bar / bar / param augment
//  NodeTypeMap separately to provide full type coverage.
//
type CoreNodeDef = FilterBarNode | BarNode | ParamNode

// ── NodeDef — discriminated union of all renderable node types ─────────
//
//  CoreNodeDef: engine-package-owned types.
//  NodeTypeMap[keyof NodeTypeMap]: plugin-registered types (module augmentation).
//  Empty NodeTypeMap → NodeDef = CoreNodeDef.  Plugin augments → auto-extends. ✅
//
export type NodeDef = CoreNodeDef | NodeTypeMap[keyof NodeTypeMap]

// ── VarExpr — single-expression element of a VarMap ───────────────────
//
//  REUSE of the existing VarMap value type (FilterDerive | ExprVal) — NOT a
//  new expression grammar. The data-driven page-presentation seam below must
//  evaluate the very same `op:'find'` / `op:'breadcrumbs'` expressions the
//  generic `vars` map evaluates, through the same evalVarMap machinery.
//
export type VarExpr = VarMap[string]

// ── PagePresentation — generic presentation-contributions bag (N-ADR-0029 v2) ──
//
//  A page's presentation is a list of declarative contributions, KEYED BY
//  registered projector key. The engine NEVER reads a specific key (`color`,
//  `crumbs`, …) — it iterates the presentation-projector registry and asks each
//  projector for `presentation[projector.key]`, then evaluate()s + project()s it
//  (see packages/react/src/engine/presentation/). Concrete keys are owned by the
//  concrete projectors in @statdash/plugins, NOT named here.
//
//  This is the v2 reshape: v1 declared two flat fields (`color`/`crumbs`) the
//  renderer special-cased; that merely relocated the smell. Now the slot is a
//  generic typed bag the registry projects, the Constructor authors it via
//  presentationPropSchema() (the union of registered projectors' schema()), and a
//  NEW concern = a new registration with ZERO renderer/type edits (OCP / Law 1).
//
//  `vars` stays purely generic with ZERO reserved keys; presentation has zero
//  privileged dimensions — every key is a registered, schema'd capability.
//
export type PagePresentation = Record<string, VarExpr | string | unknown>

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
  /**
   * Page-level schema version [N19]. Stamped by migratePageConfig after a
   * migration run so callers know the page is at the current format. Distinct
   * from per-node slice versions. Absent ⇒ treated as pre-versioned (v0).
   */
  schemaVersion?: number
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
  /**
   * Presentation-projection contributions [N-ADR-0029 v2] — a generic bag keyed
   * by registered projector key. The renderer iterates the presentation-projector
   * registry and projects each contribution generically (evaluate → project); it
   * names no concern. Concrete capabilities (color → CSS var, crumbs →
   * navContext.crumbs) are registered projectors in @statdash/plugins. Keeps
   * `vars` purely generic (zero reserved keys); a new concern needs ZERO edits here.
   */
  presentation?: PagePresentation
  filterSchema?: FilterSchemaInput
  vars?:         VarMap
  /**
   * The page's perspective axes [VISION #3], keyed by URL param — the generic,
   * declarative perspective-axis declaration. One key today (`{ mode: {…} }`);
   * multi-axis = a second key (D-MULTIAXIS), zero rename. The `perspectives[]`
   * array order is the SSOT for both the toggle order and the nav-sort rank.
   * Absent ⇒ no axis (N=1-free; byte-identical render, FF-ONE-VIEW-NO-MACHINERY).
   */
  perspectives?: PerspectivesByParam
}

export type NodePageConfig =
  | (_PageNode<'inner-page'>     & PageConfigBase)
  | (_PageNode<'tab-page'>       & PageConfigBase)
  | (_PageNode<'container-page'> & PageConfigBase)
