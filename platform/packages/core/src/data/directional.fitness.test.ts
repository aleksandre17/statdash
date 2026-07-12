// @vitest-environment node
//
// ── FF-DIRECTIONAL-* — the Strangler parity proof (AR-42 P2) ────────────────
//
//  Before the six hand-authored `op:if` derives are deleted from provisioning
//  and replaced by ONE `{op:'directional'}` var, `resolveDirectional` must be
//  proven BYTE-IDENTICAL to them across the full A/B/C/D directional state
//  matrix (+ the sentinel-robustness case). THIS is that proof — the acceptance
//  spine (EXPECT) is the exact truth table the derives produced
//  (DESIGN-directional-sector-crossfilter.md §2, crossFilterLinkage.fitness).
//
//  A change to the LAW that breaks a cell fails here; a hardcoded dim/param
//  literal in the op fails FF-DIRECTIONAL-AGNOSTIC.

import { describe, it, expect } from 'vitest'
import { resolveDirectional, resolveMultiVar, isDirectionalSpec, type DirectionalSpec } from './directional'
import type { DimVal } from '../sdmx'

// The regional-page directional spec — the ONE declaration that replaces the six
// derives. focus=sector (param `sector`), co=geo (param `region`), focus wins ties;
// the SDMX total member `_T` is a page-declared unselected sentinel (kept out of core).
const SPEC: DirectionalSpec = {
  op: 'directional',
  focus: 'sector',
  co: 'geo',
  priority: ['sector', 'region'],
  emit: 'axis',
  grain: ['time'],
  unselected: ['', '_T'],
}

const DERIVES = ['_xDim', '_seriesDim', '_mark', '_byDims', '_sortBy', '_sortDir'] as const

// The acceptance spine (DESIGN §2). A/B = region arm; C/D = the sector arm.
const STATES: Record<string, Record<string, DimVal>> = {
  A: { region: '',   sector: ''   },   // none      → donut of regions
  B: { region: 'R2', sector: ''   },   // region    → x=sector, series=geo
  C: { region: '',   sector: 'S1' },   // sector    → x=geo,    series=sector (across all regions)
  D: { region: 'R2', sector: 'S1' },   // compound  → x=geo,    series=sector (intersection)
}
const EXPECT: Record<string, Record<(typeof DERIVES)[number], string>> = {
  A: { _xDim: 'geoLabel',    _seriesDim: '',            _mark: 'donut', _byDims: 'geo',             _sortBy: 'value',       _sortDir: 'desc' },
  B: { _xDim: 'sectorLabel', _seriesDim: 'geoLabel',    _mark: 'bar',   _byDims: 'sector,geo,time', _sortBy: 'sectorOrder', _sortDir: 'asc'  },
  C: { _xDim: 'geoLabel',    _seriesDim: 'sectorLabel', _mark: 'bar',   _byDims: 'sector,geo,time', _sortBy: 'value',       _sortDir: 'desc' },
  D: { _xDim: 'geoLabel',    _seriesDim: 'sectorLabel', _mark: 'bar',   _byDims: 'sector,geo,time', _sortBy: 'value',       _sortDir: 'desc' },
}

describe('FF-DIRECTIONAL-TRUTH-TABLE — resolveDirectional ≡ the six derives (A/B/C/D)', () => {
  for (const [s, dims] of Object.entries(STATES)) {
    it(`state ${s}: the six-field axis assignment is byte-identical`, () => {
      const out = resolveDirectional(SPEC, dims)
      for (const d of DERIVES) expect(out[d], `${s} · ${d}`).toBe(EXPECT[s][d])
    })
  }

  // Sentinel-robustness: a stray/leftover sector='_T' counts as UNSELECTED (State A),
  // never as an active sector selection.
  it('sector="_T" is treated as unselected (State A)', () => {
    const out = resolveDirectional(SPEC, { region: '', sector: '_T' })
    for (const d of DERIVES) expect(out[d], `_T≡none · ${d}`).toBe(EXPECT.A[d])
  })

  // The full record (not just per-key) is exactly the acceptance row.
  it('emits exactly the six axis keys, no more', () => {
    const out = resolveDirectional(SPEC, STATES.D)
    expect(Object.keys(out).sort()).toEqual([...DERIVES].sort())
  })
})

describe('FF-DIRECTIONAL-AGNOSTIC — the law is dimension-blind (Law 1)', () => {
  // The op works for ANY two dims — swap in a different pair and the SAME structure
  // resolves, proving no `sector`/`geo`/`region` literal is baked into the resolver.
  it('resolves an arbitrary dim pair with identical structure', () => {
    const spec: DirectionalSpec = {
      op: 'directional', focus: 'product', co: 'channel',
      priority: ['product', 'market'], emit: 'axis', grain: ['time'], unselected: [''],
    }
    // focus (product) active only → series=product, x=channel, bar, grain product,channel,time
    const out = resolveDirectional(spec, { product: 'P1', market: '' })
    expect(out._seriesDim).toBe('productLabel')
    expect(out._xDim).toBe('channelLabel')
    expect(out._mark).toBe('bar')
    expect(out._byDims).toBe('product,channel,time')
    // co (market) active only → series=channel, x=product, sort by product order asc
    const out2 = resolveDirectional(spec, { product: '', market: 'M1' })
    expect(out2._seriesDim).toBe('channelLabel')
    expect(out2._xDim).toBe('productLabel')
    expect(out2._sortBy).toBe('productOrder')
    expect(out2._sortDir).toBe('asc')
    // none → donut, co on x, grain = co alone
    const out3 = resolveDirectional(spec, { product: '', market: '' })
    expect(out3._mark).toBe('donut')
    expect(out3._byDims).toBe('channel')
  })

  it('carries no source-literal dim/param names in the resolver module', async () => {
    // The op reads focus/co/priority — never a hardcoded regional dim. (A cheap guard:
    // the resolver never mentions the concrete regional dims in its logic.)
    const src = await import('node:fs/promises')
      .then((fs) => fs.readFile(new URL('./directional.ts', import.meta.url), 'utf8'))
    // The doc-comment names dims for illustration; the executable law (below the imports)
    // must not — assert the resolveDirectional body references only the spec fields.
    const body = src.slice(src.indexOf('export function resolveDirectional'))
    for (const lit of ['sector', 'geo', 'region', '_T'])
      expect(body.includes(`'${lit}'`), `resolveDirectional body must not hardcode '${lit}'`).toBe(false)
  })
})

describe('resolveMultiVar — the evalVarMap front-door', () => {
  it('spreads a directional spec into six named outputs', () => {
    const out = resolveMultiVar(SPEC, STATES.C)
    expect(out).not.toBeNull()
    expect(out!._seriesDim).toBe('sectorLabel')
  })
  it('returns null for an ordinary single-value expr (fall through to evalExpr)', () => {
    expect(resolveMultiVar({ op: 'if', cond: true, then: 'x' }, {})).toBeNull()
    expect(resolveMultiVar('geo', {})).toBeNull()
    expect(resolveMultiVar({ $ctx: 'geo' }, {})).toBeNull()
  })
  it('isDirectionalSpec discriminates structurally', () => {
    expect(isDirectionalSpec(SPEC)).toBe(true)
    expect(isDirectionalSpec({ op: 'if' })).toBe(false)
    expect(isDirectionalSpec({ op: 'directional', focus: 'a' })).toBe(false) // missing co/priority
  })
})
