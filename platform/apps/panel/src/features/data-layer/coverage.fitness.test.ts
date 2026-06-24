// ── Coverage Fitness #1 — the Constructor "build anything" gate ─────────────────
//
//  ADR (adr-constructor-vision-north-star) Fitness #1 — THE headline gate:
//
//    "For every DataSpec discriminant, every TransformStep op, every ParamDef
//     type, and every VisibilityExpr op, an authoring surface exists — no union
//     member falls through to raw JSON except `custom`."
//
//  This test is the STRUCTURAL definition of "a non-programmer can build anything
//  the renderer renders." It enumerates each capability FROM THE ENGINE SSOT (not
//  a hand-list) and asserts a Constructor authoring surface exists for it:
//
//    SSOT enumerated                         authoring surface asserted
//    ─────────────────────────────────────   ──────────────────────────────────────
//    TransformStep ops  listTransformOps()    op carries a PropSchema (getTransform
//                       (runtime registry)    StepSchema) OR a bespoke StepForm
//    DataSpec types     DATASPEC_DISCRIMINANTS a dedicated DataSpec editor
//    ParamDef types     PARAMDEF_TYPES         a ParamDef control editor (V0)
//    VisibilityExpr ops VISIBILITY_OPS         a VisibilityExpr builder (V4)
//
//  COVERAGE_TODO is the EXPLICIT, roadmap-keyed allowlist of capabilities that do
//  NOT yet have a surface. The test is GREEN now (every gap is allowlisted) AND
//  the gaps are a VISIBLE, SHRINKING list: a NEW un-surfaced op/type FAILS the
//  build (it is neither surfaced nor allowlisted); building a surface and removing
//  the entry from COVERAGE_TODO is the only way to keep green. This makes the
//  remaining work a forcing function, not a hope.
//
//  Importing '@statdash/engine' runs the transform registry's module-init
//  side-effect, so listTransformOps() is populated.
//
import { describe, it, expect } from 'vitest'
import {
  listTransformOps, getTransformStepSchema,
  DATASPEC_DISCRIMINANTS, PARAMDEF_TYPES, VISIBILITY_OPS,
} from '@statdash/engine'

// ── Authoring surfaces present in the Constructor TODAY ─────────────────────────

/**
 * TransformStep ops with a hand-tuned bespoke StepForm (predate the schema
 * registry; keep their richer list/expression UX). Every OTHER op is surfaced
 * by the generic schema-driven TransformStepEditor iff it carries a PropSchema.
 */
const BESPOKE_STEP_FORMS = new Set(['derive', 'lookup', 'sort', 'filter'])

/** DataSpec discriminants with a dedicated (non-JSON-fallback) editor today. */
const DATASPEC_EDITORS = new Set(['query', 'timeseries', 'growth', 'ratio-list'])

/** ParamDef types with a Constructor control editor today. (V0 — not built yet.) */
const PARAMDEF_EDITORS = new Set<string>()

/** VisibilityExpr ops with a Constructor condition-builder today. (V4 — not built.) */
const VISIBILITY_EDITORS = new Set<string>()

// ── COVERAGE_TODO — the explicit, roadmap-keyed gap allowlist ───────────────────
//
//  Each entry: a capability with NO authoring surface yet, tagged with the
//  roadmap version (V0–V4) that closes it. A capability is allowed to lack a
//  surface ONLY if it is listed here. `custom` is PERMANENT (a code-resolver ref,
//  never free code — Law 2 / non-programmer safety).
//
const COVERAGE_TODO = {
  transformOps: {
    // joinByField carries already-resolved EngineRow[] (the caller resolves any
    // DataSpec to rows first) — NOT declaratively authorable by a non-programmer.
    // Permanent allowlist (same class as DataSpec `custom`): a programmatic op.
    joinByField: 'PERMANENT — carries resolved EngineRow[], not a declarative shape',
  },
  dataSpecs: {
    // V2 — remaining DataSpec editors (recursive / structured).
    'row-list':  'V2 — RowSpec[] editor (code/label/color/negate/isTotal/pctOf)',
    'by-mode':   'V2 — recursive per-ModeId sub-DataSpec editor',
    'pivot':     'V2 — rows/keyField/valueFields/colors editor',
    'transform': 'V2 — source+steps+encoding editor (reuse PipelineBuilder)',
    // PERMANENT — a code-resolver ref dropdown at most; never free code (Law 2).
    'custom':    'PERMANENT — resolver-name reference only, never authorable code',
  },
  paramDefs: {
    // V0 — page-level FilterSchema/ParamDef authoring (the single biggest gap:
    // a statistical dashboard IS its filters). None authorable yet.
    'hidden':       'V0 — FilterSchema editor (hidden URL-state param)',
    'year-select':  'V0 — FilterSchema editor (year ↔ range control)',
    'cascade':      'V0 — FilterSchema editor (2-level hierarchical select)',
    'select':       'V0 — FilterSchema editor (single dropdown, cube.members)',
    'range':        'V0 — FilterSchema editor (numeric range)',
    'multi-select': 'V0 — FilterSchema editor (multi checkbox group)',
    'chip-select':  'V0 — FilterSchema editor (colored chip strip)',
  },
  visibilityOps: {
    // V4 — node-level VisibilityExpr ("show when") condition builder. None yet.
    'eq':       'V4 — VisibilityExpr builder',
    'neq':      'V4 — VisibilityExpr builder',
    'in':       'V4 — VisibilityExpr builder',
    'isset':    'V4 — VisibilityExpr builder',
    'and':      'V4 — VisibilityExpr builder',
    'or':       'V4 — VisibilityExpr builder',
    'not':      'V4 — VisibilityExpr builder',
    'mode-is':  'V4 — VisibilityExpr builder',
    'mode-in':  'V4 — VisibilityExpr builder',
    'mode-not': 'V4 — VisibilityExpr builder',
  },
} as const

