// ── suggestPanels — fitness: the "suggest-the-chart" mapping is sound ────────
//
//  Pins the ADR fitness invariant: geo→map, isTime→timeseries, etc. Pure
//  function, no store/network — a model-on-suggestedEncodings unit test.
//
import { describe, it, expect } from 'vitest'
import { suggestPanels } from './suggestPanels'
import type { CubeProfile, CubeProfileDimension, CubeProfileMeasure } from '../lib/cubeApi'

const measure = (code: string): CubeProfileMeasure => ({
  code, label: { en: code }, unit: {
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

describe('suggestPanels', () => {
  it('suggests timeseries when a time axis is present', () => {
    const out = suggestPanels(profile({ dimensions: [dim({ code: 'TIME', isTime: true })], measures: [measure('GDP')] }))
    expect(out.find((s) => s.reason === 'time-axis')?.panelType).toBe('timeseries')
  })

  it('suggests map for a geo concept role (not by dim code)', () => {
    // The dim code is NOT 'geo' — the geo decision is the concept ROLE (Law 1).
    const out = suggestPanels(profile({ dimensions: [dim({ code: 'REGION', conceptRole: 'geo' })], measures: [measure('GDP')] }))
    const map = out.find((s) => s.reason === 'geo-role')
    expect(map?.panelType).toBe('map')
    expect(map?.basis).toBe('REGION')
  })

  it('suggests tree for a hierarchical (parented) dimension', () => {
    const hier = dim({
      code: 'NACE',
      members: [
        { code: 'A', label: { en: 'A' }, parentCode: null },
        { code: 'A1', label: { en: 'A1' }, parentCode: 'A' },
      ],
    })
    const out = suggestPanels(profile({ dimensions: [hier], measures: [measure('GDP')] }))
    expect(out.find((s) => s.reason === 'hierarchy')?.panelType).toBe('tree')
  })

  it('always offers a kpi-strip baseline when there is a measure', () => {
    const out = suggestPanels(profile({ measures: [measure('GDP')] }))
    expect(out.some((s) => s.panelType === 'kpi-strip')).toBe(true)
  })

  it('suggests bar for a measure across a non-time non-geo dimension', () => {
    const out = suggestPanels(profile({ dimensions: [dim({ code: 'SECTOR' })], measures: [measure('GDP')] }))
    expect(out.find((s) => s.reason === 'measure-by-dim')?.panelType).toBe('bar')
  })

  it('returns no suggestions for an empty profile (total, never throws)', () => {
    expect(suggestPanels(profile({}))).toEqual([])
  })

  it('orders most-specific first (timeseries before kpi baseline)', () => {
    const out = suggestPanels(profile({
      dimensions: [dim({ code: 'TIME', isTime: true })],
      measures: [measure('GDP')],
    }))
    const types = out.map((s) => s.panelType)
    expect(types.indexOf('timeseries')).toBeLessThan(types.indexOf('kpi-strip'))
  })

  it('dedupes by panel type', () => {
    const out = suggestPanels(profile({
      dimensions: [dim({ code: 'TIME', isTime: true }), dim({ code: 'SECTOR' })],
      measures: [measure('GDP')],
    }))
    expect(new Set(out.map((s) => s.panelType)).size).toBe(out.length)
  })
})
