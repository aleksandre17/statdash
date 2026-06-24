// ── visibility-schemas.ts — authoring surface per VisibilityExpr op [V4] ───────
//
//  Each built-in VisibilityExpr op declares its Constructor authoring surface,
//  registered alongside the union member (the module-init side-effect below) —
//  OCP: a new op = a new union member (visibility.ts) + a registration here, and
//  it becomes fully authorable through the SAME generic Inspector that renders
//  node / panel / chrome / transform-step / ParamDef properties. No bespoke per-op
//  form, no second form engine (the ADR mandate). This mirrors param-schemas.ts /
//  op-schemas.ts EXACTLY — one rung down: a VisibilityExpr op instead of a
//  ParamDef / TransformStep.
//
//  LEAF ops (eq/neq/in/isset/mode-*) carry a PropSchema (registerVisibilityLeaf
//  Schema), rendered by the panel's visibilityLeafSchemaSource. COMPOSITE ops
//  (and/or/not) carry NO schema — their "fields" are CHILD VisibilityExprs, which
//  the recursive VisibilityBuilder renders directly — so they are recorded with
//  registerVisibilityComposite (the OCP marker the coverage gate counts).
//
//  PICK-DON'T-TYPE (Law 2 declarative authoring):
//    • `param` (eq/neq/in/isset) is an 'enum-ref' on the 'filterParams' source —
//      the author PICKS one of the page's authored filter controls, never types a
//      raw param name. `is`/`values` then scope to that param's dimension members
//      via 'cube.members' (sourceDim: 'param') where the binding is resolvable.
//    • `mode`/`modes` (mode-*) are 'enum-ref' on the 'modes' source — the author
//      PICKS a registered ModeId, never types a raw mode string.
//
//  COLLECTION FIELDS (`in.values`, `mode-in.modes`) carry a list value. They use
//  the typed 'array' field — the documented, bounded sub-editor SCOPED to that one
//  field (the same escape hatch op-schemas / param-schemas use for collections).
//  Still schema-driven: the op DECLARES the field, its kind, label, required-ness.
//  A future slice can promote them to a multi-pick chip control by registering a
//  new FieldControl — the Inspector body never changes.
//
import type { PropSchema } from './prop-schema'
import {
  registerVisibilityLeafSchema,
  registerVisibilityComposite,
} from './visibility-schema-registry'

const bi = (ka: string, en: string) => ({ ka, en })

// ── Shared fields ─────────────────────────────────────────────────────────────
//  `param` binds to the active page's authored ParamDefs (pick-don't-type). The
//  member-valued fields (`is`/`values`) scope to that param's dimension members.
const paramField = {
  field: 'param', type: 'enum-ref' as const, source: 'filterParams' as const, required: true,
  label: bi('პარამეტრი', 'Param'),
}

// ── eq / neq — equality leaves: { param, is } ─────────────────────────────────
//  `is` is the value the param must (eq) / must-not (neq) equal. Bound to the
//  chosen param's dimension members (cube.members scoped via sourceDim:'param') so
//  the author picks a real member; falls back to the profile's first dimension
//  when the param→dimension link is not resolvable (fail-soft EnumRefField).
export const eqSchema: PropSchema = [
  paramField,
  { field: 'is', type: 'enum-ref', source: 'cube.members', sourceDim: 'param',
    label: bi('უდრის', 'Equals') },
]

export const neqSchema: PropSchema = [
  paramField,
  { field: 'is', type: 'enum-ref', source: 'cube.members', sourceDim: 'param',
    label: bi('არ უდრის', 'Not equals') },
]

// ── in — membership leaf: { param, values[] } ─────────────────────────────────
export const inSchema: PropSchema = [
  paramField,
  { field: 'values', type: 'array', required: true,
    label: bi('მნიშვნელობებში (["a","b"])', 'In values (["a","b"])') },
]

// ── isset — presence leaf: { param } ──────────────────────────────────────────
//  True when the param has a non-empty selection. No value field — presence only.
export const issetSchema: PropSchema = [
  paramField,
]

// ── mode-is / mode-not — mode-equality leaves: { mode } ───────────────────────
//  `mode` binds to the registered ModeId set (pick-don't-type).
const modeField = {
  field: 'mode', type: 'enum-ref' as const, source: 'modes' as const, required: true,
  label: bi('რეჟიმი', 'Mode'),
}

export const modeIsSchema:  PropSchema = [modeField]
export const modeNotSchema: PropSchema = [
  { ...modeField, label: bi('რეჟიმი (გარდა)', 'Mode (except)') },
]

// ── mode-in — mode-membership leaf: { modes[] } ───────────────────────────────
export const modeInSchema: PropSchema = [
  { field: 'modes', type: 'array', required: true,
    label: bi('რეჟიმებში (["year","range"])', 'In modes (["year","range"])') },
]

// ── Registration (the OCP side-effect — imported by config/index.ts) ──────────
//  Each VisibilityExpr op carries its surface. Adding an op here (with its union
//  member in visibility.ts and its case in evalVisibility) makes it authorable
//  with zero Constructor code — Coverage Fitness #1 then sees it surfaced.
registerVisibilityLeafSchema('eq',       eqSchema)
registerVisibilityLeafSchema('neq',      neqSchema)
registerVisibilityLeafSchema('in',       inSchema)
registerVisibilityLeafSchema('isset',    issetSchema)
registerVisibilityLeafSchema('mode-is',  modeIsSchema)
registerVisibilityLeafSchema('mode-not', modeNotSchema)
registerVisibilityLeafSchema('mode-in',  modeInSchema)

// Composites: no PropSchema (children are sub-exprs) — the recursive builder
// renders the sub-tree. Recorded so the coverage gate counts them as surfaced.
registerVisibilityComposite('and')
registerVisibilityComposite('or')
registerVisibilityComposite('not')
