// ── slice-meta.ts — Plugin taxonomy: SliceMeta discriminated union ────
//
//  Five sliceType discriminants (5-tier plugin taxonomy):
//    'node'    → NodeSliceMeta    — general nodes (section, hero, filter-bar…)
//    'page'    → PageSliceMeta    — page template roots (inner-page, tab-page…)
//    'panel'   → PanelSliceMeta   — leaf data panels (chart, table, kpi-strip)
//    'chrome'  → ChromeSliceMeta  — app-shell chrome slots (header, sidebar…)
//    'control' → FilterControlMeta — filter controls (year-select, cascade…)
//
//  Companion types:
//    SliceCategory  — typed palette grouping discriminant
//    SlotDef        — typed children contract (Builder.io slots pattern)
//    PropertyGroup  — Constructor property panel accordion grouping
//    ValidationError — per-node validation result
//
import type { LocaleString } from '@statdash/engine'

// ── SliceCategory — typed palette grouping discriminant ───────────────
//
//  'page'     — page template nodes (rootOnly, tree root)
//  'data'     — data-rendering panels and nodes (DataSpec required)
//  'layout'   — structural composition nodes (section, filter-bar, columns…)
//  'content'  — static content nodes (hero, links, stats-carousel, page-header)
//  'filter'   — filter controls (year-select, cascade, select…)
//
export type SliceCategory = 'page' | 'data' | 'layout' | 'content' | 'filter'

// ── NodeCap — declared capability tokens for a slice [N29] ─────────────
//
//  Open string union: a slice declares what it can do (render data, hold
//  children, export…). Consumed by NodeRegistry.getCaps / getByCapability
//  for Constructor palette filtering and cross-node capability queries.
//  Open-ended (`string & {}`) so new capabilities = new tokens, no code change.
//
//  Standard vocabulary (see CAPS below):
//    'export'      — node can export its data (CSV/Excel)
//    'collapsible' — node supports collapse/expand
//    'filterable'  — node responds to filter context changes
//    'view-toggle' — node has a chart↔table (or similar) view toggle
//    'methodology' — node can display methodology/source disclosure
//    'drill'       — node supports drill-down navigation
//    'repeat'      — node iterates over dimension values
//    'data'        — node renders a data payload (DataSpec required)
//    'children'    — node holds child nodes (structural container)
//    'chart'       — node renders a chart visualisation
//    'kpi'         — node renders KPI metrics
//    'nav-contributor'  — node contributes a section to the page nav (id/title/navMode)
//    'nav-transparent'  — real-DOM container the nav extractor descends through
//
export type NodeCap =
  | 'export'
  | 'collapsible'
  | 'filterable'
  | 'view-toggle'
  | 'methodology'
  | 'drill'
  | 'repeat'
  | 'data'
  | 'children'
  | 'chart'
  | 'kpi'
  | 'nav-contributor'
  | 'nav-transparent'
  | (string & {})

/**
 * Standard capability token constants for type-safe cap references [N29].
 * Use these instead of bare string literals — IDE completion + rename-safety.
 *
 * Open for extension: new capability = new key here + new token on NodeCap.
 * No engine change required — getByCapability accepts any NodeCap string.
 */
export const CAPS = {
  /** Node can export its data (CSV / Excel). */
  EXPORT:      'export',
  /** Node supports collapse / expand. */
  COLLAPSIBLE: 'collapsible',
  /** Node responds to filter context changes. */
  FILTERABLE:  'filterable',
  /** Node has a chart ↔ table (or similar) view toggle. */
  VIEW_TOGGLE: 'view-toggle',
  /** Node can display methodology / source disclosure. */
  METHODOLOGY: 'methodology',
  /** Node supports drill-down navigation. */
  DRILL:       'drill',
  /** Node iterates over dimension values. */
  REPEAT:      'repeat',
  /** Node renders a data payload (DataSpec required). */
  DATA:        'data',
  /** Node holds child nodes (structural container). */
  CHILDREN:    'children',
  /** Node renders a chart visualisation. */
  CHART:       'chart',
  /** Node renders KPI metrics. */
  KPI:         'kpi',
  /** Node contributes a section to the page nav (read via its NavContribution descriptor). */
  NAV_CONTRIBUTOR: 'nav-contributor',
  /** Real-DOM container the nav extractor descends through (distinct from render `transparent`). */
  NAV_TRANSPARENT: 'nav-transparent',
} as const satisfies Record<string, NodeCap>

/** Narrow type: one of the standard capability token strings. */
export type Cap = typeof CAPS[keyof typeof CAPS]

// NavContribution descriptor (how a `nav-contributor` node is read) is its own
// concern — see ./nav-contribution.ts. Re-exported here so it travels with the
// slice-taxonomy public surface (NodeSliceMeta carries a `navContribution`).
export type { NavContribution } from './nav-contribution'
export { DEFAULT_NAV_CONTRIBUTION } from './nav-contribution'
import type { NavContribution } from './nav-contribution'

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
//  PropertyGroup organises schema fields into labelled accordion sections.
//  Moved to `@statdash/engine` (core) so a TransformStep op can carry its own
//  authoring PropSchema (OCP, the arrow forbids core→react). Re-exported here
//  so every `@statdash/react/engine` import site is byte-identical.
//
export type { PropertyGroup } from '@statdash/engine'
import type { PropertyGroup } from '@statdash/engine'

// ── ValidationError — per-node validation result ──────────────────────

export interface ValidationError {
  field:   string
  message: string
  level:   'error' | 'warning'
}

