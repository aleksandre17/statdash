// ── prop-schema.ts — typed property-descriptor vocabulary (Constructor) ──
//
//  The schema-driven authoring vocabulary: a slice (node/panel/chrome) — and,
//  since [V1], a transform op — declares its config form as a PropSchema (an
//  array of typed PropField descriptors). The Constructor renders that schema
//  GENERICALLY (one Inspector, no per-type form); the engine reads it to
//  validate stored config. Reference: roadmap Layer 9.1 [N10, N11].
//
//  WHY THIS LIVES IN core (the arrow):
//    PropSchema was originally co-located with SliceMeta in `packages/react`.
//    But the dependency arrow is `contracts ← expr ← core ← … ← react`, and a
//    TransformStep op (in `packages/core`) must now CARRY its own authoring
//    PropSchema (OCP: the op is the SSOT for both its behavior AND its editor).
//    PropField's ONLY external dependency is `LocaleString`, which ORIGINATES
//    in core — so the vocabulary belongs in core, importable by every layer
//    above it. `packages/react/slice-meta` re-exports these for back-compat, so
//    every existing `@statdash/react/engine` import site is unchanged.
//    (contracts can't host it: contracts is zero-@statdash-dep and PropField.label
//    is a core `LocaleString`.)
//
import type { LocaleString } from '../i18n/types'

// ── AudiencePlane — the DECLARED audience a field / facet is projected to ─────────
//
//  The Authoring Canon's "projection with a plane" (root Law 11 · ADR-043): every
//  authorable field carries the audience it belongs to. The Constructor projects a
//  field ONLY to its declared audience, filtered by the active role lens:
//    • 'author'  — the non-programmer composing pages (the DEFAULT; absent ⇒ author,
//                  so every legacy field stays author-visible, unmigrated).
//    • 'steward' — the governed-model curator; sees author + steward behind the lens
//                  (advanced controls: e.g. conditional visibility).
//    • 'system'  — plumbing (a derive-graph `vars`, a raw `dim→value` coordinate, a
//                  derived breadcrumb spec). Projected to NO ONE by default — never on
//                  the author plane; reachable only under an explicit system lens.
//  The invariant is machine-held (FF-NO-UNPROJECTED-DECLARED-FIELD): a `system` field
//  MUST NOT render on the author plane. Additive + OCP — a field with no `plane` is
//  byte-identical to before (author-visible).
//
export type AudiencePlane = 'author' | 'steward' | 'system'

// ── FieldConcern — the DECLARED CONCERN a field belongs to (the REFINE canon) ─────
//
//  The Authoring Canon's REFINE moment (root Law 11 · the inspector by concern-groups):
//  every authorable field declares WHICH concern it serves, and the Constructor's
//  inspector organizes the whole surface into a fixed, canonical concern taxonomy —
//  ONE group per concern, in ONE order, so "you can tell what means what, where" (the
//  owner's crisis mandate — no more flat, tangled property dump). The five concerns,
//  in canonical render order:
//    • 'content'  — what it SAYS: labels, titles, captions, the text a reader sees.
//    • 'data'     — what it MEANS: the governed metric bind, the pipeline, source fields.
//    • 'style'    — how it LOOKS: format, colour, size scalars, the visual refinement.
//    • 'layout'   — where it SITS: placement, span, alignment, structural composition.
//    • 'behavior' — how it ACTS: interactions, conditional visibility, selection.
//  This is a PRESENTATION grouping hint (the sibling of `group`, which is likewise an
//  inspector-only concept carried here on the field declaration) — the ENGINE never
//  interprets it; only the inspector groups by it. Absent ⇒ `'content'` (the safe
//  default: an untagged field is legible under CONTENT, never lost/mushed). Additive
//  + OCP — a field with no `concern` is byte-identical to before; a NEW field lands in
//  its declared concern automatically, no inspector change (Law 8 / FF-CONCERN-GROUPED).
//
export type FieldConcern = 'content' | 'data' | 'style' | 'layout' | 'behavior'

