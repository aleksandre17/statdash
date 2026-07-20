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
  listTransformOps, getTransformStepSchema, getParamSchema,
  isVisibilityOpAuthorable,
  listPerspectiveScopeKeys, getPerspectiveScopeKeySchema,
  DATASPEC_DISCRIMINANTS, PARAMDEF_TYPES, VISIBILITY_OPS,
  desugarToPipeline,
} from '@statdash/engine'
import type { DataSpec } from '@statdash/engine'

// ── Authoring surfaces present in the Constructor TODAY ─────────────────────────

/**
 * TransformStep ops with a hand-tuned bespoke StepForm (predate the schema
 * registry; keep their richer list/expression UX). Every OTHER op is surfaced
 * by the generic schema-driven TransformStepEditor iff it carries a PropSchema.
 */
const BESPOKE_STEP_FORMS = new Set(['derive', 'lookup', 'sort', 'filter'])

/**
 * DataSpec discriminants with a dedicated (non-JSON-fallback) editor today. As of
 * [V2] this is EVERY non-`custom` discriminant — the full authoring surface:
 *   query/timeseries/growth/ratio-list  — scalar/list editors (V0–V1)
 *   row-list                            — RowListEditor (RowSpec[] via the Inspector)
 *   transform                           — TransformEditor (PipelineBuilder + EncodingEditor)
 *   pivot                               — PivotEditor (friendly rows/keyField/valueFields/colors)
 *   metric                              — MetricSpecEditor (AR-50 M-SQ: governed metric picker +
 *                                         generic by/time grain + where pins → a MetricSpec)
 * Every discriminant now has a dedicated editor; the `custom`/`fn` escape hatch was
 * removed from the union wholesale (ENG-16) — nothing falls through to raw JSON.
 */
const DATASPEC_EDITORS = new Set([
  'query', 'timeseries', 'growth', 'ratio-list',
  'row-list', 'transform', 'pivot', 'metric',
])

/**
 * ParamDef types are surfaced exactly like transform ops [V0]: a type is
 * authorable iff it CARRIES an authoring PropSchema in the engine param-schema
 * registry (getParamSchema), which the generic Inspector renders via the panel's
 * filterParamSchemaSource (ParamDefEditor) — no bespoke per-control form. There is
 * no hand-list of "editors": the schema registry IS the surface set (a new type
 * with a schema is surfaced; one that loses its schema FAILS this gate). Mirrors
 * BESPOKE_STEP_FORMS being unnecessary for params (every type is schema-driven).
 */
function paramDefAuthorable(type: string): boolean {
  return getParamSchema(type) != null
}

/**
 * VisibilityExpr ops are surfaced exactly like transform ops / ParamDefs [V4]: an
 * op is authorable iff it CARRIES an authoring surface in the engine visibility
 * registry (isVisibilityOpAuthorable) — a leaf PropSchema (eq/neq/in/isset/mode-*)
 * rendered through the generic Inspector via the panel's visibilityLeafSchemaSource
 * (VisibilityLeafEditor), or a composite marker (and/or/not) handled by the
 * recursive VisibilityBuilder. There is no hand-list of "editors": the registry IS
 * the surface set (a new op with a surface is surfaced; one that loses it FAILS
 * this gate). Mirrors paramDefAuthorable — schema-driven, no bespoke per-op form.
 */
function visibilityOpAuthorable(op: string): boolean {
  return isVisibilityOpAuthorable(op)
}

/**
 * PerspectiveScope keys are surfaced exactly like transform ops / ParamDefs / Vis ops
 * [VISION #3 / SYNTHESIS §1.4]: a scope key is authorable iff it CARRIES an authoring
 * PropSchema in the engine perspective-scope-key registry (getPerspectiveScopeKeySchema),
 * which the Perspectives pane (P-final) renders through the generic Inspector via a
 * perspectiveScopeSchemaSource — no bespoke per-key form. The registry IS the surface
 * set: a key registered (timeBinding/metric) is surfaced by construction; a future
 * deferred key (store/dims/blend/facet) is NOT enumerated until it registers (a new
 * door = a register() call, OCP) — so the gate cannot silently drift, and the deferred
 * keys are a VISIBLE roadmap in COVERAGE_TODO.perspectiveScope below.
 */
