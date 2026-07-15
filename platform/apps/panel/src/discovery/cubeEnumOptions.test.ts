// ── cubeEnumOptions — enum-ref options resolve from the cube profile ─────────
//
//  Pins the C3 declarative-authoring core: a data-bound field offers REAL
//  measures/dims/members from the profile (the author picks, never types a raw
//  code — Law 2). Pure resolvers, locale-aware.
//
import { describe, it, expect } from 'vitest'
import {
  measureOptions, dimensionOptions, memberOptions, isCubeSource, readCubeLabel,
} from './cubeEnumOptions'
import type { CubeProfile } from '../lib/cubeApi'

const profile: CubeProfile = {
  datasetCode: 'DS',
  dimensions: [
    {
      code: 'REGION', conceptRole: 'geo', isTime: false,
      members: [
        { code: 'GE', label: { en: 'Georgia', ka: 'საქართველო' }, parentCode: null },
        { code: 'TB', label: { en: 'Tbilisi',  ka: 'თბილისი'   }, parentCode: 'GE' },
      ],
    },
    { code: 'TIME', conceptRole: 'time', isTime: true, members: [] },
  ],
  measures: [
    { code: 'GDP', label: { en: 'GDP', ka: 'მშპ' }, unit: {
      unit_code: null, symbol: null, label: null, unit_type: null,
      unit_mult: null, decimals: null, base_period: null, source: 'none' } },
  ],
  actualRegion: { available: false, combinations: null },
}

describe('cubeEnumOptions', () => {
  it('measureOptions resolves measure codes with localized labels', () => {
    expect(measureOptions(profile, 'ka')).toEqual([{ value: 'GDP', label: 'მშპ' }])
    expect(measureOptions(profile, 'en')).toEqual([{ value: 'GDP', label: 'GDP' }])
  })

  it('dimensionOptions drops the raw conceptRole echo — bare code with no resolver', () => {
    const opts = dimensionOptions(profile)
    // No "(geo)" / "(time)" plumbing echo surfaced to the author (AR-52).
    expect(opts).toContainEqual({ value: 'REGION', label: 'REGION' })
    expect(opts).toContainEqual({ value: 'TIME', label: 'TIME' })
  })

  it('dimensionOptions resolves the GOVERNED bilingual label when a resolver governs the code', () => {
    const resolve = (code: string) =>
      ({ REGION: 'რეგიონი', TIME: 'დრო' } as Record<string, string>)[code]
    const opts = dimensionOptions(profile, resolve)
    expect(opts).toContainEqual({ value: 'REGION', label: 'რეგიონი' })
    expect(opts).toContainEqual({ value: 'TIME', label: 'დრო' })
  })

  it('dimensionOptions falls back to the bare code when the resolver does not govern it', () => {
    const resolve = (code: string) => (code === 'REGION' ? 'რეგიონი' : undefined)
    const opts = dimensionOptions(profile, resolve)
    expect(opts).toContainEqual({ value: 'REGION', label: 'რეგიონი' })
    expect(opts).toContainEqual({ value: 'TIME', label: 'TIME' }) // never blank
  })

  it('memberOptions resolves members of the chosen dimension, locale-aware', () => {
    expect(memberOptions(profile, 'REGION', 'ka')).toEqual([
      { value: 'GE', label: 'საქართველო' },
      { value: 'TB', label: 'თბილისი' },
    ])
  })

  it('memberOptions returns [] for an unknown dimension (fail-soft)', () => {
    expect(memberOptions(profile, 'NOPE', 'en')).toEqual([])
  })

  it('readCubeLabel falls back code-ward, never blank', () => {
    expect(readCubeLabel(undefined, 'en', 'FALLBACK')).toBe('FALLBACK')
    expect(readCubeLabel({ ka: 'x' }, 'en', 'F')).toBe('x') // en missing → first available
  })

  it('isCubeSource recognises only the three cube discriminants', () => {
    expect(isCubeSource('cube.measures')).toBe(true)
    expect(isCubeSource('cube.dimensions')).toBe(true)
    expect(isCubeSource('cube.members')).toBe(true)
    expect(isCubeSource('dataSpecs')).toBe(false)
    expect(isCubeSource(undefined)).toBe(false)
  })
})
