// ── FF-PROMOTE-ROUNDTRIP — a promoted head resolves identically to the raw one ──
//
//  ADR-046 · SPEC §9 E2 / §8 — the Looker/dbt/Superset promotion loop. Raw work in the
//  workbench (a STEWARD `source(query)` head) can be PROMOTED into the governed semantic
//  layer: the author proposes a governed metric from the shaped read, the steward blesses
//  it, and the head is REPLACED by the governed ref (`{op:'source', metrics:[id]}`). This is
//  the loop that FEEDS the semantic layer — raw work is strong, but its destiny is a
//  reusable governed fact (Floor 2), while element-local shaping stays a pipeline tail step
//  (Floor 3). See apps/panel `workbench/promoteHeadToMetric` for the authoring seam.
//
//  THE INVARIANT (SPEC §8): a PROMOTED head's governed replacement resolves BYTE-IDENTICALLY
//  to the raw head it replaced — promotion is a REFACTOR, never a semantic change (mirrors
//  the FF-PIPELINE-EQUIV discipline one layer up). This holds BY CONSTRUCTION: a governed
//  BASE metric whose `code` equals the raw head's `query.measure` browses through
//  `browseBaseMetric`, which delegates to the SAME storeObs read the steward `query` head
//  uses (ADR-046 Addendum 2 — "the empty pipeline is the browse grid"). This test PROVES it
//  end-to-end on a real store, so the gate BITES if that construction ever drifts.
//
//  W-P0 registered this as an `it.todo`; 0084 lands the promotion surface + flips it here.
//  TEST-ONLY change (no engine src) — the roundtrip is an emergent property of the existing
//  browse lowering, asserted, not a new engine capability.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { interpretSpec }        from './spec'
import { registerMetric }       from './metric'
import { ExternalStore }        from './store-impl'
import '../registry/resolvers'  // side-effect: register the built-in resolvers
import type { DataSpec }        from '../config/data-spec'
import type { Observation }     from '../sdmx'
import type { SectionContext }  from '../core/context'

// A raw regional cube slice — the observations a steward would browse over the raw head.
const obs: Observation[] = [
  { measure: 'GVA', time: 2018, geo: 'adjara', value: 40, label: 'adjara', color: '#111' },
  { measure: 'GVA', time: 2019, geo: 'adjara', value: 44, label: 'adjara', color: '#111' },
  { measure: 'GVA', time: 2020, geo: 'adjara', value: 48, label: 'adjara', color: '#111' },
  { measure: 'GVA', time: 2020, geo: 'imereti', value: 60, label: 'imereti', color: '#222' },
  { measure: 'POP', time: 2020, geo: 'adjara', value: 5,  label: 'adjara', color: '#333' },
]
const store = new ExternalStore(obs)
const ctxRange: SectionContext = { dims: {} }   // grain-∅ browse — the raw read is the table

// The steward blesses this governed metric FROM the raw read: its `code` IS the raw head's
// measure (`GVA`) — the exact draftFromMeasure output the promotion form produces (pick,
// never type — Law 2). Registered here to stand in for saveSemanticCatalog's live register.
registerMetric('promoted:regional-gva', {
  label: { en: 'Regional GVA', ka: 'რეგიონული მშპ' },
  code:  'GVA',
})

describe('FF-PROMOTE-ROUNDTRIP — a promoted head resolves identically to its raw head (ADR-046 E2)', () => {
  // The RAW head the steward browsed (a `source(query)` variant — ADR-046 variant 2).
  const rawHead: DataSpec = {
    type: 'pipeline',
    pipe: [{ op: 'source', query: { measure: 'GVA' } }],
    encoding: { label: 'id' },
  }
  // The head AFTER promotion (`source(metrics)` — the governed ref that replaced it).
  const governedHead: DataSpec = {
    type: 'pipeline',
    pipe: [{ op: 'source', metrics: ['promoted:regional-gva'] }],
    encoding: { label: 'id' },
  }

  it('a raw steward head promotes to a governed metric ref (author proposes, steward blesses)', () => {
    // The promotion is a HEAD SWAP: the governed metric's code === the raw measure.
    const rawRows = interpretSpec(rawHead, ctxRange, store)
    expect(rawRows.length).toBe(4)                     // all GVA obs (the rich browse, not a scalar)
    expect(rawRows.every((r) => r['measure'] === 'GVA')).toBe(true)
  })

  it('the promoted governed ref resolves BYTE-IDENTICALLY to the replaced raw head (a refactor, not a change)', () => {
    const rawRows      = interpretSpec(rawHead, ctxRange, store)
    const governedRows = interpretSpec(governedHead, ctxRange, store)
    expect(governedRows).toEqual(rawRows)              // the invariant — same rows/order/values/nulls
  })

  it('reusable calc ⇒ Floor-2 metric; element-local shaping ⇒ Floor-3 pipeline step (the ecology boundary held)', () => {
    // The SHAPING (a filter) is a Floor-3 TAIL step — preserved verbatim across promotion.
    // Promoting only the HEAD therefore keeps the whole read byte-identical (Floor-2 ref +
    // the untouched Floor-3 tail), never collapsing the shaping into the governed metric.
    const rawShaped: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', query: { measure: 'GVA' } }, { op: 'filter', where: { geo: 'adjara' } }],
      encoding: { label: 'id' },
    }
    const promotedShaped: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', metrics: ['promoted:regional-gva'] }, { op: 'filter', where: { geo: 'adjara' } }],
      encoding: { label: 'id' },
    }
    const rawRows      = interpretSpec(rawShaped, ctxRange, store)
    const promotedRows = interpretSpec(promotedShaped, ctxRange, store)
    expect(rawRows.length).toBe(3)                     // the adjara rows only (imereti filtered out)
    expect(promotedRows).toEqual(rawRows)              // promotion never disturbs the Floor-3 tail
  })
})