function perspectiveScopeKeyAuthorable(key: string): boolean {
  return getPerspectiveScopeKeySchema(key) != null
}

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
    //
    // Its DECLARATIVE front-door is the `blend` op (B0): blend NAMES a secondary
    // store + ObsQuery + shared-dim key (pure data, Law 2), carries a PropSchema
    // (so it is surfaced, NOT allowlisted), and the react binding layer desugars
    // blend → joinByField. So the "cross-store join" capability IS authorable via
    // blend; joinByField stays the schema-less engine + permanent programmer
    // escape underneath. (D3 / adr-data-blending-decision.)
    joinByField: 'PERMANENT — carries resolved EngineRow[]; declarative front-door is `blend`',
  },
  dataSpecs: {
    // V2 + ENG-16 — the SEVEN original discriminants each have a dedicated editor
    // rendered through DataSpecEditor, and the dead `custom`/`fn` escape hatch was
    // REMOVED from the union wholesale (the single extension path is `registerSpec`,
    // not a competing function-pointer):
    //   query     → QueryEditor
    //   row-list  → RowListEditor    (RowSpec[] authored via the generic Inspector,
    //                                 schema carried in the engine rowspec registry)
    //   timeseries/growth/ratio-list → dedicated editors
    //   transform → TransformEditor   (PipelineBuilder + EncodingEditor + JSON source)
    //   pivot     → PivotEditor       (friendly rows/keyField/valueFields/colors)
    //   metric    → MetricSpecEditor  (AR-50 M-SQ-EDITOR: SHIPPED — governed metric picker
    //                                  reusing the useMetricCatalog registry view + a generic
    //                                  by/time grain + where pins, emitting a pure MetricSpec)
    //
    // `metric` (AR-50 M-SQ) shipped its authoring pane — the follow-on allowlist entry
    // was REMOVED, the forcing function done.
    //
    // `pipeline` (ADR-046 W-P4) is DELIBERATELY not a discriminant-picker editor: SPEC §3.4
    // RETIRES the 8-type Select from the author plane — a pipeline is authored through the
    // three-pane WORKBENCH (step rail + live grid + generated-query pane, W-P1/2/3), never
    // by choosing "pipeline" from a type menu. The workbench IS its authoring surface; the
    // Get card (source head) is a projection of the op registry's `category:'get'`. So it is
    // allowlisted here, not surfaced as a bespoke DataSpecEditor branch.
    pipeline: 'ADR-046 — authored via the three-pane data workbench, not a discriminant-picker editor (SPEC §3.4)',
  },
  paramDefs: {
    // V0 — page-level FilterSchema/ParamDef authoring is DONE. Every ParamDef
    // type now carries an authoring PropSchema (engine param-schema registry,
    // OCP) rendered through the generic Inspector (filterParamSchemaSource +
    // ParamDefEditor + the FiltersDrawer surface), bound to the cube-profile.
    // The allowlist is empty: a type without a schema now FAILS the gate.
  },
  visibilityOps: {
    // V4 — node-level VisibilityExpr ("show when") condition builder is DONE. Every
    // op now carries an authoring surface in the engine visibility registry (leaf
    // PropSchema or composite marker, OCP) rendered through the generic Inspector
    // (visibilityLeafSchemaSource + VisibilityLeafEditor) and the recursive
    // VisibilityBuilder (VisibilitySection in the node Inspector), bound to the
    // cube-profile / authored ParamDefs / registered modes. The allowlist is empty:
    // an op without a surface now FAILS the gate.
  },
  perspectiveScope: {
    // VISION #3 / SYNTHESIS §1.4 — the page-level PerspectiveAxis scope keys. The
    // engine perspective-scope-key registry registers `timeBinding` + `metric` TODAY
    // (the two real keys time-mode needs); both carry an authoring PropSchema → they
    // are SURFACED by construction (they will render in the Perspectives pane, P-final).
    //
    // The DEFERRED scope doors are NOT registered yet (a door opens with a real second
    // caller — OCP), so they are NOT enumerated by listPerspectiveScopeKeys() and need
    // NO allowlist entry to keep the gate green. This block is the VISIBLE roadmap of
    // those doors (documentation, not a live allowlist) so the future is legible:
    //   store  — multistore-D1   (a perspective reading a different cube)
    //   dims   — non-time pins    (a perspective pinning a non-time dimension)
    //   blend  — D3-PLANNER       (a compare/benchmark perspective)
    //   facet  — faceting door    (RELOCATED to PerspectiveAxis.render, SYNTHESIS §3.2 — NOT a scope key)
    // Each becomes a registerPerspectiveScopeKey() call when its trigger fires; it then
    // surfaces automatically and this comment shrinks.
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
      const authorable  = paramDefAuthorable(p)
      const allowlisted = p in COVERAGE_TODO.paramDefs
      if (!authorable && !allowlisted) gaps.push(p)
      if (authorable && allowlisted) gaps.push(`${p} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced ParamDef types not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('VisibilityExpr ops: each is surfaced OR allowlisted', () => {
    const gaps: string[] = []
    for (const op of VISIBILITY_OPS) {
      const authorable  = visibilityOpAuthorable(op)
      const allowlisted = op in COVERAGE_TODO.visibilityOps
      if (!authorable && !allowlisted) gaps.push(op)
      if (authorable && allowlisted) gaps.push(`${op} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced VisibilityExpr ops not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('PerspectiveScope keys: each registered key is surfaced OR allowlisted', () => {
    const keys = listPerspectiveScopeKeys()
    // Non-vacuous: the registry must be populated (module-init ran; timeBinding+metric).
    expect(keys.length, 'perspective-scope registry is empty — module-init did not run').toBeGreaterThan(0)

    const gaps: string[] = []
    for (const k of keys) {
      const authorable  = perspectiveScopeKeyAuthorable(k)
      const allowlisted = k in COVERAGE_TODO.perspectiveScope
      if (!authorable && !allowlisted) gaps.push(k)
      if (authorable && allowlisted) gaps.push(`${k} (surfaced but still in COVERAGE_TODO — remove it)`)
    }
    expect(gaps, `un-surfaced perspective-scope keys not in COVERAGE_TODO: ${gaps.join(', ')}`).toEqual([])
  })

  it('the store-aware value-cell kinds are a KNOWN subset of the discriminant union', () => {
    // Guard the FF-ALL-KINDS-SHAPED enumeration against a typo/rename in VALUE_CELL_KINDS.
    const all = new Set<string>(DATASPEC_DISCRIMINANTS)
    expect(VALUE_CELL_KINDS.filter((k) => !all.has(k))).toEqual([])
  })

  it('COVERAGE_TODO is keyed to KNOWN union members only (no stale/typo entries)', () => {
    // A stale allowlist entry (a member that no longer exists) is itself drift —
    // catch it so the gap list stays an accurate mirror of the real unions.
    const allOps    = new Set(listTransformOps())
    const allSpecs  = new Set<string>(DATASPEC_DISCRIMINANTS)
    const allParams = new Set<string>(PARAMDEF_TYPES)
    const allVis    = new Set<string>(VISIBILITY_OPS)
    const allScope  = new Set(listPerspectiveScopeKeys())

    expect(Object.keys(COVERAGE_TODO.transformOps).filter((o) => !allOps.has(o))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.dataSpecs).filter((d) => !allSpecs.has(d))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.paramDefs).filter((p) => !allParams.has(p))).toEqual([])
    expect(Object.keys(COVERAGE_TODO.visibilityOps).filter((o) => !allVis.has(o))).toEqual([])
    // perspectiveScope: the allowlist is empty today (deferred keys are doc-only, not
    // registered) — so any KEY in it must be a registered scope key (a stale/typo guard).
    expect(Object.keys(COVERAGE_TODO.perspectiveScope).filter((k) => !allScope.has(k))).toEqual([])
  })
})

