// ── binding fitness — a dropped chip writes BYTE-IDENTICAL config (V5) ────────
//
//  The ADR V5 invariant: a field chip dropped on a well produces the EXACT SAME
//  ObsQuery / EncodingSpec the typed editor (MeasureSelector / EncodingEditor)
//  emits. We pin this by reproducing the typed editor's own write here and
//  asserting deep equality with the binding write — the UX is the improvement,
//  the OUTPUT must not differ by a byte.
//
import { describe, it, expect } from 'vitest'
import type { EncodingSpec, ObsQuery } from '@statdash/engine'
import {
  bindMeasure, bindEncoding, readMeasures, wellAccepts, ALL_WELLS,
} from './binding'
import type { FieldChip } from './fieldChips'

const measureChip = (code: string): FieldChip => ({
  code, label: code, kind: 'measure', measurementType: 'quantitative',
})
const dimChip = (code: string): FieldChip => ({
  code, label: code, kind: 'dimension', measurementType: 'nominal',
})

describe('binding — byte-identical to the typed editors', () => {
  it('bindMeasure === MeasureSelector emitting measure: codes', () => {
    const query: ObsQuery = { measure: ['GDP'] }
    // What MeasureSelector writes when you add 'GVA' to the chip input:
    const typedEditorOutput: ObsQuery = { measure: ['GDP', 'GVA'] }
    expect(bindMeasure(query, measureChip('GVA'))).toEqual(typedEditorOutput)
  })

  it('bindMeasure is idempotent (no duplicate codes — Autocomplete dedupes too)', () => {
    const query: ObsQuery = { measure: ['GDP'] }
    expect(bindMeasure(query, measureChip('GDP'))).toEqual({ measure: ['GDP'] })
  })

  it('bindMeasure normalizes a scalar measure to the array form', () => {
    expect(readMeasures('GDP')).toEqual(['GDP'])
    expect(bindMeasure({ measure: 'GDP' }, measureChip('GVA'))).toEqual({ measure: ['GDP', 'GVA'] })
  })

  it('bindEncoding(value) === EncodingEditor writing enc.value = field (bare string)', () => {
    const enc: EncodingSpec = { label: 'region' }
    // What EncodingEditor.setChannel('value', 'GDP') writes:
    const typedEditorOutput: EncodingSpec = { label: 'region', value: 'GDP' }
    expect(bindEncoding(enc, 'value', measureChip('GDP'))).toEqual(typedEditorOutput)
  })

  it('bindEncoding(label) === EncodingEditor.setLabel (required channel set directly)', () => {
    const enc: EncodingSpec = { label: '' }
    expect(bindEncoding(enc, 'label', dimChip('region'))).toEqual({ label: 'region' })
  })

  it('bindEncoding writes a BARE STRING (not a ChannelDef) — diverging would break the invariant', () => {
    const out = bindEncoding({ label: '' }, 'series', dimChip('sector'))
    expect(typeof out.series).toBe('string')
    expect(out.series).toBe('sector')
  })

  it('bindEncoding seeds a minimal { label: "" } when no encoding exists yet', () => {
    expect(bindEncoding(undefined, 'value', measureChip('GDP'))).toEqual({ label: '', value: 'GDP' })
  })
})

describe('wellAccepts — Looker/Tableau shelf rules', () => {
  it('measure + value wells take a measure, reject a dimension', () => {
    expect(wellAccepts('measure', 'measure')).toBe(true)
    expect(wellAccepts('value', 'measure')).toBe(true)
    expect(wellAccepts('measure', 'dimension')).toBe(false)
    expect(wellAccepts('value', 'dimension')).toBe(false)
  })

  it('label/series/color take a dimension, reject a measure', () => {
    for (const well of ['label', 'series', 'color'] as const) {
      expect(wellAccepts(well, 'dimension')).toBe(true)
      expect(wellAccepts(well, 'measure')).toBe(false)
    }
  })

  it('every well has a defined acceptance for both kinds (total)', () => {
    for (const well of ALL_WELLS) {
      expect(typeof wellAccepts(well, 'measure')).toBe('boolean')
      expect(typeof wellAccepts(well, 'dimension')).toBe('boolean')
    }
  })
})
