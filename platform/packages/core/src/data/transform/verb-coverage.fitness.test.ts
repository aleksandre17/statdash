// ── FF-VERB-COVERAGE — ADR-046 · SPEC §1.2 / §8 · wave W-P3 (biting) ───────────
//
//  ADR-046 retires the author-facing tag-zoo into SEVEN intent-verbs
//  (Get/Filter/Aggregate/Derive/Reshape/Combine/Sort). The verbs are NOT a new
//  grammar — each is a PROJECTION of a `category` DECLARED on an existing registry
//  op (SPEC §1.2, Refusal #7: no new engine verb is invented). The invariant this
//  gate NOW enforces (W-P3, categories assigned): **every op in `listTransformOps()`
//  declares exactly one of the 7 categories, so the 7-verb palette is a TOTAL
//  projection — no orphan op, no author-facing verb without a backing op** (SPEC §8).
//
//  W-P0 registered the additive `category` seam INERT (every op uncategorized). W-P3
//  ASSIGNS each op its SPEC §1.2 verb at its registration site — so this gate flips
//  from "pin the inventory / prove the seam is inert" to the total-coverage +
//  taxonomy-pin assertions below. The `CATEGORY_PIN` map is the taxonomy SSOT in test
//  form: a new/removed/re-categorized op fails LOUDLY with a pointer to SPEC §1.2,
//  forcing the category decision to be made deliberately rather than drifting.

import { describe, it, expect } from 'vitest'
// Side-effect import: registers all built-in transform ops into the registry.
import './index'
import {
  listTransformOps,
  listUncategorizedOps,
  getTransformStepCategory,
  getOpsInCategory,
  listOpsByCategory,
  STEP_CATEGORIES,
  type StepCategory,
} from './step-registry'

// ── The pinned op→category map (SPEC §1.2's table — the taxonomy SSOT in test form) ──
//
//  Editing this map is the deliberate act of adding/removing/re-categorizing a
//  transform op. Every registered op MUST appear here with its SPEC §1.2 verb. Keep it
//  in sync with the registration sites (transform/index.ts) — the two are cross-checked.
const CATEGORY_PIN: Record<string, StepCategory> = {
  addField:   'derive',
  aggregate:  'aggregate',
  blend:      'combine',
  cast:       'derive',
  concat:     'derive',
  derive:     'derive',
  filter:     'filter',
  group:      'aggregate',
  join:       'combine',
  joinByField:'combine',
  lookup:     'combine',
  melt:       'reshape',
  reduce:     'aggregate',
  rename:     'reshape',
  rollup:     'aggregate',
  select:     'reshape',
  sort:       'sort',
  source:     'get',        // ADR-046 W-P4: the store-aware pipeline HEAD (SPEC §1.1)
  template:   'derive',
  window:     'derive',
}
const PINNED_OPS = Object.keys(CATEGORY_PIN).sort()
const VERBS = new Set<StepCategory>(STEP_CATEGORIES)

describe('FF-VERB-COVERAGE — the op registry projects cleanly into the 7 verbs (ADR-046 §1.2)', () => {
  it('the registry enumerates cleanly (non-empty, sorted, no duplicates)', () => {
    const ops = listTransformOps()
    expect(ops.length).toBeGreaterThan(0)
    expect(ops).toEqual([...ops].sort())              // listTransformOps() is sorted
    expect(new Set(ops).size).toBe(ops.length)        // no duplicate registration key
  })

  it('the op inventory matches the pinned set (a NEW op must declare its SPEC §1.2 category)', () => {
    const ops = listTransformOps()
    const added   = ops.filter((o) => !PINNED_OPS.includes(o))
    const removed = PINNED_OPS.filter((o) => !ops.includes(o))
    expect(
      { added, removed },
      `transform-op inventory drifted from the FF-VERB-COVERAGE pin.\n`
      + `  Added:   ${added.join(', ') || '(none)'}\n`
      + `  Removed: ${removed.join(', ') || '(none)'}\n`
      + `A new op must be assigned ONE of the 7 verb categories (get/filter/aggregate/`
      + `derive/reshape/combine/sort — SPEC §1.2) at registration, then added to CATEGORY_PIN. `
      + `A removed op must leave here too. Do not let an op drift in unclassified.`,
    ).toEqual({ added: [], removed: [] })
  })

  // ── The W-P3 obligation, now BITING: every op categorized, projection is total ──────
  it('SPEC §1.2: every op declares exactly one of the 7 verbs (no orphan — TOTAL projection)', () => {
    // No op is uncategorized — the palette leaves nothing behind.
    expect(listUncategorizedOps()).toEqual([])
    // Every declared category is one of the 7 canonical verbs (no rogue verb).
    for (const op of listTransformOps()) {
      const cat = getTransformStepCategory(op)
      expect(cat, `op '${op}' declares no category (SPEC §1.2)`).toBeDefined()
      expect(VERBS.has(cat as StepCategory), `op '${op}' declares a non-canonical verb '${cat}'`).toBe(true)
    }
  })

  it('SPEC §1.2: each op maps to its pinned taxonomy verb (the category decision is deliberate)', () => {
    const actual = Object.fromEntries(listTransformOps().map((op) => [op, getTransformStepCategory(op)]))
    expect(actual).toEqual(CATEGORY_PIN)
  })

  it('the category projection round-trips: ⋃ getOpsInCategory(verb) === listTransformOps()', () => {
    // The palette is a PROJECTION: the union of every verb's ops re-covers the whole
    // registry exactly (no op lost, no op double-counted, no ghost op invented).
    const fromProjection = STEP_CATEGORIES.flatMap((c) => getOpsInCategory(c)).sort()
    expect(fromProjection).toEqual(listTransformOps())

    const grouped = listOpsByCategory()
    // Every verb key is present (incl. `get`).
    expect(Object.keys(grouped).sort()).toEqual([...STEP_CATEGORIES].sort())
    // `get` is backed by the `source` head op (ADR-046 W-P4) — the palette's Get card is
    // now insertable by projection (getOpsInCategory('get') === ['source']), zero panel change.
    expect(grouped.get).toEqual(['source'])
    // The flattened grouping equals the flattened per-verb projection (one SSOT).
    expect(STEP_CATEGORIES.flatMap((c) => grouped[c]).sort()).toEqual(listTransformOps())
  })
})

// Reference the category union so an accidental widening of StepCategory is noticed here.
const _verbSample: StepCategory = 'sort'
void _verbSample