// ── FF-ALL-KINDS-SHAPED — the store-aware value-cell kinds fold onto the spine (shrinking gap) ──
//
//  ADR-051 §Consequences / ADR-046 Addendum 4 (DU4). The store-aware VALUE-CELL discriminants
//  (each ENUMERATES coordinates and reads a scalar cell) fold onto the ONE `pipeline` spine via
//  the value-cell `source` variant, KIND BY KIND. This gate tracks the SHRINKING gap: a kind is
//  either FOLDED (`desugarToPipeline` lowers it to `pipeline` today) or on the explicit
//  NOT_YET_FOLDED allowlist (keeps the DU3 fallback lane). A newly-folded kind MUST be removed
//  from the allowlist to keep green (forcing function); a regression (a folded kind stops
//  lowering) FAILS. DU4a folds `timeseries` (the keystone); DU4b folds single-code `growth`
//  (source + window/derive YoY tail); ratio-list/row-list remain (DU4c/d).
//
//  Representative minimal spec per value-cell kind — enough to drive desugarToPipeline (pure,
//  no store/ctx). `desugarToPipeline` is the shaping SSOT (NOT the live `desugar()` switch,
//  which is deliberately un-flipped in DU4a), so this reflects the CAPABILITY, not activation.

const VALUE_CELL_KINDS = ['timeseries', 'growth', 'ratio-list', 'row-list'] as const

