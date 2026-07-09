// ── FF-CATALOG-EDIT-SAFE — authored metric validates against the live profile ──
//
//  Spec §6.2: an authored ManifestMetric cannot be persisted unless it is provably
//  resolvable — a real measure, real default-dim keys/members — plus the structural
//  governance rules (legal immutable id, unique-on-create, required label).
//
import { describe, it, expect } from 'vitest'
import type { ManifestMetric } from '@statdash/contracts'
import type { CubeProfile } from '../../lib/cubeApi'
import { validateMetric, isSaveable } from './metricValidation'

const profile: CubeProfile = {
  datasetCode: 'NAT',
  measures: [
    { code: 'B1GQ', label: { en: 'GDP' }, unit: { unit_code: 'GEL', symbol: '₾', label: null, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'measure' } },
  ],
  dimensions: [
    { code: 'ADJUSTMENT', conceptRole: null, isTime: false, members: [{ code: 'S', label: { en: 'SA' }, parentCode: null }, { code: 'N', label: { en: 'NSA' }, parentCode: null }] },
  ],
  actualRegion: { available: false, combinations: null },
}

const base: ManifestMetric = { id: 'gdp_level', code: 'B1GQ', label: { en: 'GDP', ka: 'მშპ' } }
const ctx = { profile, existingIds: ['pop_total'], isNew: true, activeLocales: ['ka', 'en'] as const }

describe('FF-CATALOG-EDIT-SAFE — a valid metric is saveable', () => {
  it('passes with a real measure + real dim pin', () => {
    const m = { ...base, dims: { ADJUSTMENT: 'S' } }
    const issues = validateMetric(m, ctx)
    expect(issues).toEqual([])
    expect(isSaveable(issues)).toBe(true)
  })
})

describe('FF-CATALOG-EDIT-SAFE — an unresolvable metric cannot be saved', () => {
  it('rejects a measure absent from the cube profile', () => {
    const issues = validateMetric({ ...base, code: 'NOPE' }, ctx)
    expect(issues.some((i) => i.field === 'code' && i.severity === 'error')).toBe(true)
    expect(isSaveable(issues)).toBe(false)
  })
  it('rejects a default-dims key that is not a real dimension', () => {
    const issues = validateMetric({ ...base, dims: { GHOST: 'S' } }, ctx)
    expect(issues.some((i) => i.field === 'dims' && i.severity === 'error')).toBe(true)
  })
  it('rejects a default member that is not a real member of the dimension', () => {
    const issues = validateMetric({ ...base, dims: { ADJUSTMENT: 'ZZZ' } }, ctx)
    expect(issues.some((i) => i.field === 'dims' && i.severity === 'error')).toBe(true)
  })
})

describe('FF-CATALOG-EDIT-SAFE — structural governance', () => {
  it('rejects an illegal id', () => {
    expect(validateMetric({ ...base, id: 'GDP.Level' }, ctx).some((i) => i.field === 'id')).toBe(true)
  })
  it('rejects a duplicate id on create', () => {
    const issues = validateMetric({ ...base, id: 'pop_total' }, ctx)
    expect(issues.some((i) => i.field === 'id' && i.severity === 'error')).toBe(true)
  })
  it('allows the same id on edit (isNew:false — uniqueness not re-checked)', () => {
    const issues = validateMetric({ ...base, id: 'gdp_level' }, { ...ctx, isNew: false, existingIds: ['gdp_level'] })
    expect(issues.some((i) => i.field === 'id')).toBe(false)
  })
  it('rejects a missing label', () => {
    const issues = validateMetric({ ...base, label: {} }, ctx)
    expect(issues.some((i) => i.field === 'label' && i.severity === 'error')).toBe(true)
  })
})

describe('FF-CATALOG-EDIT-SAFE — graceful degradation when the profile is unavailable', () => {
  it('warns (not errors) so a steward who picked live is not hard-blocked', () => {
    const issues = validateMetric(base, { ...ctx, profile: null })
    expect(issues.some((i) => i.field === 'code' && i.severity === 'warning')).toBe(true)
    expect(isSaveable(issues)).toBe(true)  // warning does not block
  })
})
