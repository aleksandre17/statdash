// ── Transform step registry [N12] ─────────────────────────────────────
//
//  Open-for-extension registry of TransformStep handlers.
//  Built-in steps register at module init (transform/index.ts).
//  External steps register via registerTransformStep() — OCP pattern.
//
//  Constructor catalog: listTransformOps() returns sorted op codes.
//

import type { RawRow, TransformStep, PipelineContext } from './types'
import type { PropSchema } from '../../config/prop-schema'

/**
 * Handler signature for a transform step.
 * Receives the full TransformStep union; discriminate by step.op inside if needed.
 */
export type StepFn = (rows: RawRow[], step: TransformStep, ctx?: PipelineContext) => RawRow[]

/**
 * The seven canonical author-facing intent-verbs (ADR-046 · SPEC §1.2). Each is a
 * PROJECTION over the concrete op registry: an op DECLARES one `category` at
 * registration and the 7-verb palette / rail / "+add step" menu are views of that
 * declaration (the Bounded-Element declaration→projection ideal — never an external
 * per-op switch). The full ~19-op registry stays the SSOT of runtime behaviour;
 * `category` is the additive lens that groups them for perception.
 *
 * ADDITIVE / behaviour-neutral seam (wave W-P0): the type + optional field exist so
 * W-P3 can assign each op its category. NO built-in op declares one yet, so every
 * `getTransformStepCategory` is `undefined` and runtime dispatch is byte-identical.
 */
export type StepCategory =
  | 'get'        // Source — what data (the `source` head op, W-P4)
  | 'filter'     // keep rows
  | 'aggregate'  // group & summarize
  | 'derive'     // add a calculated field
  | 'reshape'    // wide↔long, pick columns
  | 'combine'    // bring in another source
  | 'sort'       // order rows

/**
 * The seven verbs in canonical author-facing order (Get first — the source head).
 * The palette / "+add step" menu / rail iterate THIS order; each verb's concrete ops
 * are `getOpsInCategory(verb)` — a projection, never a hand-list (ADR-046 · SPEC §1.2).
 */
export const STEP_CATEGORIES: readonly StepCategory[] = [
  'get', 'filter', 'aggregate', 'derive', 'reshape', 'combine', 'sort',
] as const

const _registry   = new Map<string, StepFn>()
const _schemas    = new Map<string, PropSchema>()
const _categories = new Map<string, StepCategory>()

/**
 * Register a transform step handler — and, optionally, the AUTHORING PropSchema
 * the Constructor renders to edit a step of this op (OCP: the op is the SSOT for
 * BOTH its runtime behavior AND its editor; the panel's PipelineBuilder reads
 * this schema through the generic Inspector, never a bespoke per-op form).
 *
 * Last-write-wins — allows overriding built-ins in tests or plugins. A plugin
 * that registers a new op + its schema becomes fully authorable with zero
 * Constructor code (the [V1] coverage guarantee).
 */
export function registerTransformStep(
  op:        string,
  fn:        StepFn,
  schema?:   PropSchema,
  category?: StepCategory,
): void {
  _registry.set(op, fn)
  if (schema)   _schemas.set(op, schema)
  if (category) _categories.set(op, category)
}

/** Lookup a handler by op — the single dispatch source for applyStep(). */
export function getTransformStep(op: string): StepFn | undefined {
  return _registry.get(op)
}

/**
 * The authoring PropSchema for an op, or undefined if the op declared none yet
 * (the Constructor falls back to a raw-JSON editor for those). The shrinking set
 * of schema-less ops is the visible COVERAGE_TODO gap (Fitness #1).
 */
export function getTransformStepSchema(op: string): PropSchema | undefined {
  return _schemas.get(op)
}

/**
 * Returns the sorted list of registered op codes.
 * Used by the Constructor to populate the transform-step catalog.
 */
export function listTransformOps(): string[] {
  return [..._registry.keys()].sort()
}

/** Sorted list of op codes that carry an authoring PropSchema. */
export function listTransformOpSchemas(): string[] {
  return [..._schemas.keys()].sort()
}

/**
 * The author-facing intent-verb an op projects into (ADR-046 · SPEC §1.2), or
 * `undefined` if the op has not declared one yet. W-P0 seam: every op returns
 * `undefined` today; W-P3 assigns each op its category and `FF-VERB-COVERAGE`
 * flips from "pin the inventory" to "every op is categorized (no orphan)".
 */
export function getTransformStepCategory(op: string): StepCategory | undefined {
  return _categories.get(op)
}

/**
 * Sorted list of registered ops that carry NO `category` yet — the shrinking
 * COVERAGE_TODO the 7-verb palette closes at W-P3. Since W-P3 assigns every
 * built-in op its category, this is `[]` for the built-in inventory; `FF-VERB-
 * COVERAGE` asserts it stays `[]`, so a NEW op added without a category decision
 * surfaces here loudly (SPEC §1.2).
 */
export function listUncategorizedOps(): string[] {
  return [..._registry.keys()].filter((op) => !_categories.has(op)).sort()
}

/**
 * The registered ops projecting into a given verb category, sorted — the SSOT
 * behind the 7-verb palette (ADR-046 · SPEC §1.2). The palette is a PROJECTION of
 * these `category` declarations: an op declares its verb once (at registration), and
 * the author-facing palette/rail/"+add step" are VIEWS of that field — never a hand
 * list. An empty result means no op backs that verb yet (e.g. `get` until W-P4
 * registers `source`); the palette renders such a verb as non-insertable, honestly.
 */
export function getOpsInCategory(category: StepCategory): string[] {
  return [..._categories.entries()]
    .filter(([, cat]) => cat === category)
    .map(([op]) => op)
    .sort()
}

/**
 * The full `category → ops` projection (every categorized op, grouped by verb in the
 * canonical `STEP_CATEGORIES` order). The whole-palette SSOT: a total projection when
 * `listUncategorizedOps()` is `[]` (FF-VERB-COVERAGE). Verbs with no backing op yet
 * (e.g. `get`) map to `[]`.
 */
export function listOpsByCategory(): Record<StepCategory, string[]> {
  const out = Object.fromEntries(
    STEP_CATEGORIES.map((c) => [c, [] as string[]]),
  ) as Record<StepCategory, string[]>
  for (const [op, cat] of _categories.entries()) out[cat].push(op)
  for (const c of STEP_CATEGORIES) out[c].sort()
  return out
}
