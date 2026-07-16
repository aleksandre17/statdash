// ── param-schemas.ts — authoring PropSchema per ParamDef type [V0] ─────────────
//
//  Each built-in ParamDef type declares the PropSchema the Constructor renders to
//  author a page-level filter control of that type. The type CARRIES its schema
//  (registered alongside the union in ./param-schemas index side-effect — see the
//  registerParamSchema calls at the bottom) — OCP: a new ParamDef type = a new
//  union member + a new renderer (packages/react) + a schema here, and it becomes
//  fully authorable through the SAME generic Inspector that renders node / panel /
//  chrome / transform-step properties (no bespoke per-control form, no 2nd engine).
//
//  WHY core (not the panel): the schema is part of the type's authoring contract
//  (its editor is as much a property of the control as its renderer). Co-locating
//  it with the union (core) is the SSOT; the arrow lets core host PropSchema.
//  This mirrors op-schemas.ts (transform ops) EXACTLY — the just-shipped V1
//  template — one rung down: a ParamDef instead of a TransformStep.
//
//  PICK-DON'T-TYPE (Law 2 declarative authoring): the dimension `key` and every
//  cube-bound default are `enum-ref` fields wired to the cube-profile discovery
//  source ('cube.dimensions' / 'cube.members'), so the author PICKS a real
//  dimension / member of the bound dataset rather than hand-typing a raw code.
//  A 'cube.members' default is dimension-scoped via `sourceDim: 'key'` — its
//  member list follows the dimension chosen in the sibling `key` field.
//
//  COLLECTION FIELDS (options / years / tree): these carry a recursive source
//  shape (OptionsSource / ChipSource / YearsSource / CascadeNode[]) — the SAME
//  class of structured leaf that op-schemas authors via the typed 'object'/'array'
//  sub-editor (the documented, bounded escape hatch SCOPED to one sub-field, not
//  the whole control). Still schema-driven: the type DECLARES the field, its kind,
//  label, and required-ness; only the leaf collection shape is JSON. A future
//  slice can promote any of these to a richer source-builder control by
//  registering a new FieldControl — the Inspector body never changes.
//
import type { PropSchema } from './prop-schema'
import { registerParamSchema } from './param-schema-registry'

const bi = (ka: string, en: string) => ({ ka, en })

// ── Shared fields every control's editor offers ───────────────────────────────
//  `label` is a localized LocaleString (per-locale authoring + locale-coverage
//  enforcement via coverage:'localized'). `default` is the URL-serialized initial
//  value — for cube-bound types it is a member of the chosen dimension.
const labelField = {
  field: 'label', type: 'LocaleString' as const, coverage: 'localized' as const,
  label: bi('წარწერა', 'Label'),
}

// ── hidden — URL-state-only param (never rendered) ────────────────────────────
//  Carries state, no visible control. The author sets only the default value.
//  `alwaysResolve` (optional, default off): a bar-independent default — a span/cube
//  derived state variable (e.g. spanFrom/spanTo) resolves in EVERY mode, not only
//  while its owning bar is visible. Lets it be declared once instead of per bar.
export const hiddenSchema: PropSchema = [
  { field: 'default', type: 'string', label: bi('მნიშვნელობა (URL-მდგომარეობა)', 'Value (URL state)') },
  { field: 'alwaysResolve', type: 'boolean',
    label: bi('ყოველთვის გამოთვლა (ბარისგან დამოუკიდებლად)', 'Always resolve (bar-independent)') },
]

// ── year-select — year selector ───────────────────────────────────────────────
//  `key` is the time dimension. `years` is a YearsSource (static list / query /
//  api) — the structured source leaf. Perspective-scoped visibility is declared via
//  `visibleWhen: perspective-is` (no privileged range-toggle key — System A retired).
export const yearSelectSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('დროის განზომილება', 'Time dimension') },
  labelField,
  { field: 'years', type: 'object', label: bi('წლების წყარო (static/query/api)', 'Years source (static/query/api)') },
  { field: 'default', type: 'string', label: bi('ნაგულისხმევი წელი', 'Default year') },
]

