// ── buildSuggestedSpec fitness — a populated, spine-form pipeline spec (V5 · W0) ──
//
//  Show-Me's one-click insert must produce the SAME `pipeline` spine the
//  workbench panes emit (a `source(query)` head + tail, lowered through the ONE
//  engine `desugarToPipeline`) — codes drawn from the profile (Law 2). Pins that
//  the suggestion's basis dimension drives the label and the first measure
//  drives the value, and that the emitted dialect is the REST grammar
//  (FF-ONE-DIALECT-AT-REST: the in-session artifact matches what storage holds).
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
  it('builds a spine pipeline: source(query) head, basis dim as label + first measure as value', () => {
    const s: PanelSuggestion = { panelType: 'timeseries', reason: 'time-axis', basis: 'TIME' }
    const p = profile({ dimensions: [dim('TIME')], measures: [measure('GDP'), measure('GVA')] })
    expect(buildSuggestedSpec(s, p)).toEqual({
      type: 'pipeline',
      pipe: [{ op: 'source', query: { measure: ['GDP'] } }],
      encoding: { label: 'TIME', value: 'GDP' },
    })
  })

  it('falls back to the first dimension when basis is not a dimension', () => {
    const s: PanelSuggestion = { panelType: 'kpi-strip', reason: 'measure', basis: 'GDP' }
    const p = profile({ dimensions: [dim('SECTOR')], measures: [measure('GDP')] })
    const spec = buildSuggestedSpec(s, p)
    expect(spec).toMatchObject({ encoding: { label: 'SECTOR', value: 'GDP' } })
  })

  it('produces a bare-string encoding (byte-identical to the workbench emission)', () => {
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

  it('emits the REST grammar: type pipeline with a source head (never a sugar kind)', () => {
    const s: PanelSuggestion = { panelType: 'timeseries', reason: 'time-axis', basis: 'TIME' }
    const spec = buildSuggestedSpec(s, profile({ dimensions: [dim('TIME')], measures: [measure('GDP')] }))
    expect(spec?.type).toBe('pipeline')
    const head = (spec as unknown as { pipe: { op?: string }[] }).pipe[0]
    expect(head.op).toBe('source')
  })
})