// ── PropFieldRole — the DECLARED AUTHORING ROLE of a field's value (P-OFFER · card 0087) ─
//
//  The Authoring Canon's P-OFFER principle (owner 2026-07-18: «მთელ პაიპლაინზე
//  ვრცელდებოდეს შემოთავაზებები … არაფერი გამორჩეს … აგნოსტიკური») demands that EVERY
//  authorable field of EVERY transform op declare WHAT KIND of value it carries — so the
//  ONE generic step editor can PROJECT the right offered control (never a bespoke per-op
//  form, never a raw box the author must guess into). The role is the sibling of
//  `concern`/`plane` — a projection hint the ENGINE never reads; only the panel's
//  TransformStepEditor maps role → control:
//    • 'field'   — an INPUT COLUMN reference (an existing column of the step's input). The
//                  panel offers the governed column list (FieldPicker); a `type:'array'`
//                  field-role field offers a MULTI column pick. Agnostic: the columns come
//                  from the live input rows, so tomorrow's new dimension appears with zero
//                  code change (Law 1).
//    • 'member'  — a COLUMN'S VALUE (a distinct member of some input column). The panel
//                  offers the Excel-AutoFilter member list (MemberPicker) over the column
//                  named by the sibling `memberOf` field. `type:'array'` ⇒ an IN-set pick.
//    • 'newName' — a GENUINELY NEW identifier the step PRODUCES (a derive's `as`, an
//                  aggregation's output name). Free text is legitimate here (nothing to
//                  offer — the name does not exist yet).
//    • 'expr'    — a FORMULA over the input row (derive's `expr`, a template string). The
//                  panel projects the ONE schema-aware expr editor (ExprAutocompleteInput)
//                  with its scope EXTENDED by the step-input columns + a live per-row
//                  preview through the ONE evaluator (`@statdash/expr`), never a second one.
//    • 'literal' — a CONSTANT / enum value (a reducer `fn`, a sort `dir`, a window size).
//                  The panel renders a typed input (a select when `options` are declared).
//
//  Composite object/array-of-object fields (a `rename` map, an `aggregate.aggregations`
//  list) carry an `itemSchema` whose SUB-fields each declare their own role — the projector
//  recurses. The coverage guard (FF-ROLE-COVERAGE) requires every leaf field of every
//  registered op-schema to carry a role decision, so a NEW op cannot ship without its offer
//  story (the CATEGORY_PIN precedent). Additive + OCP: a field with no `role` is byte-
//  identical to before (the projector falls back to its typed control) — the guard, not the
//  runtime, is what forces the decision.
//
export type PropFieldRole = 'field' | 'member' | 'newName' | 'expr' | 'literal'

// ── PropFieldType — primitive and rich value types in a PropField ─────
export type PropFieldType =
  | 'string'        // plain text
  | 'number'        // numeric
  | 'boolean'       // toggle / checkbox
  | 'object'        // generic nested object (Constructor: raw JSON sub-editor)
  | 'array'         // generic array (Constructor: list editor)
  | 'LocaleString'  // string | Record<string,string> — bilingual text
  | 'DataSpec'      // engine DataSpec union
  | 'ChartDef'      // chart definition (ChartDef from @statdash/charts)
  | 'color'         // CSS color picker
  | 'icon'          // icon-picker
  | 'enum-ref'      // value drawn from a runtime catalog — options resolved via `source`
  | 'style'         // a NodeStyles object — token-constrained style authoring (StyleField)
  | 'data-pipeline' // an element's `data: DataSpec` — projected metric-bind ⊕ pipe editor (DataFacetField)
  | 'events'        // an element's `on: NodeEventHandler[]` — declarative interaction authoring (EventsField)
  | 'visibility'    // an element's `view.visibleWhen: VisibilityExpr` — conditional-visibility authoring (VisibilityField)
  | 'thresholds'    // an ordered ThresholdStep[] — numeric conditional-formatting authoring (ThresholdField)
  | 'trend'         // a KpiTrendSpec discriminated union (yoy/cagr/share/static) — trend authoring (TrendField)

// ── PropFieldSource — runtime catalog an 'enum-ref' field draws options from ──
//
//  An 'enum-ref' field's options are NOT a static `options` list — they come
//  from a discovery source the PANEL resolves at authoring time (cube-profile,
//  the dataSpec library, the design-token set, the page list). The engine only
//  declares the KIND of reference; the panel resolves it against its APIs.
//  This keeps the engine app-agnostic (Law 3): engine names the ref, panel binds it.
//
//  Open discriminant — a new discovery source is a new token here + a new panel
//  resolver, with no Inspector/engine interface change (OCP).
//
//    'cube.measures'    — measure codes from the selected dataset's cube-profile
//    'cube.dimensions'  — dimension ids from the cube-profile
//    'cube.members'     — member codes of a chosen dimension from the cube-profile
//    'dataSpecs'        — ids from the NamedDataSpec library (Layer-1)
//    'tokens'           — design-token keys (theme)
//    'pages'            — page ids in the current site (for nav / links)
//    'filterParams'     — keys of the active page's authored ParamDefs (V4 — the
//                         `param` a VisibilityExpr leaf binds to: pick an authored
//                         filter control, never type a raw param name — Law 2)
//    'perspectives'     — registered perspective set (the `perspective(s)` a
//                         perspective-* leaf binds to: pick a registered perspective,
//                         never type a raw id)
//    'metrics'          — governed MetricDef ids from the semantic layer (AR-49/M0):
//                         the "metric-ref" picker. Backed by describeApp().metrics —
//                         the author picks a GOVERNED noun, never types a raw code
//                         (Law 2). Distinct from 'cube.measures' (raw SDMX codes).
//    'dimensions'       — governed DimensionDef ids from the semantic layer (AR-49/M0):
//                         the "dimension-ref" picker, the peer of 'metrics' (Law 1).
//                         Backed by describeApp().dimensions; members still resolve
//                         FROM the DSD at runtime. Distinct from 'cube.dimensions'.
//
export type PropFieldSource =
  | 'cube.measures'
  | 'cube.dimensions'
  | 'cube.members'
  | 'dataSpecs'
  | 'tokens'
  | 'pages'
  | 'filterParams'
  | 'perspectives'
  | 'metrics'
  | 'dimensions'
  | (string & {})

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
 * Typed descriptor for one property field in a slice's (or transform op's)
 * config form.
 *
 * `field` is a dot-path into the config object ('title', 'view.width', or, for
 * a transform op, 'by', 'fields.0'). The Inspector reads/writes that path.
 */
