import { describe, it, expect } from 'vitest'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from './FieldControlRegistry'
import {
  TextControl, NumberControl, BooleanControl,
  ColorControl, SelectControl, JsonControl,
} from './controls/primitives'
import { LocaleField }  from './controls/LocaleField'
import { EnumRefField } from './controls/EnumRefField'

const f = (over: Partial<PropField>): PropField =>
  ({ field: 'x', type: 'string', label: 'X', ...over })

describe('FieldControlRegistry — built-in coverage', () => {
  it('has a control for every known PropFieldType', () => {
    for (const t of ['string', 'number', 'boolean', 'color', 'icon',
                     'LocaleString', 'object', 'array', 'DataSpec', 'ChartDef', 'enum-ref']) {
      expect(fieldControlRegistry.has(t)).toBe(true)
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

  it('rich/opaque types fall back to the JSON control', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'object' }))).toBe(JsonControl)
    expect(fieldControlRegistry.resolve(f({ type: 'DataSpec' }))).toBe(JsonControl)
  })

  it('an unregistered type falls back to the JSON control (no throw)', () => {
    expect(fieldControlRegistry.resolve(f({ type: 'totally-new' as PropField['type'] }))).toBe(JsonControl)
  })
})

describe('FieldControlRegistry — OCP: a new field type = one register() call', () => {
  it('serves a freshly-registered control without Inspector changes', () => {
    const Custom = () => null
    fieldControlRegistry.register('rating' as PropField['type'], Custom)
    expect(fieldControlRegistry.resolve(f({ type: 'rating' as PropField['type'] }))).toBe(Custom)
  })
})
