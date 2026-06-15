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
import type { LocaleString } from '@geostat/engine'

// ── SliceCategory — typed palette grouping discriminant ───────────────
//
//  'page'     — page template nodes (rootOnly, tree root)
//  'data'     — data-rendering panels and nodes (DataSpec required)
//  'layout'   — structural composition nodes (section, filter-bar, columns…)
//  'content'  — static content nodes (hero, links, stats-carousel, page-header)
//  'filter'   — filter controls (year-select, cascade, select…)
//
export type SliceCategory = 'page' | 'data' | 'layout' | 'content' | 'filter'

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

// ── PropField — typed property descriptor (Constructor property panel) ──
//
//  Replaces `schema?: object` with a typed field-descriptor array.
//  Constructor reads PropSchema → generates property panel UI per slice.
//  Engine reads PropSchema → validates stored config on load.
//
//  Reference: roadmap Layer 9.1 [N10, N11].
//

/** Primitive and rich value types supported in a PropField. */
export type PropFieldType =
  | 'string'        // plain text
  | 'number'        // numeric
  | 'boolean'       // toggle / checkbox
  | 'object'        // generic nested object (Constructor: raw JSON sub-editor)
  | 'array'         // generic array (Constructor: list editor)
  | 'LocaleString'  // string | Record<string,string> — bilingual text
  | 'DataSpec'      // engine DataSpec union
  | 'ChartDef'      // chart definition (ChartDef from @geostat/charts)
  | 'color'         // CSS color picker
  | 'icon'          // icon-picker

/** One option for an enum-like select field. */
export interface PropFieldOption {
  value: string
  label: LocaleString
}

/** Validation constraints on a PropField value. */
export interface PropFieldValidation {
  min?:     number   // number field: minimum value
  max?:     number   // number field: maximum value
  pattern?: string   // string field: regex constraint
}

/**
 * Typed descriptor for one property field in a slice's config form.
 *
 * `field` is a dot-path into the node config ('title', 'view.width').
 * `group` references a PropertyGroup label — omit if ungrouped.
 */
export interface PropField {
  field:       string
  type:        PropFieldType
  label:       LocaleString
  default?:    unknown
  required?:   boolean
  /** Allowed values for string fields; Constructor renders a select. */
  options?:    PropFieldOption[]
  validation?: PropFieldValidation
  /**
   * Conditional visibility — evaluated against other field values.
   * e.g. "chartType === 'bar'" — shows this field only when chartType is bar.
   */
  showWhen?:   string
  /** References a PropertyGroup label; field is placed in that accordion section. */
  group?:      string
}

/** Ordered list of typed field descriptors for a slice's property panel. */
export type PropSchema = PropField[]

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
  version?:         number
  i18n?:            Record<string, Record<string, string>>
  // Panels are leaves — no slots, no rootOnly, no transparent, no singleton
}

/**
 * META for general node slices (section, filter-bar, georgraph, hero, links…).
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
}

/** META for a filter control slice (year-select, cascade, select…) */
export interface FilterControlMeta {
  sliceType:   'control'
  controlType: string
  label:       string
  category?:   SliceCategory
}

export type SliceMeta = NodeSliceMeta | PageSliceMeta | PanelSliceMeta | ChromeSliceMeta | FilterControlMeta
