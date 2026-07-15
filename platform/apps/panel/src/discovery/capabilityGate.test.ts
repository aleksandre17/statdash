// ── capabilityGate — fitness: the palette offers only supported bindings ─────
//
//  Pins the ADR fitness: "palette offers only profile-supported data bindings
//  (capability-gated)". Pure filter — entries + profile → supported entries.
//  Also pins graceful degradation: an unavailable profile leaves the gate OPEN.
//
import { describe, it, expect } from 'vitest'
import { gatePaletteEntries, isDataBound } from './capabilityGate'
// The gate's OWN source as raw text (Vite `?raw` — browser-graph typed, no node:fs
// which the panel tsconfig omits; TS `?raw` is non-empty, unlike CSS `?raw`).
import gateSource from './capabilityGate.ts?raw'
import type { PaletteEntry } from '../canvas/paletteEntries'
import type { ActiveProfile } from './useActiveProfile'
import type { CubeProfile } from '../lib/cubeApi'

const entry = (over: Partial<PaletteEntry> & { type: string }): PaletteEntry => ({
  variant: 'default', label: over.type, caps: [], ...over,
})

const chart   = entry({ type: 'chart',   caps: ['chart', 'filterable', 'export'] })
const kpi     = entry({ type: 'kpi-strip', caps: ['kpi', 'filterable'] })
// A map DECLARES its data prerequisite (a geo concept role) — the gate reads THIS,
// never the type string (Law 1).
const map     = entry({ type: 'map',     caps: ['data', 'filterable'], requires: { conceptRole: 'geo' } })
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

  // AGNOSTICISM (H5): a second tenant declares a DIFFERENT concept role — the SAME
  // gate honours it with zero code. The requirement is a DECLARED field, not a
  // baked-in 'geo' rule, so any role gates generically.
  it('gates a data panel by its DECLARED concept role, generically (not geo-only)', () => {
    const sectorPanel = entry({
      type: 'sunburst', caps: ['data', 'chart'], requires: { conceptRole: 'sector' },
    })
    const entries = [sectorPanel]
    // No sector-role dimension → gated out.
    const withoutSector = gatePaletteEntries(entries, ready({
      measures: [measure],
      dimensions: [{ code: 'REGION', conceptRole: 'geo', isTime: false, members: [] }],
    }))
    expect(withoutSector.map((e) => e.type)).not.toContain('sunburst')
    // A sector-role dimension present → kept.
    const withSector = gatePaletteEntries(entries, ready({
      measures: [measure],
      dimensions: [{ code: 'NACE', conceptRole: 'sector', isTime: false, members: [] }],
    }))
    expect(withSector.map((e) => e.type)).toContain('sunburst')
  })

  // A data panel that declares NO requirement is not gated by any role — only the
  // baseline measure check applies. Proves the type string is never consulted.
  it('keeps a data panel with no declared requirement regardless of dimensions', () => {
    const plain = entry({ type: 'geo-flavoured-name', caps: ['data', 'chart'] })
    const out = gatePaletteEntries([plain], ready({
      measures: [measure],
      dimensions: [{ code: 'X', conceptRole: null, isTime: false, members: [] }],
    }))
    expect(out.map((e) => e.type)).toContain('geo-flavoured-name')
  })
})

// ── CANON-LOCK (Law 1) — the gate decides from DECLARED fields, never a type-sniff ──
//
//  Pins the AR-52 panel-quality #1 fix: the capability gate must contain NO hardcoded
//  dimension name and NO node-type sniff. Decisions come from `entry.requires` /
//  `entry.caps` only. Guards against a silent regression to `type === 'map'` /
//  `type.includes('geo')` / a `'geo'` literal in the gate.
//
describe('capabilityGate — no privileged-dimension sniff (Law 1 canon-lock)', () => {
  // Strip comments — the doc-comments legitimately NAME the forbidden patterns to
  // explain what the code must NOT do; only executable code is scanned.
  const code = gateSource
    .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
    .replace(/^\s*\/\/.*$/gm, '')          // line comments

  it('contains no hardcoded dimension-name literal', () => {
    // No privileged dimension name may appear as a string literal in the logic.
    for (const forbidden of ["'geo'", '"geo"', "'time'", '"time"']) {
      expect(code).not.toContain(forbidden)
    }
  })

  it('never sniffs a node type string to make a gating decision', () => {
    expect(code).not.toMatch(/\.type\s*===/)     // entry.type === 'map'
    expect(code).not.toMatch(/\.type\.includes/) // entry.type.includes('geo')
  })
})
