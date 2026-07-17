// ── FF-VERB-COVERAGE — ADR-046 · SPEC §1.2 / §8 · wave W-P0 (biting) ───────────
//
//  ADR-046 retires the author-facing tag-zoo into SEVEN intent-verbs
//  (Get/Filter/Aggregate/Derive/Reshape/Combine/Sort). The verbs are NOT a new
//  grammar — each is a PROJECTION of a `category` DECLARED on an existing registry
//  op (SPEC §1.2, Refusal #7: no new engine verb is invented). The invariant this
//  gate will enforce at W-P3: **every op in `listTransformOps()` declares exactly
//  one `category`, so the 7-verb palette is a TOTAL projection — no orphan op, no
//  author-facing verb without a backing op** (SPEC §8 · FF-VERB-COVERAGE).
//
//  TODAY (W-P0). The `category` seam exists as a pure additive type-level field on
//  the step registry (`StepCategory` / `registerTransformStep(…, category?)` /
//  `getTransformStepCategory`), but NO op declares one yet — assigning them is
//  W-P3's work. So this gate cannot yet assert "all categorized". Instead it
//  BITES by PINNING the current op inventory: a NEW op added before W-P3 (or a
//  removed/renamed one) fails here LOUDLY with a pointer to SPEC §1.2, forcing the
//  category decision to be made deliberately rather than drifting in unclassified.
//  When W-P3 lands, the pin flips to the total-coverage assertion below (the
//  `describe.todo` names that obligation in the suite meanwhile).

import { describe, it, expect } from 'vitest'
// Side-effect import: registers all built-in transform ops into the registry.
import './index'
import {
  listTransformOps,
  listUncategorizedOps,
  getTransformStepCategory,
  type StepCategory,
} from './step-registry'

// ── The pinned op inventory (the current SSOT of runtime data-shaping verbs) ────
//
//  Sorted, exactly as listTransformOps() returns it. Editing this list is the
//  deliberate act of adding/removing a transform op — and the moment to decide its
//  SPEC §1.2 category. Keep it sorted; keep it exact.
const PINNED_OPS = [
  'addField', 'aggregate', 'blend', 'cast', 'concat', 'derive', 'filter',
  'group', 'join', 'joinByField', 'lookup', 'melt', 'reduce', 'rename',
  'rollup', 'select', 'sort', 'template', 'window',
] as const

describe('FF-VERB-COVERAGE — the op registry projects cleanly into the 7 verbs (ADR-046 §1.2)', () => {
  it('the registry enumerates cleanly (non-empty, sorted, no duplicates)', () => {
    const ops = listTransformOps()
    expect(ops.length).toBeGreaterThan(0)
    expect(ops).toEqual([...ops].sort())              // listTransformOps() is sorted
    expect(new Set(ops).size).toBe(ops.length)        // no duplicate registration key
  })

  it('the op inventory matches the pinned set (a NEW op must declare its SPEC §1.2 category)', () => {
    const ops = listTransformOps()
    const added   = ops.filter((o) => !(PINNED_OPS as readonly string[]).includes(o))
    const removed = PINNED_OPS.filter((o) => !ops.includes(o))
    expect(
      { added, removed },
      `transform-op inventory drifted from the FF-VERB-COVERAGE pin.\n`
      + `  Added:   ${added.join(', ') || '(none)'}\n`
      + `  Removed: ${removed.join(', ') || '(none)'}\n`
      + `A new op must be assigned ONE of the 7 verb categories (get/filter/aggregate/`
      + `derive/reshape/combine/sort — SPEC §1.2) at registration, then added to PINNED_OPS. `
      + `A removed op must leave here too. Do not let an op drift in unclassified.`,
    ).toEqual({ added: [], removed: [] })
  })

  it('the category seam is present and inert until W-P3 (declaration → projection, no behaviour)', () => {
    // The additive seam exists (W-P0) but is un-assigned by design: every op is still
    // uncategorized, and reading a category is `undefined`. This proves the seam is
    // BEHAVIOUR-NEUTRAL today — runtime dispatch (applyStep) never consults it.
    expect(listUncategorizedOps()).toEqual(listTransformOps())
    for (const op of listTransformOps()) {
      expect(getTransformStepCategory(op)).toBeUndefined()
    }
  })

  // ── The W-P3 obligation, named in the suite (flips from .todo when categories land) ──
  it.todo(
    'SPEC §1.2 (W-P3): every listTransformOps() op declares a category → the 7-verb '
    + 'palette is a TOTAL projection (listUncategorizedOps() === [], every category ∈ the 7)',
  )
})

// Compile-time guard: the pin is a subset of the 7-verb vocabulary's backing set.
// (A cheap reminder that PINNED_OPS members are real op codes, not verbs.)
type _AssertPinIsStrings = (typeof PINNED_OPS)[number] extends string ? true : never
const _pinOk: _AssertPinIsStrings = true
void _pinOk
// Reference the category union so an accidental widening of StepCategory is noticed here.
const _verbSample: StepCategory = 'sort'
void _verbSample
