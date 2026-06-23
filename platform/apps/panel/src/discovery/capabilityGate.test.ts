// ── capabilityGate — fitness: the palette offers only supported bindings ─────
//
//  Pins the ADR fitness: "palette offers only profile-supported data bindings
//  (capability-gated)". Pure filter — entries + profile → supported entries.
//  Also pins graceful degradation: an unavailable profile leaves the gate OPEN.
//
import { describe, it, expect } from 'vitest'
import { gatePaletteEntries, isDataBound } from './capabilityGate'
import type { PaletteEntry } from '../canvas/paletteEntries'
import type { ActiveProfile } from './useActiveProfile'
import type { CubeProfile } from '../lib/cubeApi'

const entry = (over: Partial<PaletteEntry> & { type: string }): PaletteEntry => ({
  variant: 'default', label: over.type, caps: [], ...over,
})

const chart   = entry({ type: 'chart',   caps: ['chart', 'filterable', 'export'] })
const kpi     = entry({ type: 'kpi-strip', caps: ['kpi', 'filterable'] })
const map     = entry({ type: 'map',     caps: ['data', 'filterable'] })
const section = entry({ type: 'section', caps: ['collapsible'] })
const hero    = entry({ type: 'hero',    caps: [] })

const allEntries = [chart, kpi, map, section, hero]

const ready = (profile: Partial<CubeProfile>): ActiveProfile => ({
  status: 'ready',
  profile: {
    datasetCode: 'DS', dimensions: [], measures: [],
    actualRegion: { available: false, combinations: null }, ...profile,
  },
})

const measure = { code: 'GDP', label: { en: 'GDP' }, unit: {
  unit_code: null, symbol: null, label: null, unit_type: null,
  unit_mult: null, decimals: null, base_period: null, source: 'none' as const } }

describe('isDataBound', () => {
  it('flags data/chart/kpi/filterable entries', () => {
    expect(isDataBound(chart)).toBe(true)
    expect(isDataBound(kpi)).toBe(true)
    expect(isDataBound(map)).toBe(true)
  })
  it('passes layout/content entries through', () => {
    expect(isDataBound(section)).toBe(false)
    expect(isDataBound(hero)).toBe(false)
  })
})

describe('gatePaletteEntries', () => {
  it('keeps data panels when the profile has a measure', () => {
    const out = gatePaletteEntries(allEntries, ready({ measures: [measure] }))
    expect(out.map((e) => e.type)).toContain('chart')
    expect(out.map((e) => e.type)).toContain('kpi-strip')
  })

  it('hides data panels when the profile has NO measure', () => {
    const out = gatePaletteEntries(allEntries, ready({ measures: [] }))
    expect(out.map((e) => e.type)).not.toContain('chart')
    expect(out.map((e) => e.type)).not.toContain('kpi-strip')
    // …but layout/content are never gated.
    expect(out.map((e) => e.type)).toContain('section')
    expect(out.map((e) => e.type)).toContain('hero')
  })

  it('hides a geo panel when no geo-role dimension exists', () => {
    const out = gatePaletteEntries(allEntries, ready({
      measures: [measure],
      dimensions: [{ code: 'X', conceptRole: null, isTime: false, members: [] }],
    }))
    expect(out.map((e) => e.type)).not.toContain('map')
  })

  it('keeps a geo panel when a geo-role dimension exists', () => {
    const out = gatePaletteEntries(allEntries, ready({
      measures: [measure],
      dimensions: [{ code: 'REGION', conceptRole: 'geo', isTime: false, members: [] }],
    }))
    expect(out.map((e) => e.type)).toContain('map')
  })

  it('leaves the gate OPEN when no profile is available (graceful degradation)', () => {
    for (const active of [
      { status: 'none' } as const,
      { status: 'loading' } as const,
      { status: 'error', message: 'x' } as const,
    ]) {
      expect(gatePaletteEntries(allEntries, active)).toEqual(allEntries)
    }
  })
})
