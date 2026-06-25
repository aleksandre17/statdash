import { describe, it, expect } from 'vitest'
import {
  applyEncoding,
  channelField,
  channelType,
  channelKey,
  deriveMeasurementType,
  resolveMeasurementType,
} from './encoding'
import type { EncodingSpec, EngineRow, ChannelDef } from './encoding'

// ── FF-ENCODING-ADDITIVE ──────────────────────────────────────────────
//
//  R2 enriches EncodingSpec channels with an OPTIONAL Vega-Lite measurement
//  `type` and an OPTIONAL data-join `key`, ADDITIVELY: a bare-string channel
//  is byte-identical with pre-R2 behavior (default-derived); a ChannelDef
//  channel uses the declared type/key.
//
//  This file is the focused oracle for the additive guarantee.

const rows: EngineRow[] = [
  { measure: 'B1G', time: 2023, value: 1000, label: 'GDP',   region: 'GE', uid: 'r1' },
  { measure: 'B1G', time: 2023, value:  500, label: 'GDP',   region: 'AB', uid: 'r2' },
  { measure: 'D1',  time: 2023, value:  300, label: 'Wages', region: 'GE', uid: 'r3' },
]

describe('FF-ENCODING-ADDITIVE — bare-string channels are byte-identical', () => {
  it('bare string === { field } object → identical DataRow[]', () => {
    const bare: EncodingSpec = { label: 'label', value: 'value', series: 'region' }
    const obj: EncodingSpec  = {
      label:  { field: 'label' },
      value:  { field: 'value' },
      series: { field: 'region' },
    }
    expect(applyEncoding(rows, obj)).toEqual(applyEncoding(rows, bare))
  })

  it('a ChannelDef carrying ONLY type/key (no field change) does not alter the field read', () => {
    const bare: EncodingSpec = { label: 'label', value: 'value', series: 'region' }
    const typed: EncodingSpec = {
      label:  { field: 'label',  type: 'nominal' },
      value:  { field: 'value',  type: 'quantitative' },
      series: { field: 'region', type: 'nominal' },
    }
    // type is metadata for downstream scale/axis refinement — it must NOT change
    // the produced DataRow[] (label/value/series/id/color all identical).
    expect(applyEncoding(rows, typed)).toEqual(applyEncoding(rows, bare))
  })

  it('auto-id (label::series) is preserved when no key is declared', () => {
    const out = applyEncoding(rows, { label: 'label', value: 'value', series: 'region' })
    expect(out.map((r) => r.id)).toEqual(['GDP::GE', 'GDP::AB', 'Wages::GE'])
  })
})

describe('FF-ENCODING-ADDITIVE — ChannelDef key/type IS used when present', () => {
  it('a channel `key` overrides the positional auto-id with the join-key field', () => {
    const out = applyEncoding(rows, {
      label:  { field: 'label', key: 'uid' },
      value:  'value',
      series: 'region',
    })
    // identity now comes from the stable join key, not label::series
    expect(out.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    // ...but label/series/value are unchanged (no visual change)
    expect(out.map((r) => ({ label: r.label, series: r.series, value: r.value }))).toEqual([
      { label: 'GDP',   series: 'GE', value: 1000 },
      { label: 'GDP',   series: 'AB', value:  500 },
      { label: 'Wages', series: 'GE', value:  300 },
    ])
  })

  it('explicit enc.id still wins over a channel key (precedence preserved)', () => {
    const withId: EngineRow[] = rows.map((r, i) => ({ ...r, explicitId: `e${i}` }))
    const out = applyEncoding(withId, {
      id:    'explicitId',
      label: { field: 'label', key: 'uid' },
      value: 'value',
    })
    expect(out.map((r) => r.id)).toEqual(['e0', 'e1', 'e2'])
  })
})

describe('channel accessors', () => {
  it('channelField extracts the field name from both forms', () => {
    expect(channelField('region')).toBe('region')
    expect(channelField({ field: 'region' })).toBe('region')
    expect(channelField(undefined)).toBeUndefined()
  })

  it('channelType / channelKey read only from the object form', () => {
    const c: ChannelDef = { field: 'time', type: 'temporal', key: 'uid' }
    expect(channelType(c)).toBe('temporal')
    expect(channelKey(c)).toBe('uid')
    expect(channelType('time')).toBeUndefined()
    expect(channelKey('time')).toBeUndefined()
  })
})

describe('deriveMeasurementType — byte-identical default derivation', () => {
  it('time field → temporal', () => {
    expect(deriveMeasurementType('time')).toBe('temporal')
  })
  it('measure role / number → quantitative', () => {
    expect(deriveMeasurementType('number')).toBe('quantitative')
    expect(deriveMeasurementType('string', 'measure')).toBe('quantitative')
  })
  it('string/boolean/unknown dimension → nominal', () => {
    expect(deriveMeasurementType('string')).toBe('nominal')
    expect(deriveMeasurementType('boolean')).toBe('nominal')
    expect(deriveMeasurementType('unknown')).toBe('nominal')
  })
})

describe('resolveMeasurementType — explicit wins, else derived', () => {
  it('uses the declared type when the channel carries one', () => {
    expect(resolveMeasurementType({ field: 'rank', type: 'ordinal' }, 'number', 'measure'))
      .toBe('ordinal')
  })
  it('falls back to derived for a bare-string channel (byte-identical)', () => {
    expect(resolveMeasurementType('time', 'time')).toBe('temporal')
    expect(resolveMeasurementType('value', 'number', 'measure')).toBe('quantitative')
  })
})
