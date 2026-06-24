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
//    'modes'            — registered ModeId set (V4 — the `mode(s)` a mode-* leaf
//                         binds to: pick a registered mode, never type a raw id)
//
export type PropFieldSource =
  | 'cube.measures'
  | 'cube.dimensions'
  | 'cube.members'
  | 'dataSpecs'
  | 'tokens'
  | 'pages'
  | 'filterParams'
  | 'modes'
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
   * Coverage contract for the field's value. `'localized'` marks a field whose
   * value must be a complete `LocaleString` over ALL active locales — the
   * Inspector renders a per-locale input and enforces locale-coverage at
   * authoring time (shift-left of the V13/V14 gold-gate check). Absent ⇒ the
   * field carries a single, locale-agnostic value. Orthogonal to `type`: a
   * `'string'` or `'enum-ref'` field can also be localized.
   */
  coverage?:   'localized'
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
