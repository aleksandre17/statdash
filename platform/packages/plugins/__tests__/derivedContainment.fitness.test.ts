// @vitest-environment node
//
// ── derivedContainment.fitness.test.ts — ADR-041 · FF-DERIVED-CONTAINMENT (semantic) ──
//
//  THE FENCE (Phase 1.5), plugins-side tooth. The engine tooth (packages/react) proves
//  the ENGINE never READS a kind/flag to answer a containment question. This proves the
//  reciprocal over the REAL registered corpus: no STORED kind (`canHaveChildren`)
//  CONTRADICTS the declared part fields — the invariant Phase 6 hardens to the sole
//  containment answer (WRAPPER ⇔ declares ≥1 part field). It lives plugins-side because
//  it scans the authoring METAs (the arrow forbids react/core from importing plugins).
//
//  The reconciliation it makes explicit (the owner's kpi-strip confusion, resolved):
//  `canHaveChildren` governs the SLOT residence ONLY. kpi-strip is a leaf-KIND
//  (`canHaveChildren:false` → zero SLOT parts, consistent) that is a wrapper-BY-CONTRACT
//  (it declares a VALUE part). Kind and contract are RECONCILED, not contradictory — the
//  flag speaks to tree-children, the value part is a different residence.
//
import { describe, it, expect } from 'vitest'
import { partFieldsOf }         from '@statdash/react/engine'
import type { ObjectMeta }      from '@statdash/react/engine'
import { AUTHORING_METAS }      from '../authoring-metas'

const METAS = AUTHORING_METAS as unknown as ObjectMeta[]
const idOf  = (m: ObjectMeta & { type?: string; slot?: string; controlType?: string }): string =>
  m.type ?? m.slot ?? m.controlType ?? '<anon>'

const hasSlotPart = (m: ObjectMeta): boolean =>
  partFieldsOf(m).some((p) => p.residence === 'slot')

describe('FF-DERIVED-CONTAINMENT — no stored kind CONTRADICTS the declared part fields [§0.5a semantic]', () => {
  it('for EVERY registered META: `canHaveChildren === true` ⟺ it declares a SLOT part', () => {
    // The non-contradiction invariant, over the whole shipped corpus. A META that says
    // "container" (canHaveChildren:true) MUST declare a slot part; a META that says
    // "leaf" (false/absent) must declare NONE. Phase 6 makes this predicate THE
    // containment answer; here it must already hold with zero contradictions.
    const contradictions = METAS
      .map((m) => ({ id: idOf(m), kindSaysContainer: m.canHaveChildren === true, declaresSlot: hasSlotPart(m) }))
      .filter((r) => r.kindSaysContainer !== r.declaresSlot)
    expect(contradictions).toEqual([])
  })

  it('kpi-strip is RECONCILED: leaf-KIND (no slot part) yet wrapper-BY-CONTRACT (a value part)', () => {
    const kpi = METAS.find((m) => idOf(m) === 'kpi-strip')
    expect(kpi).toBeTruthy()
    expect(kpi!.canHaveChildren === true).toBe(false)                       // kind: leaf (no tree children)…
    const parts = partFieldsOf(kpi!)
    expect(parts.some((p) => p.residence === 'slot')).toBe(false)           // …consistent: zero SLOT parts…
    expect(parts.some((p) => p.residence === 'value')).toBe(true)           // …yet a VALUE part → wrapper by contract.
  })

  it('the corpus exercises all three residences (the guard sees real slot/value/sourced parts)', () => {
    const residences = new Set(METAS.flatMap((m) => partFieldsOf(m).map((p) => p.residence)))
    expect([...residences].sort()).toEqual(['slot', 'sourced', 'value'])
  })

  it('BITES: a planted CONTRADICTORY META (container-kind, no slot part) IS caught', () => {
    // A meta that CLAIMS to contain (canHaveChildren:true) but declares no slot part —
    // the exact stored contradiction the fence forbids. Run through the SAME predicate.
    const planted: ObjectMeta = { canHaveChildren: true, schema: [{ field: 'title', type: 'string', label: 't' }] }
    const kindSaysContainer = planted.canHaveChildren === true
    expect(kindSaysContainer).toBe(true)
    expect(hasSlotPart(planted)).toBe(false)
    expect(kindSaysContainer !== hasSlotPart(planted)).toBe(true)           // detected as a contradiction
  })
})
