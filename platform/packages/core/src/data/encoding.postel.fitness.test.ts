import { describe, it, expect } from 'vitest'
import { applyEncoding, resolveEncodingRefs, isCtxRef, channelField } from './encoding'
import type { EncodingSpec, EngineRow } from './encoding'
import type { RefServices } from '../ref/ref'

// ── FF-ENCODING-POSTEL — the AR-36 P0 additivity gate ─────────────────
//
//  P0 widens EncodingChannel to `string | ChannelDef | CtxScopeRef` and adds a
//  `resolveEncodingRefs` pre-pass that lowers a `{$ctx:key}` channel to a
//  concrete field NAME BEFORE applyEncoding. The invariants this file locks:
//
//   1. A bare-string encoding is byte-identical — resolveEncodingRefs returns the
//      SAME object reference (no allocation) and produces an identical DataRow[].
//   2. A `{$ctx:key}` channel resolves to the right field from dims (OLAP coord)
//      OR from the derived page vars (var-scope fallback) — via the ONE ref
//      dispatcher (no second resolver, no dim-name literal → Law 1 agnostic).

const rows: EngineRow[] = [
  { measure: 'GVA', time: 2023, value: 1000, sectorLabel: 'Agriculture', geoLabel: 'Tbilisi', color: '#a1' },
  { measure: 'GVA', time: 2023, value:  600, sectorLabel: 'Industry',    geoLabel: 'Tbilisi', color: '#a2' },
  { measure: 'GVA', time: 2023, value:  400, sectorLabel: 'Agriculture', geoLabel: 'Adjara',  color: '#a3' },
]

describe('FF-ENCODING-POSTEL — bare-string encodings are byte-identical', () => {
  const bare: EncodingSpec = { label: 'sectorLabel', value: 'value', series: 'geoLabel', color: 'color' }

  it('resolveEncodingRefs returns the SAME reference for a bare-string encoding (zero-alloc fast path)', () => {
    const out = resolveEncodingRefs(bare, { dims: { _xDim: 'geoLabel' } })
    expect(out).toBe(bare) // identity — proves the widening is purely additive
  })

  it('a ChannelDef-only encoding is also returned by reference (no CtxRef present)', () => {
    const typed: EncodingSpec = { label: { field: 'sectorLabel', type: 'nominal' }, value: 'value' }
    expect(resolveEncodingRefs(typed, { dims: {} })).toBe(typed)
  })

  it('the resolved (unchanged) spec produces the identical DataRow[] as the un-passed spec', () => {
    const direct   = applyEncoding(rows, bare)
    const viaPass  = applyEncoding(rows, resolveEncodingRefs(bare, { dims: { _xDim: 'geoLabel' } }))
    expect(viaPass).toEqual(direct)
  })
})

describe('FF-ENCODING-POSTEL — a {$ctx} channel resolves to a field NAME', () => {
  it('resolves label/series from ctx.dims (the OLAP coordinate)', () => {
    const bound: EncodingSpec = {
      label:  { $ctx: '_xDim' },
      series: { $ctx: '_seriesDim' },
      value:  'value',
    }
    const services: RefServices = { dims: { _xDim: 'sectorLabel', _seriesDim: 'geoLabel' } }
    const resolved = resolveEncodingRefs(bound, services)

    // lowered to concrete field NAMES — no CtxRef survives the pass
    expect(resolved.label).toBe('sectorLabel')
    expect(resolved.series).toBe('geoLabel')
    expect(isCtxRef(resolved.label)).toBe(false)

    // ...and applyEncoding now reads those fields — identical to authoring the
    // field names literally (proves the ref is a pure alias for the field NAME).
    const literal: EncodingSpec = { label: 'sectorLabel', series: 'geoLabel', value: 'value' }
    expect(applyEncoding(rows, resolved)).toEqual(applyEncoding(rows, literal))
  })

  it('rotating the binding (x⇄series) is a pure re-read of the SAME rows', () => {
    const bound: EncodingSpec = { label: { $ctx: '_xDim' }, series: { $ctx: '_seriesDim' }, value: 'value' }

    const stateA = resolveEncodingRefs(bound, { dims: { _xDim: 'sectorLabel', _seriesDim: 'geoLabel' } })
    const stateB = resolveEncodingRefs(bound, { dims: { _xDim: 'geoLabel', _seriesDim: 'sectorLabel' } })

    expect(applyEncoding(rows, stateA)).toEqual(applyEncoding(rows, { label: 'sectorLabel', series: 'geoLabel', value: 'value' }))
    expect(applyEncoding(rows, stateB)).toEqual(applyEncoding(rows, { label: 'geoLabel', series: 'sectorLabel', value: 'value' }))
  })

  it('falls back to var-scope (services.vars) when the key is not a dim — same dispatcher, no second resolver', () => {
    const bound: EncodingSpec = { label: { $ctx: '_xDim' }, value: 'value' }
    // _xDim lives in the derived page vars, not dims → var-scope fallback fires
    const resolved = resolveEncodingRefs(bound, { dims: {}, vars: { _xDim: 'geoLabel' } })
    expect(resolved.label).toBe('geoLabel')
    expect(channelField(resolved.label)).toBe('geoLabel')
  })

  it('an empty resolved value → no-series (empty field name degrades to no grouping)', () => {
    const bound: EncodingSpec = { label: 'sectorLabel', series: { $ctx: '_seriesDim' }, value: 'value' }
    // no selection → _seriesDim = "" → series channel resolves empty → no series
    const resolved = resolveEncodingRefs(bound, { dims: { _seriesDim: '' } })
    expect(resolved.series).toBe('')
    expect(applyEncoding(rows, resolved).every((r) => r.series === undefined)).toBe(true)
  })

  it('is dimension-agnostic (Law 1): works for arbitrary dim keys, no hardcoded name', () => {
    const bound: EncodingSpec = { label: { $ctx: '_a' }, series: { $ctx: '_b' }, value: 'value' }
    const alien: EngineRow[] = [{ measure: 'X', fooLabel: 'F', barLabel: 'B', value: 7 }]
    const resolved = resolveEncodingRefs(bound, { dims: { _a: 'fooLabel', _b: 'barLabel' } })
    expect(applyEncoding(alien, resolved)).toEqual(
      applyEncoding(alien, { label: 'fooLabel', series: 'barLabel', value: 'value' }),
    )
  })
})