// ── cascade — two-level hierarchical select ───────────────────────────────────
//  `tree` is a CascadeNode[] hierarchy (structured leaf). `dim` (cube-bound) is
//  the dimension the deepest selection writes into ctx.dims.
export const cascadeSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('განზომილება', 'Dimension') },
  labelField,
  { field: 'tree', type: 'array', required: true,
    label: bi('იერარქია [{id,value,children?}]', 'Hierarchy [{id,value,children?}]') },
  { field: 'dim', type: 'enum-ref', source: 'cube.dimensions',
    label: bi('კონტექსტის განზომილება', 'Context dimension') },
  { field: 'default', type: 'string', label: bi('ნაგულისხმევი (id-ბილიკი)', 'Default (id path)') },
]

// ── select — single-value dropdown ────────────────────────────────────────────
//  `key` is the dimension; `options` is an OptionsSource (cube-bound query / api /
//  static — the structured source leaf). `default` picks a member of `key`.
export const selectSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('განზომილება', 'Dimension') },
  labelField,
  { field: 'options', type: 'object', required: true,
    label: bi('პარამეტრების წყარო (static/query/api)', 'Options source (static/query/api)') },
  { field: 'emptyLabel', type: 'string', label: bi('„ყველა“ ვარიანტის წარწერა', '"All" option label') },
  { field: 'default', type: 'enum-ref', source: 'cube.members', sourceDim: 'key',
    label: bi('ნაგულისხმევი წევრი', 'Default member') },
]

// ── range — numeric from–to range ─────────────────────────────────────────────
export const rangeSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('განზომილება', 'Dimension') },
  labelField,
  { field: 'min',  type: 'number', label: bi('მინიმუმი', 'Min') },
  { field: 'max',  type: 'number', label: bi('მაქსიმუმი', 'Max') },
  { field: 'step', type: 'number', label: bi('ბიჯი', 'Step') },
  { field: 'unit', type: 'string', label: bi('ერთეული', 'Unit') },
  { field: 'default', type: 'string', label: bi('ნაგულისხმევი ("from,to")', 'Default ("from,to")') },
]

// ── multi-select — multi-value checkbox group ─────────────────────────────────
export const multiSelectSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('განზომილება', 'Dimension') },
  labelField,
  { field: 'options', type: 'object', required: true,
    label: bi('პარამეტრების წყარო (static/query/api)', 'Options source (static/query/api)') },
  { field: 'emptyLabel', type: 'string', label: bi('ცარიელი არჩევანის წარწერა („ყველა“)', 'Empty-selection label ("All")') },
  { field: 'default', type: 'string', label: bi('ნაგულისხმევი ("a,b,c")', 'Default ("a,b,c")') },
]

// ── chip-select — colored chip strip ──────────────────────────────────────────
//  `options` is a ChipSource (supports colorField). `multi` toggles single ↔
//  multi inclusion.
export const chipSelectSchema: PropSchema = [
  { field: 'key', type: 'enum-ref', source: 'cube.dimensions', required: true,
    label: bi('განზომილება', 'Dimension') },
  labelField,
  { field: 'options', type: 'object', required: true,
    label: bi('ჩიპების წყარო (colorField-ით)', 'Chip source (with colorField)') },
  { field: 'multi', type: 'boolean', label: bi('მრავალარჩევანი', 'Multi-select') },
  { field: 'default', type: 'enum-ref', source: 'cube.members', sourceDim: 'key',
    label: bi('ნაგულისხმევი წევრი', 'Default member') },
]

// ── Registration (the OCP side-effect — imported by config/index.ts) ──────────
//  Each ParamDef type carries its schema. Adding a type here (with its renderer in
//  packages/react and its union member in filter-params.ts) makes it authorable
//  with zero Constructor code — Coverage Fitness #1 then sees it surfaced.
registerParamSchema('hidden',       hiddenSchema)
registerParamSchema('year-select',  yearSelectSchema)
registerParamSchema('cascade',      cascadeSchema)
registerParamSchema('select',       selectSchema)
registerParamSchema('range',        rangeSchema)
registerParamSchema('multi-select', multiSelectSchema)
registerParamSchema('chip-select',  chipSelectSchema)