const NOT_YET_FOLDED = new Set<string>([
  // growth (single-code) FOLDED in DU4b — source(over=TIME_DIM) + window/derive YoY tail. The
  // representative below is single-code, so it lowers to `pipeline`. MULTI-CODE growth stays on
  // the direct resolver (its per-code store meta read → calc-metric browse, Add.2) but is NOT a
  // separate discriminant, so it is not tracked here — it is covered by the FF-PIPELINE-EQUIV
  // growth corpus (which asserts multi-code identity).
  'ratio-list', // DU4c — the MEASURE-axis explicit-cells form of the value-cell variant
  'row-list',   // DU4d — the MEASURE-axis explicit-cells form of the value-cell variant
])

const VALUE_CELL_REP: Record<(typeof VALUE_CELL_KINDS)[number], DataSpec> = {
  timeseries:   { type: 'timeseries', code: 'GDP', years: [2020] },
  growth:       { type: 'growth', code: 'GDP', years: [2019, 2020] },
  'ratio-list': { type: 'ratio-list', pairs: [{ code: 'D1', denom: 'GDP' }] },
  'row-list':   { type: 'row-list', rows: [{ code: 'GDP' }] },
}

describe('FF-ALL-KINDS-SHAPED — value-cell kinds fold onto the pipeline spine (shrinking gap)', () => {
  for (const kind of VALUE_CELL_KINDS) {
    const rep = VALUE_CELL_REP[kind]
    if (NOT_YET_FOLDED.has(kind)) {
      it(`${kind} — NOT yet folded (DU3 fallback lane); allowlisted`, () => {
        // Still identity: desugarToPipeline returns it UNCHANGED (its own discriminant),
        // so its direct resolver keeps it editable during the transition.
        expect(desugarToPipeline(rep).type).toBe(kind)
      })
    } else {
      it(`${kind} — FOLDED: desugarToPipeline lowers it to the pipeline spine`, () => {
        expect(desugarToPipeline(rep).type).toBe('pipeline')
      })
    }
  }

  it('timeseries folds to a value-cell `source` head (DU4a keystone)', () => {
    const lowered = desugarToPipeline(VALUE_CELL_REP.timeseries)
    expect(lowered.type).toBe('pipeline')
    const head = (lowered as Extract<DataSpec, { type: 'pipeline' }>).pipe[0]!
    expect(head.op).toBe('source')
    expect('over' in head).toBe(true)   // the value-cell discriminant (Add.4)
  })

  it('the gap is a VISIBLE, SHRINKING list — every kind is folded OR explicitly allowlisted', () => {
    // No value-cell kind may be silently unaccounted: it is either lowered to `pipeline`
    // today, or a NOT_YET_FOLDED entry with a DU4 roadmap tag. (A folded kind still sitting
    // in the allowlist also fails — keep the list honest.)
    const gaps: string[] = []
    for (const kind of VALUE_CELL_KINDS) {
      const folded      = desugarToPipeline(VALUE_CELL_REP[kind]).type === 'pipeline'
      const allowlisted = NOT_YET_FOLDED.has(kind)
      if (!folded && !allowlisted) gaps.push(kind)
      if (folded && allowlisted)   gaps.push(`${kind} (folded but still in NOT_YET_FOLDED — remove it)`)
    }
    expect(gaps, `value-cell kinds neither folded nor allowlisted: ${gaps.join(', ')}`).toEqual([])
  })
})