// ── PropField — typed property descriptor (Constructor property panel) ──
//
//  The schema-driven authoring vocabulary. MOVED to `@statdash/engine` (core)
//  so a TransformStep op can carry its own authoring PropSchema (OCP) — core
//  may not import react (the arrow). Re-exported here so every existing
//  `@statdash/react/engine` import of these types is byte-identical.
//  Full docs + rationale: `packages/core/src/config/prop-schema.ts`.
//
//  Reference: roadmap Layer 9.1 [N10, N11].
//
export type {
  PropFieldType, PropFieldSource, PropFieldOption, PropFieldValidation,
  PropField, PropSchema,
} from '@statdash/engine'
import type { PropSchema } from '@statdash/engine'

// VariantDef / VariantSchema (declarative shell variants) are their own concern
// — see ./variant-meta.ts. Re-exported here so they travel with the public
// slice-taxonomy surface (NodeSliceMeta carries a `variants: VariantSchema`).
export type { VariantDef, VariantSchema } from './variant-meta'
import type { VariantSchema } from './variant-meta'

// ── Slice META — three distinct node contracts per sliceType ──────────

/**
 * META for page template slices (inner-page, tab-page, container-page).
 * Pages are always tree roots — rootOnly is a literal `true`, not a flag.
 * Constructor hides page templates unless the canvas is empty.
 */
export interface PageSliceMeta {
  sliceType:        'page'
  type:             string
  variant?:         string
  label?:           LocaleString
  icon?:            string
  category?:        SliceCategory
  preview?:         string
  schema?:          PropSchema
  defaults?:        Record<string, unknown>
  groups?:          PropertyGroup[]
  slots?:           Record<string, SlotDef>
  canHaveChildren?: boolean
  rootOnly:         true             // literal — pages MUST be root-only
  singleton?:       boolean
  /** Declared capability tokens [N29] — Constructor palette filtering. */
  caps?:            NodeCap[]
  version?:         number
  i18n?:            Record<string, Record<string, string>>
}

/**
 * META for data panel slices (chart, table, kpi-strip).
 * Panels are always leaves — `canHaveChildren` is pinned to the literal `false`,
 * not a free flag: a panel that contains children is an illegal state and the
 * type system rejects it (make-illegal-states-unrepresentable).
 * category is required: Constructor uses it for palette grouping (always 'data').
 *
 * `slots` is intentionally absent — a leaf has no insertion targets, so the
 * Constructor's drag-and-drop accept logic never offers a panel as a drop zone.
 */
export interface PanelSliceMeta {
  sliceType:        'panel'
  type:             string
  variant?:         string
  label?:           LocaleString
  icon?:            string
  category:         SliceCategory     // required on panels; expected 'data'
  preview?:         string
  schema?:          PropSchema
  defaults?:        Record<string, unknown>
  groups?:          PropertyGroup[]
  canHaveChildren?: false             // literal false — panels are always leaves
  /** Declared capability tokens [N29] — Constructor palette filtering. */
  caps?:            NodeCap[]
  version?:         number
  i18n?:            Record<string, Record<string, string>>
  // Panels are leaves — no slots, no rootOnly, no transparent, no singleton
}

/**
 * META for general node slices (section, filter-bar, geograph, hero, links…).
 * category groups the Constructor palette. transparent nodes are expanded in-place.
 */
export interface NodeSliceMeta {
  sliceType:        'node'
  type:             string
  variant?:         string
  label?:           LocaleString
  icon?:            string
  category?:        SliceCategory
  preview?:         string
  schema?:          PropSchema
  defaults?:        Record<string, unknown>
  groups?:          PropertyGroup[]
  slots?:           Record<string, SlotDef>
  transparent?:     boolean
  canHaveChildren?: boolean
  singleton?:       boolean
  /** Declared visual variants → `data-*` attrs (see variant-meta.ts); shells spread, never hand-code a `--modifier` class. */
  variants?:        VariantSchema
  /** Declared capability tokens [N29] — Constructor palette filtering. */
  caps?:            NodeCap[]
  /**
   * How this node's nav section is read when it declares the `nav-contributor`
   * cap. Optional — absent ⇒ DEFAULT_NAV_CONTRIBUTION (anchor??id, title,
   * view.visibleWhen). Ignored when `nav-contributor` is not in `caps`.
   */
  navContribution?: NavContribution
  version?:         number
  i18n?:            Record<string, Record<string, string>>
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
  schema?:       PropSchema
  version?:      number
  // ── Layout defaults — where this slot lives when no override is set
  /** Default layout region: 'top' | 'bottom' | 'left' | 'right' | 'overlay' | 'inline'. */
  defaultRegion: string
  /** Default sort order within the region. Lower = earlier. */
  defaultOrder:  number
  /**
   * Chrome-slot UI-string catalog, registered into i18next under the `slot`
   * namespace (AR-37 P1). Symmetric with node/panel `META.i18n` — a chrome shell
   * resolves its fixed labels/aria via `useT(slot)` instead of a hardcoded JSX
   * literal, so nav/switcher chrome flips with the URL locale. Bilingual, tenant-
   * agnostic framework strings (Law 4) — the same in-repo home section/kpi-strip use.
   */
  i18n?:         Record<string, Record<string, string>>
}

/** META for a filter control slice (year-select, cascade, select…) */
export interface FilterControlMeta {
  sliceType:   'control'
  controlType: string
  label:       string
  category?:   SliceCategory
  /** Which data dimension this control targets (e.g. 'geo', 'time', 'indicator'). */
  dimension?:  string
}

export type SliceMeta = NodeSliceMeta | PageSliceMeta | PanelSliceMeta | ChromeSliceMeta | FilterControlMeta
