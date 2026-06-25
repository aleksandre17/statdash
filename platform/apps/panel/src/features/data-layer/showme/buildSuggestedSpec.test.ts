// ── buildSuggestedSpec fitness — a populated, byte-identical query spec (V5) ──
//
//  Show-Me's one-click insert must produce the SAME `query` DataSpec shape the
//  typed DataSpecEditor/QuerySpecEditor emit (type:'query', measure:string[],
//  bare-string encoding channels) — codes drawn from the profile (Law 2). Pins
//  that the suggestion's basis dimension drives the label and the first measure
//  drives the value.
//
import { describe, it, expect } from 'vitest'
import { buildSuggestedSpec } from './buildSuggestedSpec'
import type { PanelSuggestion } from '../../../discovery/suggestPanels'
import type { CubeProfile, CubeProfileMeasure, CubeProfileDimension } from '../../../lib/cubeApi'

const measure = (code: string): CubeProfileMeasure => ({
  code, label: { en: code }, unit: {
    unit_code: null, symbol: null, label: null, unit_type: null,
    unit_mult: null, decimals: null, base_period: null, source: 'none',
  },
})
const dim = (code: string): CubeProfileDimension => ({
  code, conceptRole: null, isTime: false, members: [],
})
const profile = (over: Partial<CubeProfile>): CubeProfile => ({
  datasetCode: 'DS', dimensions: [], measures: [],
  actualRegion: { available: false, combinations: null }, ...over,
})

describe('buildSuggestedSpec', () => {
  it('builds a query spec with the basis dim as label + first measure as value', () => {
    const s: PanelSuggestion = { panelType: 'timeseries', reason: 'time-axis', basis: 'TIME' }
    const p = profile({ dimensions: [dim('TIME')], measures: [measure('GDP'), measure('GVA')] })
    expect(buildSuggestedSpec(s, p)).toEqual({
      type: 'query',
      query: { measure: ['GDP'] },
      pipe: [],
      encoding: { label: 'TIME', value: 'GDP' },
    })
  })

  it('falls back to the first dimension when basis is not a dimension', () => {
    const s: PanelSuggestion = { panelType: 'kpi-strip', reason: 'measure', basis: 'GDP' }
    const p = profile({ dimensions: [dim('SECTOR')], measures: [measure('GDP')] })
    const spec = buildSuggestedSpec(s, p)
    expect(spec).toMatchObject({ encoding: { label: 'SECTOR', value: 'GDP' } })
  })

  it('produces a bare-string encoding (byte-identical to the typed editor)', () => {
    const s: PanelSuggestion = { panelType: 'bar', reason: 'measure-by-dim', basis: 'SECTOR' }
    const spec = buildSuggestedSpec(s, profile({ dimensions: [dim('SECTOR')], measures: [measure('GDP')] }))
    const enc = (spec as unknown as { encoding: Record<string, unknown> }).encoding
    expect(typeof enc.label).toBe('string')
    expect(typeof enc.value).toBe('string')
  })

  it('returns null when no measure is bindable (total, never throws)', () => {
    const s: PanelSuggestion = { panelType: 'bar', reason: 'measure-by-dim', basis: 'SECTOR' }
    expect(buildSuggestedSpec(s, profile({ dimensions: [dim('SECTOR')] }))).toBeNull()
  })

  it('is a query DataSpec the typed editor could also produce (round-trippable shape)', () => {
    const s: PanelSuggestion = { panelType: 'timeseries', reason: 'time-axis', basis: 'TIME' }
    const spec = buildSuggestedSpec(s, profile({ dimensions: [dim('TIME')], measures: [measure('GDP')] }))
    expect(spec?.type).toBe('query')
  })
})
