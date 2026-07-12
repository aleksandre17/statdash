// ── slice-meta.ts — ONE type system: ObjectMeta + kind refinements ────
//
//  ADR-023 "One Type System, One Tree, Two Residences." The five META names
//  are DERIVED refinements of ONE `ObjectMeta` base — "kind" is a pinned facet,
//  not a fifth mechanism. Byte-identical import sites; the SliceMeta union stays
//  discriminated on `sliceType`.
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
import type { PartField } from './partPort'

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

// ── BandDescriptor — a node's DECLARED value-band residence (ADR-038/039) ──────
//
//  The Bounded Element Law makes each declared value-band ITEM a selectable,
//  authorable element. BE-1's homogeneous props band (kpi-strip `items[]`, values
//  in `node.props`) is the DEFAULT residence and needs no descriptor. A node whose
//  band lives ELSEWHERE — e.g. the filter-bar, whose items live in the page-owned
//  `filterSchema` SSOT, discriminated by `ParamDef.type` — DECLARES that residence
//  here by naming a registered BandSource adapter. The authoring canvas resolves
//  the named source and projects generically; it NEVER special-cases the node type
//  (FF-NO-EXTERNAL-SPECIAL-CASE). A new externally-sourced band = one descriptor +
//  one registered adapter, the selection/overlay/inspector machinery unchanged (OCP).
//
//  This is the DECLARATION half (what a plugin META writes); the adapter (enumerate
//  / write) is an app-layer concern (apps/panel) — packages/react stays app-agnostic.
export interface BandDescriptor {
  /** The id of the registered BandSource adapter that resides/reads/writes this band. */
  source: string
}

// ── ObjectMeta — the ONE type system (ADR-023 · kind-as-facet) ────────
//
//  "One Type System, One Tree, Two Residences." Every registrable object —
//  node, page template, data panel, chrome slot, filter control — is ONE
//  `ObjectMeta` refined by *pinned facets*, not a separate META mechanism.
//  A "kind" (page-ness, panel-ness, chrome-ness) is expressed as declarative
//  facet fields (`rootOnly`, `canHaveChildren`, `chrome`-identity, `control`-
//  identity), Figma-mixin style — never as a fifth machinery. The five META
//  names below are DERIVED refinements (`ObjectMeta & { …pinned facets }`), so
//  every existing `import { PanelSliceMeta }` site is byte-identical while the
//  underlying type system is unified.
//
//  Reference platforms: Figma (node = trait-mixin composition), Sanity (one
//  schema registry across bands), Gutenberg (`supports` facets), ECS (facets
//  are data; behaviour lives in the interpreter). See ADR-023 + SPEC-rendering-
//  core-object-model.md §3.1.
//
//  Facet grammar is *shared* (all kinds carry the optional vocabulary); the
//  refinements PIN the illegal-state facets (page `rootOnly: true`, panel
//  `canHaveChildren: false`) so make-illegal-states-unrepresentable is kept
//  exactly where it is load-bearing.
//
export interface ObjectMeta {
  // Identity is kind-specific and NOT on the shared base: node/page/panel carry
  // `type` (re-required in their refinements), chrome carries `slot`/`key`,
  // control carries `controlType`. The ONE universal `(type, variant)` identity
  // is synthesized at registry ingestion (normalizeObjectIdentity), keeping this
  // base — and every kind's `in`-narrowing — byte-identical.
  variant?:         string
  label?:           LocaleString
  icon?:            string
  category?:        SliceCategory
  preview?:         string
  schema?:          PropSchema
  defaults?:        Record<string, unknown>
  groups?:          PropertyGroup[]
  /** Tree-band composition (Builder.io slots) — the ONE children mechanism. */
  slots?:           Record<string, SlotDef>
  /** Facet band [N29] — declared capability tokens (Constructor palette filtering). */
  caps?:            NodeCap[]
  // ── kind facets (all optional; literal-pinned by the refinements) ──
  transparent?:     boolean
  canHaveChildren?: boolean
  singleton?:       boolean
  rootOnly?:        boolean
  /** Declared visual variants → `data-*` attrs (see variant-meta.ts). */
  variants?:        VariantSchema
  /** How this node's nav section is read (when caps includes `nav-contributor`). */
  navContribution?: NavContribution
  /**
   * Declared value-band residence (ADR-038/039). Absent ⇒ the DEFAULT homogeneous
   * props band (BE-1): the node's own `schema` array-fields-with-`itemSchema`, values
   * in `node.props`. Present ⇒ the named registered BandSource adapter enumerates /
   * reads / writes this node's band from wherever it truly lives (e.g. the page
   * `filterSchema` SSOT for a filter-bar). Type-neutral: the canvas resolves the
   * declared source, never the concrete node type (FF-NO-EXTERNAL-SPECIAL-CASE).
   */
  band?:            BandDescriptor
  version?:         number
  i18n?:            Record<string, Record<string, string>>
}

// ── Slice META — five kind refinements of the ONE ObjectMeta ──────────

/**
 * META for page template slices (inner-page, tab-page, container-page).
 * Pages are always tree roots — rootOnly is a literal `true`, not a flag.
 * Constructor hides page templates unless the canvas is empty.
 */
export type PageSliceMeta = ObjectMeta & {
  sliceType: 'page'
  type:      string
  rootOnly:  true             // literal — pages MUST be root-only
}

/**
 * META for data panel slices (chart, table, kpi-strip).
 * Panels are always leaves — `canHaveChildren` is pinned to the literal `false`,
 * not a free flag: a panel that contains children is an illegal state and the
 * type system rejects it (make-illegal-states-unrepresentable).
 * category is required: Constructor uses it for palette grouping (always 'data').
 */
