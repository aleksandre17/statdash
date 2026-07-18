// ── cubeDebt tests (0084 §3 — the member-label debt lens) ──────────────────────
//
//  The R/U gap made visible: a dimension whose members carry no governed label is surfaced
//  honestly. NEVER invents a label; the time axis is exempt (period codes aren't labels).
//
import { describe, it, expect } from 'vitest'
import type { CubeProfile, CubeProfileDimension } from '../../../lib/cubeApi'
import { memberLacksLabel, dimLabelDebt, cubeLabelDebt, dimsWithDebt, debtNote } from './cubeDebt'

const dim = (code: string, isTime: boolean, members: { code: string; label: Record<string, string> }[]): CubeProfileDimension => ({
  code, conceptRole: null, isTime, members: members.map((m) => ({ ...m, parentCode: null })),
})

// A region dim with the ledgered R/U gap: two members (R, U) carry NO governed label.
const regionDim = dim('geo', false, [
  { code: 'R', label: {} },
  { code: 'U', label: { en: '', ka: '' } },
  { code: 'adjara', label: { en: 'Adjara', ka: 'აჭარა' } },
])
const timeDim = dim('time', true, [{ code: '2020', label: {} }, { code: '2021', label: {} }])
const echoDim = dim('sector', false, [{ code: 'GVA', label: { en: 'GVA', ka: 'GVA' } }])   // code echoed as label

const profile: CubeProfile = {
  datasetCode: 'REGIONAL_GVA',
  dimensions: [regionDim, timeDim, echoDim],
  measures: [],
  actualRegion: { available: false, combinations: null },
}

describe('memberLacksLabel — the honest predicate', () => {
  it('is true for an empty label, false for a real governed label', () => {
    expect(memberLacksLabel({ code: 'R', label: {}, parentCode: null })).toBe(true)
    expect(memberLacksLabel({ code: 'U', label: { en: '', ka: ' ' }, parentCode: null })).toBe(true)
    expect(memberLacksLabel({ code: 'adjara', label: { ka: 'აჭარა' }, parentCode: null })).toBe(false)
  })
  it('treats a code echoed as its own label as MISSING (a raw code is not a label)', () => {
    expect(memberLacksLabel({ code: 'GVA', label: { en: 'GVA', ka: 'GVA' }, parentCode: null })).toBe(true)
  })
})

describe('dimLabelDebt / cubeLabelDebt', () => {
  it('counts the missing members per dim; the time axis is exempt', () => {
    expect(dimLabelDebt(regionDim)).toEqual({ dimCode: 'geo', isTime: false, total: 3, missing: 2 })
    expect(dimLabelDebt(timeDim)).toEqual({ dimCode: 'time', isTime: true, total: 2, missing: 0 })
    expect(dimLabelDebt(echoDim)).toEqual({ dimCode: 'sector', isTime: false, total: 1, missing: 1 })
  })
  it('cubeLabelDebt walks every dim in order; dimsWithDebt keeps only the debt-bearing ones', () => {
    expect(cubeLabelDebt(profile).map((d) => d.dimCode)).toEqual(['geo', 'time', 'sector'])
    expect(dimsWithDebt(profile).map((d) => d.dimCode)).toEqual(['geo', 'sector'])
  })
})

describe('debtNote — bilingual honest note', () => {
  it('reads «N წევრს ეტიკეტი აკლია» / N members lack a label', () => {
    expect(debtNote(2, false)).toBe('2 წევრს ეტიკეტი აკლია')
    expect(debtNote(1, true)).toBe('1 member lacks a label')
    expect(debtNote(2, true)).toBe('2 members lack a label')
  })
})
