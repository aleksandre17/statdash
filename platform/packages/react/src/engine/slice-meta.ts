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
//    'flow'             — PLACEMENT capability (content-category grammar): flow content
//
//  ── Two flavours of cap (one array, two intents) ──────────────────────────────
//  Most tokens above are BEHAVIOURAL — "what can this element DO" (export, collapse,
//  render a chart). `flow` is a PLACEMENT capability — "what KIND of content am I, i.e.
//  WHERE may I be placed" — the HTML5 content-category model (WHATWG §3.2.5): an element
//  DECLARES the content categories it belongs to; a container declares its content model
//  (which categories it admits, via `SlotDef.acceptsCaps`). This is the substrate the
//  capability-accepts grammar (`slotAdmits`) reads — a NEW content block is placeable by
//  DECLARING `flow`, with ZERO edit to the container (OCP · FF-CAPABILITY-ACCEPTS).
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
  | 'flow'
  | 'styleable'
  | 'data-bindable'
  | 'interactive'
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
  /**
   * PLACEMENT capability — the element is FLOW CONTENT (HTML5 content-category model):
   * a page-content block admissible in any generic content region (a section, a layout
   * container). Declared by content blocks; read by a slot's `acceptsCaps`. Answers
   * "WHERE may I be placed", not "what can I do" — the capability-accepts grammar.
   */
  FLOW: 'flow',
  /**
   * FACET opt-in — the element exposes the universal STYLE facet (its `view.styles`
   * are token-authorable in the inspector). The declared signal the generic Facet
   * axis reads (`FacetDescriptor.appliesWhen`, ./facet) to project an `element.style`
   * dock section — NEVER a concrete-type read (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE).
   * Opt-in by declaration keeps the base thin (no per-element facet form; the STYLE
   * contract is declared ONCE at the platform in the facet registry).
   */
  STYLEABLE: 'styleable',
  /**
   * FACET opt-in — the element exposes the universal DATA facet (its `data: DataSpec`
   * pipeline is authorable in place). The declared signal the generic Facet axis reads
   * (`FacetDescriptor.appliesWhen`, ./facet) to project an `element.facet.data` dock
   * section on ANY data-bindable element — chart/table/kpi/… — NEVER a concrete-type
   * read (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE). Distinct from the behavioural `data`
   * cap ("renders a data payload"): this is the AUTHORING opt-in, the peer of
   * `styleable`, so a data element can opt into in-place pipeline authoring without the
   * cap being overloaded onto palette/placement queries. Metric-optional: the facet
   * authors a raw query/transform/derive/calc pipeline with or without a governed metric.
   */
  DATA_BINDABLE: 'data-bindable',
  /**
   * FACET opt-in — the element exposes the universal EVENTS facet (its `on:
   * NodeEventHandler[]` interaction handlers are authorable in place). The declared
   * signal the generic Facet axis reads (`FacetDescriptor.appliesWhen`, ./facet) to
   * project an `element.facet.events` dock section on ANY interaction-capable element
   * — a chart/table/kpi/map whose shell EMITS gestures (point:click/row:click/
   * selection:change) that the `useNodeInteractions` spine folds into actions — NEVER
   * a concrete-type read (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE). Distinct from the
   * behavioural `filterable` cap ("responds to filter-context changes"): this is the
   * AUTHORING opt-in, the peer of `styleable`/`data-bindable`, so an element declares
   * it can EMIT authorable gestures without overloading the filter-response cap. The
   * facet authors the declared `NodeEventHandler[]`/`NodeAction` grammar (filter/
   * highlight/drill) — pure data, the SAME spec `useNodeInteractions` interprets.
   */
  INTERACTIVE: 'interactive',
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
  /**
   * IDENTITY content model — the allowed node TYPES (a concrete allow-list; empty ⇒ any).
   * The original, still-valid mechanism (Strangler) for genuinely type-specific slots
   * (a map's detail = a `table`; a page's sticky bar = `filter-bar`/`perspective-bar`).
   */
  accepts?: string[]
  /**
   * CAPABILITY content model — the content CATEGORIES this slot admits (HTML5 content-
   * model grammar). A candidate child is admitted iff its declared `caps` intersect this
   * set. Prefer this over `accepts` for open content regions (a section admits any `flow`
   * block): a NEW block becomes placeable by DECLARING the category, with ZERO edit here
   * (OCP). `accepts` and `acceptsCaps` compose as a DISJUNCTION (see `slotAdmits`); a slot
   * declaring NEITHER is an open container (admits any child).
   */
  acceptsCaps?: string[]
  multi:    boolean
  min?:     number
  max?:     number
}

