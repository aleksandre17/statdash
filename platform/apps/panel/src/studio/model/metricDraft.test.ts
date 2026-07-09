// ── metricDraft — pure authoring-helper tests (M2.2) ───────────────────────────
import { describe, it, expect } from 'vitest'
import { FORMATTERS } from '@statdash/engine'
import type { CubeProfileMeasure } from '../../lib/cubeApi'
import {
  formatKeyOptions, isValidMetricId, slugifyMetricId,
  unitToLocaleString, unitNeedsAttention, draftFromMeasure,
} from './metricDraft'

const LOCALES = ['ka', 'en'] as const

describe('metricDraft — format options are registry-driven (Law 8)', () => {
  it('lists every live formatter except the fallback', () => {
    const opts = formatKeyOptions()
    for (const key of Object.keys(FORMATTERS)) {
      if (key === 'default') expect(opts).not.toContain('default')
      else expect(opts).toContain(key)
    }
  })
})

describe('metricDraft — id rules (immutable slug)', () => {
  it('accepts a legal slug and rejects illegal ones', () => {
    expect(isValidMetricId('gdp_level')).toBe(true)
    expect(isValidMetricId('gdp.level')).toBe(false)   // dot not allowed
    expect(isValidMetricId('1gdp')).toBe(false)        // leading digit
    expect(isValidMetricId('GDP')).toBe(false)         // uppercase
    expect(isValidMetricId('')).toBe(false)
  })
  it('slugifies free text into the legal shape', () => {
    expect(slugifyMetricId('GDP Level (real)')).toBe('gdp_level_real')
    expect(slugifyMetricId('  123 abc ')).toBe('abc')
  })
})

describe('metricDraft — unit pre-fill from the resolved unit', () => {
  const measure = (u: CubeProfileMeasure['unit']): CubeProfileMeasure => ({ code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' }, unit: u })

  it('fills every active locale from a resolved bilingual label', () => {
    const u = unitToLocaleString({ unit_code: 'GEL', symbol: '₾', label: { ka: 'მლნ ₾', en: 'mln GEL' }, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'measure' }, LOCALES)
    expect(u).toEqual({ ka: 'მლნ ₾', en: 'mln GEL' })
  })

  it('returns an empty map + flags attention when the unit is unresolved (source:none)', () => {
    const none = { unit_code: null, symbol: null, label: null, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'none' as const }
    expect(unitToLocaleString(none, LOCALES)).toEqual({})
    expect(unitNeedsAttention(none)).toBe(true)
  })

  it('draftFromMeasure derives code/dataSource/unit + seeds the label (pick, never type)', () => {
    const m = measure({ unit_code: 'GEL', symbol: '₾', label: { ka: 'მლნ ₾', en: 'mln GEL' }, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'measure' })
    const draft = draftFromMeasure('NAT_ACCOUNTS', m, LOCALES)
    expect(draft.code).toBe('B1GQ')
    expect(draft.dataSource).toBe('NAT_ACCOUNTS')
    expect(draft.label).toEqual({ ka: 'მშპ', en: 'GDP' })
    expect(draft.unit).toEqual({ ka: 'მლნ ₾', en: 'mln GEL' })
    expect(draft.id).toBe('')   // steward chooses the immutable id
  })
})