export interface PropField {
  field:       string
  type:        PropFieldType
  label:       LocaleString
  default?:    unknown
  required?:   boolean
  /**
   * The DECLARED audience this field is projected to (root Law 11 · ADR-043). Absent
   * ⇒ `'author'` (the field shows on the author plane — every legacy field, unmigrated).
   * `'steward'` ⇒ an advanced control shown only behind the steward lens; `'system'`
   * ⇒ plumbing (a derive-graph, a raw `dim→value` coordinate, a derived breadcrumb
   * spec), projected to no one by default. The Constructor filters by the active lens
   * (`planesForRole`); FF-NO-UNPROJECTED-DECLARED-FIELD forbids a `system` field
   * rendering on the author plane.
   */
  plane?:      AudiencePlane
  /** Allowed values for string fields; Constructor renders a select. */
  options?:    PropFieldOption[]
  /**
   * Runtime catalog this field's options are drawn from — REQUIRED when
   * `type === 'enum-ref'`, ignored otherwise. The panel resolves the source
   * to a live option list (e.g. measures from the selected cube-profile).
   * The engine only declares the kind of ref; the panel binds it (Law 3).
   */
  source?:     PropFieldSource
  /**
   * For a `source: 'tokens'` enum-ref (and each per-property picker a `'style'`
   * field composes): the design-token GROUP the picker is constrained to — e.g. a
   * `padding` picker draws `group:'spacing'`, a `color` picker `group:'color'`. The
   * panel filters `TOKENS_CATALOG` by this group (Tailwind constraint discipline —
   * a finite, on-scale, `[data-tenant]`-themeable option set). A kept-open string:
   * the engine names the group; the panel binds it against the styles catalog
   * (Law 3), so no `TokenGroup` import leaks into core. Ignored unless the field
   * resolves tokens.
   */
  tokenGroup?: string
  /**
   * For a `'cube.members'` enum-ref ONLY: the sibling field whose value names the
   * dimension whose members this field draws from (the member list is scoped to a
   * chosen dimension — e.g. a `default` member is scoped to the param's `key`).
   * The panel reads the dimension code from `siblingValues[sourceDim]`, falling
   * back to the profile's first dimension. Ignored for any other source.
   */
  sourceDim?:  string
  validation?: PropFieldValidation
  /**
   * Conditional visibility — evaluated against other field values.
   * e.g. "chartType === 'bar'" — shows this field only when chartType is bar.
   */
  showWhen?:   string
  /** References a PropertyGroup label; field is placed in that accordion section. */
  group?:      string
  /**
   * The DECLARED CONCERN this field serves (the REFINE canon — root Law 11). The
   * inspector organizes the whole element surface into the canonical concern taxonomy
   * (content · data · style · layout · behavior), one collapsible group per concern in
   * canonical order. Absent ⇒ `'content'` (the safe default — an untagged field stays
   * legible under CONTENT, never lost). A PRESENTATION hint (sibling of `group`); the
   * engine never reads it. FF-CONCERN-GROUPED forbids an ungrouped orphan on the author
   * plane. Additive + OCP — a new field lands in its declared concern with no dock change.
   */
  concern?:    FieldConcern
  /**
   * The DECLARED AUTHORING ROLE of this field's value (the P-OFFER canon — card 0087).
   * The panel's ONE generic TransformStepEditor projects role → offered control (field →
   * FieldPicker · member → MemberPicker · newName → free text · expr → the expr editor +
   * live preview · literal → typed input). A projection hint the ENGINE never reads; only
   * the step editor maps it. Absent ⇒ the projector falls back to the field's typed control
   * (byte-identical to before). FF-ROLE-COVERAGE forbids a leaf field of a registered op-
   * schema shipping with no role decision (a new op must declare its offer story).
   */
  role?:       PropFieldRole
  /**
   * For a `role: 'member'` field ONLY: the sibling field whose value NAMES the input column
   * whose distinct members this field offers (the MemberPicker is scoped to that column —
   * e.g. a `rollup.of` member list is scoped to `rollup.dim`). The panel reads the column
   * key from the sibling's value and offers `input.valuesFor(column)`. The peer of
   * `sourceDim` (cube.members), scoped to the step's LIVE input rows (Law 1). Ignored unless
   * `role === 'member'`.
   */
  memberOf?:   string
  /**
   * Coverage contract for the field's value. `'localized'` marks a field whose
   * value must be a complete `LocaleString` over ALL active locales — the
   * Inspector renders a per-locale input and enforces locale-coverage at
   * authoring time (shift-left of the V13/V14 gold-gate check). Absent ⇒ the
   * field carries a single, locale-agnostic value. Orthogonal to `type`: a
   * `'string'` or `'enum-ref'` field can also be localized.
   */
  coverage?:   'localized'
  /**
   * RESPONSIVE-CAPABLE (per-breakpoint authoring — Builder.io/Framer idiom). Marks a
   * field whose value may be authored as a `ResponsiveVal<T>` — a per-breakpoint map
   * (`{ default, md, lg, … }`, pure DATA — Law 2) that the render layer already lowers
   * to the container-query cascade (`resolveResponsive` / `resolveGrid`). Present ⇒ the
   * inspector's ONE value-authoring control offers the "responsive" MODE (edit this
   * prop's value AT the active breakpoint), composably beside literal / bound. Absent ⇒
   * the field is a single, breakpoint-agnostic value — byte-identical to today (Law 8 /
   * OCP: a new per-breakpoint capability = a populated optional flag; PropField, the
   * registry, and the Inspector interfaces are UNCHANGED). Orthogonal to `type` (a
   * `number`/`string`/`color` field can be responsive) and to binding (each breakpoint
   * entry may itself be a literal OR a `{ $bind }` — the render seam resolves bindings
   * INSIDE a responsive object). An unset breakpoint HONESTLY inherits the next-larger
   * set value (Law 11), exactly as the CSS `var()` fallback chain does — never fabricated.
   */
  responsive?: boolean
  /**
   * NESTED-ITEM SCHEMA (D7 — deep authorability, ADR-022). The PropSchema of each
   * ITEM (when `type === 'array'`) or of the object's fields (when
   * `type === 'object'`). Present ⇒ the field is a STRUCTURED nested container,
   * authored via the recursive nested editor (item-by-item, each sub-field its own
   * control). Absent ⇒ the field stays OPAQUE and gracefully falls back to the
   * raw-JSON control — so every current `array`/`object` field is byte-identical
   * and un-migrated. This is an OPTIONAL FIELD on the existing `array`/`object`
   * types, NOT a new `PropFieldType` (Law 8 / OCP: new nested capability = a
   * populated optional field; `PropField`, `SliceMeta`, `NodeRegistry`, and
   * `Inspector` interfaces are UNCHANGED). Recursive: an `itemSchema` sub-field
   * may itself carry an `itemSchema` (arbitrary depth); the wire bridge
   * (`propSchemaToSubSchema`) and the dot-path grammar (`prop-path.ts`, numeric
   * segments — `items.0.value.measure`) already descend it losslessly.
   * DATA, not code — a nested PropSchema is Constructor-serializable (Law 2).
   */
  itemSchema?: PropSchema
  /**
   * Dot-path into an item used as its DISPLAY TITLE in the nested list editor
   * (e.g. `'label'`, `'id'`). Absent ⇒ the editor falls back to "Item N". Purely
   * presentational — never a write target, ignored unless `itemSchema` is present.
   */
  itemLabel?:  string
  /**
   * Item-level property groups for the nested Inspector (mirrors the top-level
   * `PropertyGroup` accordion sections, scoped to one item's `itemSchema`).
   * Ignored unless `itemSchema` is present.
   */
  itemGroups?: PropertyGroup[]
}

/** Ordered list of typed field descriptors for a slice's property panel. */
export type PropSchema = PropField[]

// ── PropertyGroup — Constructor property panel grouping (Retool/Appsmith) ──
//
//  Organises schema fields into labelled accordion sections in the Constructor
//  property panel. `fields` are dot-path field names into the config object.
//
export interface PropertyGroup {
  label:  LocaleString
  fields: string[]
}
