// ── fieldChips fitness — profile → draggable chips, types ride from the field ─
//
//  Pins: measures become measure chips (quantitative); a time dimension derives
//  temporal; every other dimension derives nominal (the renderer default). The
//  measurement type rides from the profile field (R2) — the author never picks
//  one. Pure + total.
//
import { describe, it, expect } from 'vitest'
import { fieldChips } from './fieldChips'
import type { CubeProfile, CubeProfileMeasure, CubeProfileDimension } from '../../../lib/cubeApi'

const measure = (code: string): CubeProfileMeasure => ({
  code, label: { en: code, ka: `${code}-ka` }, unit: {
    unit_code: null, symbol: null, label: null, unit_type: null,
    unit_mult: null, decimals: null, base_period: null, source: 'none',
  },
})
const dim = (over: Partial<CubeProfileDimension> & { code: string }): CubeProfileDimension => ({
  conceptRole: null, isTime: false, members: [], ...over,
})
const profile = (over: Partial<CubeProfile>): CubeProfile => ({
  datasetCode: 'DS', dimensions: [], measures: [],
  actualRegion: { available: false, combinations: null }, ...over,
})

describe('fieldChips', () => {
  it('emits a quantitative measure chip per measure, locale-resolved label', () => {
    const chips = fieldChips(profile({ measures: [measure('GDP')] }), 'ka')
    expect(chips).toContainEqual({ code: 'GDP', label: 'GDP-ka', kind: 'measure', measurementType: 'quantitative' })
  })

  it('derives temporal for a time dimension', () => {
    const chips = fieldChips(profile({ dimensions: [dim({ code: 'TIME', isTime: true })] }), 'en')
    expect(chips.find((c) => c.code === 'TIME')).toMatchObject({ kind: 'dimension', measurementType: 'temporal' })
  })

  it('derives nominal for a plain dimension (the renderer default)', () => {
    const chips = fieldChips(profile({ dimensions: [dim({ code: 'SECTOR' })] }), 'en')
    expect(chips.find((c) => c.code === 'SECTOR')).toMatchObject({ kind: 'dimension', measurementType: 'nominal' })
  })

  it('lists measures before dimensions', () => {
    const chips = fieldChips(profile({ measures: [measure('GDP')], dimensions: [dim({ code: 'SECTOR' })] }), 'en')
    expect(chips.map((c) => c.kind)).toEqual(['measure', 'dimension'])
  })

  it('is total — an empty profile yields no chips', () => {
    expect(fieldChips(profile({}), 'en')).toEqual([])
  })
})