export type PanelSliceMeta = ObjectMeta & {
  sliceType:        'panel'
  type:             string
  category:         SliceCategory     // required on panels; expected 'data'
  canHaveChildren?: false             // literal false — panels are always leaves
}

/**
 * META for general node slices (section, filter-bar, geograph, hero, links…).
 * category groups the Constructor palette. transparent nodes are expanded in-place.
 */
export type NodeSliceMeta = ObjectMeta & {
  sliceType: 'node'
  type:      string
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

/**
 * META for a chrome slot slice (header/sidebar/footer variant).
 * Chrome-ness is the `slot`/`key` identity facet (+ layout defaults). The
 * i18n catalog registers under the `slot` namespace (AR-37 P1) so a chrome
 * shell resolves its fixed labels/aria via `useT(slot)` — symmetric with
 * node/panel `META.i18n`. Bilingual, tenant-agnostic framework strings (Law 4).
 */
export type ChromeSliceMeta = ObjectMeta & {
  sliceType:     'chrome'
  slot:          string
  key:           string
  label:         LocaleString   // required — LocaleString = string | Record<string,string>
  /** Default layout region: 'top' | 'bottom' | 'left' | 'right' | 'overlay' | 'inline'. */
  defaultRegion: string
  /** Default sort order within the region. Lower = earlier. */
  defaultOrder:  number
}

/**
 * META for a filter control slice (year-select, cascade, select…).
 * Control-ness is the `controlType` identity facet (+ targeted `dimension`).
 * The i18n catalog registers under the `controlType` namespace (AR-37 P1) so a
 * control shell resolves its connector words / aria via `useT(controlType)` —
 * symmetric with node/panel/chrome `META.i18n`. Bilingual, tenant-agnostic (Law 4).
 */
export type FilterControlMeta = ObjectMeta & {
  sliceType:   'control'
  controlType: string
  label:       string
  /** Which data dimension this control targets (e.g. 'geo', 'time', 'indicator'). */
  dimension?:  string
}

export type SliceMeta = NodeSliceMeta | PageSliceMeta | PanelSliceMeta | ChromeSliceMeta | FilterControlMeta

// ── partFieldsOf — ROOT-2: the ONE reading of an element's declared PARTS ────────
//
//  ADR-041 Phase 1. The unified derivation that reads ALL THREE containment
//  fragments of an `ObjectMeta` into ONE `PartField[]` — the single answer to
//  "what are this element's parts?" that the four grammars used to answer four
//  ways. Residence is read from the FRAGMENT (the FIELD), never from the node kind
//  (`sliceType`/`canHaveChildren`) — the residence-at-field law (FF-RESIDENCE-AT-
//  FIELD). The three surface forms it projects — `SlotDef`, value-`PropField`
//  (`array` + `itemSchema`), `BandDescriptor` — stay EXACTLY as today; this reads
//  over them, it does not change them.
//
//    slots    (SlotDef)                       → residence 'slot'    (node instances, accepts-gated)
//    schema   (array PropField + itemSchema)  → residence 'value'   (typed values on node.props — BE-1 `bandFieldsOf` predicate, verbatim)
//    band     (BandDescriptor)                → residence 'sourced' (projection of an external SSOT, resolved by the named adapter)
//
//  Pure over the declaration — no per-type branch, so a NEW part-bearing element is
//  discovered with zero code (OCP · DIP). Wrapper/leaf falls out as a derived
//  predicate: WRAPPER ⇔ `partFieldsOf(meta).length > 0` (formalized in Phase 6).
//
export function partFieldsOf(meta: ObjectMeta): PartField[] {
  const parts: PartField[] = []

  // slot residence — the SlotDef tree-band fragment (Builder.io slots).
  if (meta.slots) {
    for (const slot of Object.values(meta.slots)) {
      parts.push({
        field:     slot.field,
        residence: 'slot',
        label:     slot.label,
        accepts:   slot.accepts,
        multi:     slot.multi,
        min:       slot.min,
        max:       slot.max,
      })
    }
  }

  // value residence — homogeneous props value-band: a schema `array` field carrying
  // an `itemSchema` (ADR-022). Predicate byte-identical to BE-1 `bandFieldsOf`, so
  // an OPAQUE array (no itemSchema, e.g. filter-bar `barIds`) is NOT a part.
  if (meta.schema) {
    for (const f of meta.schema) {
      if (f.type === 'array' && Array.isArray(f.itemSchema)) {
        parts.push({
          field:      f.field,
          residence:  'value',
          label:      f.label,
          itemSchema: f.itemSchema,
          itemGroups: f.itemGroups,
          itemLabel:  f.itemLabel,
          multi:      true,
        })
      }
    }
  }

  // sourced residence — a band whose items live in an EXTERNAL SSOT (e.g. the page
  // `filterSchema`), enumerated/written by the registered adapter named in `source`.
  // ADR-041 Delta 1 (the sourced address convention, decided at zero consumers):
  // `field` is the declaring-field ADDRESS handle, `source` is the ADAPTER id. While
  // the band is node-level (Phases 1–5, ONE band per node) the handle COINCIDES with
  // `source` (`'page-filters'`); at Phase 6 the band moves onto a real field and
  // `field` gets its own name while `source` keeps naming the same adapter — a rename
  // behind the same grammar slot. The per-part addresses are STABLE keys (dynamic
  // barIds / control keys), emitted as `EnumeratedPart.key` by the `sourcedParts`
  // adapter at enumeration time (Phase 2) → `PartAddress.partPath = ${field}.${key}`.
  if (meta.band) {
    parts.push({
      field:     meta.band.source,
      residence: 'sourced',
      source:    meta.band.source,
    })
  }

  return parts
}
