import { describe, it, expect, afterEach } from 'vitest'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from './FieldControlRegistry'
import {
  TextControl, NumberControl, BooleanControl,
  ColorControl, SelectControl, JsonControl,
} from './controls/primitives'
import { SummaryCard } from './controls/SummaryCard'
import { setRawJsonEscape } from './rawJsonEscape'
import { LocaleField }  from './controls/LocaleField'
import { EnumRefField } from './controls/EnumRefField'
import { ArrayOfControl, ObjectControl } from './controls/NestedItemControl'

const f = (over: Partial<PropField>): PropField =>
  ({ field: 'x', type: 'string', label: 'X', ...over })

// The escape hatch is a module singleton — reset it after every test that flips it.
afterEach(() => setRawJsonEscape(null))

describe('FieldControlRegistry — built-in coverage', () => {
  it('has a control for every explicitly-registered PropFieldType', () => {
    for (const t of ['string', 'number', 'boolean', 'color', 'icon',
                     'LocaleString', 'enum-ref']) {
      expect(fieldControlRegistry.has(t)).toBe(true)
    }
  })

  it('rich/opaque types are NOT registered — they resolve to the SummaryCard default', () => {
    for (const t of ['object', 'array', 'DataSpec', 'ChartDef']) {
      expect(fieldControlRegistry.has(t)).toBe(false)
    }
  })
})

describe('FieldControlRegistry.resolve — precedence (OCP dispatch)', () => {
  it('maps primitives by type', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'string' }))).toBe(TextControl)
    expect(fieldControlRegistry.resolve(f({ type: 'number' }))).toBe(NumberControl)
    expect(fieldControlRegistry.resolve(f({ type: 'boolean' }))).toBe(BooleanControl)
    expect(fieldControlRegistry.resolve(f({ type: 'color' }))).toBe(ColorControl)
  })

  it('coverage:localized wins over the declared type (LocaleField)', () => {
    const field = f({ type: 'string', ...({ coverage: 'localized' } as object) })
    expect(fieldControlRegistry.resolve(field)).toBe(LocaleField)
  })

  it('LocaleString type resolves to LocaleField', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'LocaleString' }))).toBe(LocaleField)
  })

  it("type 'enum-ref' resolves to EnumRefField", () => {
    expect(fieldControlRegistry.resolve(f({ type: 'enum-ref' as PropField['type'] }))).toBe(EnumRefField)
  })

  it('static options force a SelectControl over the by-type control', () => {
    const field = f({ type: 'string', options: [{ value: 'a', label: 'A' }] })
    expect(fieldControlRegistry.resolve(field)).toBe(SelectControl)
  })

  it('rich/opaque types resolve to the SummaryCard by DEFAULT (FF-NO-RAW-JSON-DEFAULT)', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'object' }))).toBe(SummaryCard)
    expect(fieldControlRegistry.resolve(f({ type: 'array' }))).toBe(SummaryCard)
    expect(fieldControlRegistry.resolve(f({ type: 'DataSpec' }))).toBe(SummaryCard)
    expect(fieldControlRegistry.resolve(f({ type: 'ChartDef' }))).toBe(SummaryCard)
  })

  it('raw-JSON control is reachable ONLY behind the dev escape hatch', () => {
    setRawJsonEscape(true)
    expect(fieldControlRegistry.resolve(f({ type: 'object' }))).toBe(JsonControl)
    expect(fieldControlRegistry.resolve(f({ type: 'DataSpec' }))).toBe(JsonControl)
  })

  // ── D7.1 — structured nested (itemSchema) precedence (unchanged) ────────────
  it('array/object WITHOUT itemSchema fall to the SummaryCard (not raw JSON)', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'array' }))).toBe(SummaryCard)
    expect(fieldControlRegistry.resolve(f({ type: 'object' }))).toBe(SummaryCard)
  })

  it('array WITH itemSchema resolves to the ArrayOf nested editor', () => {
    const field = f({ type: 'array', itemSchema: [{ field: 'label', type: 'string', label: 'L' }] })
    expect(fieldControlRegistry.resolve(field)).toBe(ArrayOfControl)
  })

  it('object WITH itemSchema resolves to the Object nested editor', () => {
    const field = f({ type: 'object', itemSchema: [{ field: 'label', type: 'string', label: 'L' }] })
    expect(fieldControlRegistry.resolve(field)).toBe(ObjectControl)
  })

  it('an unregistered type falls back to the SummaryCard (no throw, no raw JSON)', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'totally-new' as PropField['type'] }))).toBe(SummaryCard)
  })
})

describe('FieldControlRegistry — OCP: a new field type = one register() call', () => {
  it('serves a freshly-registered control without Inspector changes', () => {
    const Custom = () => null
    fieldControlRegistry.register('rating' as PropField['type'], Custom)
    expect(fieldControlRegistry.resolve(f({ type: 'rating' as PropField['type'] }))).toBe(Custom)
  })
})
