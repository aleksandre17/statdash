// ── memberLabels tests (W-P3 · ADR-046 · SPEC §3.2 / §3.4) ───────────────────────
//
//  The grid CELLS speak governed language in the author plane: a member code resolves
//  to its governed label off the cube profile's codelists; the SDMX `_T` total renders
//  as its standard governed meaning; an un-catalogued value falls back HONESTLY to its
//  raw code (never a fabricated label); numbers / no-data pass through untouched.
//
import { describe, it, expect } from 'vitest'
import type { CubeProfile } from '../../../lib/cubeApi'
import { buildMemberLabels, rawMemberLabels, SDMX_TOTAL } from './memberLabels'

const profile = {
  datasetCode: 'X',
  measures: [],
  actualRegion: { available: false, combinations: null },
  dimensions: [
    {
      code: 'geo', conceptRole: 'geo', isTime: false,
      members: [
        { code: 'adjara', label: { en: 'Adjara', ka: 'აჭარა' }, parentCode: null },
        { code: 'tbilisi', label: { en: 'Tbilisi', ka: 'თბილისი' }, parentCode: null },
      ],
    },
    {
      code: 'sector', conceptRole: null, isTime: false,
      members: [{ code: 'AGRI', label: { en: 'Agriculture', ka: 'სოფლის მეურნეობა' }, parentCode: null }],
    },
  ],
} as unknown as CubeProfile

describe('buildMemberLabels — governed member cell labels (author plane)', () => {
  const resolve = buildMemberLabels(profile, 'ka')

  it('resolves a member code to its governed label (adjara → აჭარა, AGRI → its label)', () => {
    expect(resolve('geo', 'adjara')).toBe('აჭარა')
    expect(resolve('sector', 'AGRI')).toBe('სოფლის მეურნეობა')
  })

  it('honors locale (en) for the same codes', () => {
    const en = buildMemberLabels(profile, 'en')
    expect(en('geo', 'adjara')).toBe('Adjara')
  })

  it('renders the SDMX `_T` total as its governed meaning, even absent from the codelist', () => {
    expect(resolve('geo', SDMX_TOTAL)).toBe('სულ')
    expect(buildMemberLabels(profile, 'en')('geo', '_T')).toBe('Total')
  })

  it('falls back to the RAW code when the catalog has no label (honest, never invented)', () => {
    expect(resolve('geo', 'unknown_region')).toBe('unknown_region')
    expect(resolve('not_a_dim', 'whatever')).toBe('whatever')
  })

  it('passes numbers and no-data through untouched (the value column, empty cells)', () => {
    expect(resolve('value', 1234)).toBe(1234)
    expect(resolve('value', 0)).toBe(0)
    expect(resolve('geo', null)).toBeNull()
    expect(resolve('geo', undefined)).toBeUndefined()
    expect(resolve('geo', '')).toBe('')
  })
})

describe('rawMemberLabels — the steward-plane / not-ready passthrough', () => {
  it('returns every value verbatim (raw SDMX codes for the steward)', () => {
    expect(rawMemberLabels('geo', 'adjara')).toBe('adjara')
    expect(rawMemberLabels('value', 42)).toBe(42)
    expect(rawMemberLabels('geo', SDMX_TOTAL)).toBe('_T')
  })
})