// ── slotAdmits — the ONE capability-based placement predicate (HTML5 content model) ──
//
//  The composition grammar's single reading: does a slot admit a candidate child? A
//  slot's content model is declared as EITHER a concrete type allow-list (`accepts`), a
//  capability set (`acceptsCaps` — the content-category grammar), or BOTH (a disjunction).
//  A child is admitted iff its `type` ∈ accepts OR its declared `caps` intersect
//  acceptsCaps. A slot declaring NEITHER is an OPEN container (admits any child) —
//  byte-identical to the pre-capability `!slot.accepts` behaviour (Strangler-safe).
//
//  Pure over the DECLARATION: takes the child's already-resolved `caps` (no registry
//  dependency), so the SAME predicate serves every consumer — the drop/palette gate
//  (`nestAccepts`), the render-time guard (`renderNode` slot-placement), and the
//  composite-integrity invariant. ONE grammar, one reading (FF-CAPABILITY-ACCEPTS). A new
//  content block is placeable by declaring its category; the container is never edited.
//
export function slotAdmits(
  slot:  Pick<SlotDef, 'accepts' | 'acceptsCaps'>,
  child: { type: string; caps?: readonly string[] },
): boolean {
  const hasTypeList = (slot.accepts?.length     ?? 0) > 0
  const hasCapSet   = (slot.acceptsCaps?.length ?? 0) > 0
  if (!hasTypeList && !hasCapSet) return true                              // open container → any
  if (hasTypeList && slot.accepts!.includes(child.type)) return true       // identity match
  if (hasCapSet && slot.acceptsCaps!.some((c) => child.caps?.includes(c))) return true  // capability match
  return false
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
//
//  ── De-alias decision (ADR-041 Phase 6 · Delta 3) ──────────────────────────────
//  The CANONICAL part declaration is the `sourced` `PartField` that `partFieldsOf`
//  emits; `BandDescriptor` is retained as a thin, documented NODE-LEVEL surface alias
//  that projects into it (`{ source }` → `{ field: source, residence: 'sourced',
//  source }`). It is NOT physically relocated onto a field in this phase: the residence
//  stays node-level (the ONE grandfathered exception FF-RESIDENCE-AT-FIELD allowlists).
//  Moving it onto a real field — retiring the last node-level residence, hardening
//  FF-RESIDENCE-AT-FIELD to `[]` — requires a NEW field-level sourced-declaration
//  surface form plus a filter-bar META migration, which is a REVERSIBLE `expand` step
//  deliberately kept OUT of this sole one-way containment step (minimal one-way door).
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

// ── isWrapper / isNodeContainer — ROOT-2 wrapper/leaf as a DERIVED predicate (ADR-041 Phase 6) ──
//
//  The owner's wrapper-vs-single-element intuition, given its ONE home. The five
//  disagreeing signals the diagnosis named (the KIND, the containment FLAG, the tree
//  slots, the props value-band, the sourced band) collapse: wrapper/leaf is now a PURE
//  function of the DECLARED parts (`partFieldsOf`, the one reading). NO mechanism reads
//  the KIND or the FLAG to answer a containment question — the hard `[]` gate this
//  phase lands (FF-DERIVED-CONTAINMENT). Both predicates route through `partFieldsOf`
//  (declared below; function-hoisted) so there is exactly ONE part enumeration — a
//  parallel walk here would be a second grammar (FF-ONE-PART-GRAMMAR).
//
//  `PartBearingMeta` is the minimal contract they read — the same three fragments
//  `partFieldsOf` projects — so BOTH an authoring `ObjectMeta` AND the registry's
//  `StoredMeta` view (which carries `slots`/`schema`/`band` verbatim) are valid inputs
//  with no cast at the call site (`nodeRegistry.getMeta(...)`).
type PartBearingMeta = Pick<ObjectMeta, 'slots' | 'schema' | 'band'>

/**
 * WRAPPER ⇔ the contract declares ≥1 part field (ANY residence); SINGLE ELEMENT
 * (leaf) ⇔ it declares none. The ONE home for the owner's wrapper/leaf intuition
 * (ADR-041 ROOT-2) — the sole containment answer after Phase 6. A kpi-strip is a
 * WRAPPER here (it declares a `value` part) though its KIND is a leaf-panel: kind and
 * contract are RECONCILED, never read as a containment signal.
 */
export function isWrapper(meta: PartBearingMeta): boolean {
  return partFieldsOf(meta).length > 0
}

/**
 * Does this element accept child NODES? — the `slot`-residence specialization of
 * `isWrapper`. A node-tree drop targets the `slot` residence ONLY: a `value`/`sourced`
 * wrapper (kpi-strip items, filter-bar controls) is a wrapper-BY-CONTRACT but NOT a
 * node-tree container — its parts are typed values / external projections, never
 * draggable node instances. This is the DERIVED replacement for the retired
 * containment flag-read: the flag was byte-identical to "declares a `slot` part"
 * (proven over the whole shipped corpus by the plugins-side FF-DERIVED-CONTAINMENT
 * semantic gate: `canHaveChildren === true ⟺ declares a slot part`).
 */
export function isNodeContainer(meta: PartBearingMeta): boolean {
  return partFieldsOf(meta).some((p) => p.residence === 'slot')
}

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
        field:       slot.field,
        residence:   'slot',
        label:       slot.label,
        accepts:     slot.accepts,
        acceptsCaps: slot.acceptsCaps,
        multi:       slot.multi,
        min:         slot.min,
        max:         slot.max,
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
