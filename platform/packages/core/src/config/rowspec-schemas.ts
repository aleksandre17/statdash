// ── rowspec-schemas.ts — authoring PropSchema for a RowSpec [V2] ───────────────
//
//  A `row-list` DataSpec is an explicit list of RowSpec entries (the year-mode
//  shorthand: one row per measure). Each RowSpec CARRIES this authoring PropSchema
//  (registered via the module-init side-effect below) so it is authored through the
//  SAME generic Inspector that renders node / panel / chrome / transform-step /
//  ParamDef properties — no bespoke per-field form, no second form engine (the ADR
//  mandate / OCP). Mirrors param-schemas.ts / op-schemas.ts EXACTLY, one rung down:
//  a row entry instead of a page-filter control or a transform step.
//
//  PICK-DON'T-TYPE (Law 2 declarative authoring): `code` and `pctOf` are `enum-ref`
//  fields wired to the cube-profile measure source ('cube.measures'), so the author
//  PICKS a real measure of the bound dataset rather than hand-typing a raw code.
//  `label` is a localized LocaleString (per-locale authoring + coverage). `color`
//  is the color-picker control; `negate` / `isTotal` are toggles.
//
import type { PropSchema } from './prop-schema'
import { registerRowSpecSchema } from './rowspec-schema-registry'

const bi = (ka: string, en: string) => ({ ka, en })

// ── RowSpec — one entry of a row-list DataSpec ────────────────────────────────
//  code:    the measure this row reads (cube-bound — picked, never typed).
//  label:   localized display label (optional; blank → omitted).
//  color:   series color (optional).
//  negate:  flip the sign of the value (e.g. imports shown as negative).
//  isTotal: mark this row as a total (renderer styles it distinctly).
//  pctOf:   express this row as a % of another measure's value (cube-bound).
export const rowSpecSchema: PropSchema = [
  { field: 'code', type: 'enum-ref', source: 'cube.measures', required: true,
    label: bi('მაჩვენებელი (კოდი)', 'Measure (code)') },
  { field: 'label', type: 'LocaleString', coverage: 'localized',
    label: bi('წარწერა', 'Label') },
  { field: 'color', type: 'color',
    label: bi('ფერი', 'Color') },
  { field: 'negate', type: 'boolean',
    label: bi('ნიშნის შებრუნება', 'Negate sign') },
  { field: 'isTotal', type: 'boolean',
    label: bi('სულ (Total)', 'Is total') },
  { field: 'pctOf', type: 'enum-ref', source: 'cube.measures',
    label: bi('% — მაჩვენებლისგან', '% of measure') },
]

// ── Registration (the OCP side-effect — imported by src/index.ts) ─────────────
//  RowSpec carries its schema. The `row-list` editor reads it via the engine
//  registry, so Coverage Fitness #1 sees `row-list` surfaced.
registerRowSpecSchema(rowSpecSchema)