// ── The gate ────────────────────────────────────────────────────────────────────

/** A transform op is authorable iff it carries a PropSchema or has a bespoke form. */
function transformOpAuthorable(op: string): boolean {
  return getTransformStepSchema(op) != null || BESPOKE_STEP_FORMS.has(op)
}

describe('Coverage Fitness #1 — every renderer capability is authorable (or an explicit TODO)', () => {
  it('TransformStep ops: each registered op is surfaced OR allowlisted', () => {
    const ops = listTransformOps()
    expect(ops.length).toBeGreaterThan(0) // registry populated (module-init ran)

    const gaps: string[] = []
    for (const op of ops) {
      const authorable  = transformOpAuthorable(op)
      const allowlisted = op in COVERAGE_TODO.transformOps
      if (!authorable && !allowlisted) gaps.push(op)
      // A surfaced op must NOT also sit in the TODO (keep the gap list honest).
      if (authorable && allowlisted) gaps.push(`${op} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced transform ops not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('DataSpec discriminants: each is surfaced OR allowlisted', () => {
    const gaps: string[] = []
    for (const d of DATASPEC_DISCRIMINANTS) {
      const authorable  = DATASPEC_EDITORS.has(d)
      const allowlisted = d in COVERAGE_TODO.dataSpecs
      if (!authorable && !allowlisted) gaps.push(d)
      if (authorable && allowlisted) gaps.push(`${d} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced DataSpec types not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('ParamDef types: each is surfaced OR allowlisted', () => {
    const gaps: string[] = []
    for (const p of PARAMDEF_TYPES) {
      const authorable  = PARAMDEF_EDITORS.has(p)
      const allowlisted = p in COVERAGE_TODO.paramDefs
      if (!authorable && !allowlisted) gaps.push(p)
      if (authorable && allowlisted) gaps.push(`${p} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced ParamDef types not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('VisibilityExpr ops: each is surfaced OR allowlisted', () => {
    const gaps: string[] = []
    for (const op of VISIBILITY_OPS) {
      const authorable  = VISIBILITY_EDITORS.has(op)
      const allowlisted = op in COVERAGE_TODO.visibilityOps
      if (!authorable && !allowlisted) gaps.push(op)
      if (authorable && allowlisted) gaps.push(`${op} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced VisibilityExpr ops not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('COVERAGE_TODO is keyed to KNOWN union members only (no stale/typo entries)', () => {
    // A stale allowlist entry (a member that no longer exists) is itself drift —
    // catch it so the gap list stays an accurate mirror of the real unions.
    const allOps    = new Set(listTransformOps())
    const allSpecs  = new Set<string>(DATASPEC_DISCRIMINANTS)
    const allParams = new Set<string>(PARAMDEF_TYPES)
    const allVis    = new Set<string>(VISIBILITY_OPS)

    expect(Object.keys(COVERAGE_TODO.transformOps).filter((o) => !allOps.has(o))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.dataSpecs).filter((d) => !allSpecs.has(d))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.paramDefs).filter((p) => !allParams.has(p))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.visibilityOps).filter((o) => !allVis.has(o))).toEqual([])
  })
})
