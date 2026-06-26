// ── Fitness — data-contract compatibility classifier (pure, no DB) ────────────
//
// ADR-0031 §4 improvement 5 fitness nets. classifyContractChange is PURE, so these run
// with no database. Asserts the GATE (codelist OPEN, DSD GOVERNED):
//   · drop-a-dim → DSD_INCOMPATIBLE error (publish blocked).
//   · drop-a-dim WITH a declared dataset_version → governed (warn, not blocked).
//   · add-a-CL-member → CODELIST_EXTENDED warn (publishes).
//   · drop-a-CL-member → CODELIST_DEPRECATED warn (retire-not-delete signalled).
//   · no change → routine (no issue).

import { describe, expect, it } from 'vitest'
import { classifyContractChange, type DsdSnapshot } from './compat.js'

const gold: DsdSnapshot = {
  datasetCode: 'GDP_ANNUAL',
  dimensions: ['time', 'approach', 'measure', 'geo'],
  measureConcept: 'OBS_VALUE',
  members: {
    approach: ['B1GQ_E', 'B1GQ_I', 'B1GQ_P'],
    geo: ['AB', 'GE'],
  },
}

describe('classifyContractChange — DSD gate (GOVERNED)', () => {
  it('drop a dim → DSD_INCOMPATIBLE error (publish blocked)', () => {
    const declared: DsdSnapshot = { ...gold, dimensions: ['time', 'approach', 'geo'] }
    const change = classifyContractChange(declared, gold)
    expect(change.kind).toBe('dsd-change')
    expect(change.issues).toHaveLength(1)
    expect(change.issues[0].code).toBe('DSD_INCOMPATIBLE')
    expect(change.issues[0].severity).toBe('error')
    expect(change.dsdDelta?.versioned).toBe(false)
  })

  it('reorder dims (same set) → routine, NOT a DSD break (dimKey is a map — order-irrelevant)', () => {
    const declared: DsdSnapshot = { ...gold, dimensions: ['time', 'measure', 'approach', 'geo'] }
    expect(classifyContractChange(declared, gold).kind).toBe('routine')
  })

  it('measure concept change → DSD_INCOMPATIBLE error', () => {
    const declared: DsdSnapshot = { ...gold, measureConcept: 'OBS_FLOW' }
    const change = classifyContractChange(declared, gold)
    expect(change.issues[0].code).toBe('DSD_INCOMPATIBLE')
    expect(change.issues[0].severity).toBe('error')
  })

  it('a DSD change WITH a declared dataset_version → governed (warn, not blocked)', () => {
    const declared: DsdSnapshot = { ...gold, dimensions: ['time', 'approach', 'geo'], datasetVersion: '2.0' }
    const change = classifyContractChange(declared, gold)
    expect(change.kind).toBe('dsd-change')
    expect(change.issues[0].code).toBe('DSD_INCOMPATIBLE')
    expect(change.issues[0].severity).toBe('warn') // versioned ⇒ allowed
    expect(change.dsdDelta?.versioned).toBe(true)
  })
})

describe('classifyContractChange — codelist gate (OPEN, BACKWARD-auto)', () => {
  it('add a CL member → CODELIST_EXTENDED warn (publishes)', () => {
    const declared: DsdSnapshot = {
      ...gold,
      members: { ...gold.members, geo: ['AB', 'GE', 'IM'] }, // new region IM
    }
    const change = classifyContractChange(declared, gold)
    expect(change.kind).toBe('codelist-extend')
    expect(change.issues).toHaveLength(1)
    expect(change.issues[0].code).toBe('CODELIST_EXTENDED')
    expect(change.issues[0].severity).toBe('warn')
    expect(change.codelistDeltas).toEqual([{ dim: 'geo', added: ['IM'], removed: [] }])
  })

  it('drop a CL member → CODELIST_DEPRECATED warn (retire-not-delete)', () => {
    const declared: DsdSnapshot = {
      ...gold,
      members: { ...gold.members, geo: ['GE'] }, // AB dropped
    }
    const change = classifyContractChange(declared, gold)
    expect(change.kind).toBe('codelist-deprecate')
    expect(change.issues[0].code).toBe('CODELIST_DEPRECATED')
    expect(change.issues[0].severity).toBe('warn')
    expect(change.codelistDeltas).toEqual([{ dim: 'geo', added: [], removed: ['AB'] }])
    // deprecate-not-delete signalled in the detail policy line.
    expect(String(change.issues[0].detail.policy)).toMatch(/RETIRED via SCD-2/)
  })

  it('un-asserted dim (declared omits members) is NOT a deprecation (Postel)', () => {
    const declared: DsdSnapshot = { ...gold, members: { approach: gold.members.approach } } // geo omitted
    expect(classifyContractChange(declared, gold).kind).toBe('routine')
  })
})

describe('classifyContractChange — routine', () => {
  it('identical DSD + members → routine, no issue', () => {
    const change = classifyContractChange({ ...gold }, gold)
    expect(change.kind).toBe('routine')
    expect(change.issues).toEqual([])
  })
})
