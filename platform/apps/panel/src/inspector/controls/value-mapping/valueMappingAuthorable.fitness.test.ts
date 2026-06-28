// ── valueMappingAuthorable.fitness.test — value mappings are authorable [EXP-06] ──
//
//  The coverage promise (mirrors Coverage Fitness #1): a renderable capability MUST
//  have an authoring surface. Value mappings are consumed by the table status cell;
//  this gate proves the Inspector can author them — a PropField of type
//  'value-mapping' resolves to the friendly rule-list editor (NOT the raw-JSON
//  fallback), and that editor renders the engine's VALUE_MAPPING_SCHEMA.
//
import { describe, it, expect } from 'vitest'
import { VALUE_MAPPING_SCHEMA } from './valueMappingSchema'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { JsonControl } from '../primitives'
import { ValueMappingField } from './ValueMappingField'
import { VALUE_MAPPING_FIELD_TYPE, registerValueMappingControl } from './register'
import { valueMappingSchemaSource } from './valueMappingSchemaSource'

registerValueMappingControl()

describe('value mappings are authorable through the Inspector (coverage)', () => {
  it('a `value-mapping` PropField resolves to the rule-list editor, not raw JSON', () => {
    const field = { field: 'valueMappings', type: VALUE_MAPPING_FIELD_TYPE, label: { ka: 'რუკა', en: 'Map' } } as unknown as PropField
    const control = fieldControlRegistry.resolve(field)
    expect(control).toBe(ValueMappingField)
    expect(control).not.toBe(JsonControl)
  })

  it('the rule editor is driven by the engine VALUE_MAPPING_SCHEMA (no bespoke form)', () => {
    expect(valueMappingSchemaSource.getSchema({} as never)).toBe(VALUE_MAPPING_SCHEMA)
    expect(VALUE_MAPPING_SCHEMA.length).toBeGreaterThan(0)
  })

  it('the colour is picked from the token palette (enum-ref) — no literal hex authorable', () => {
    const token = VALUE_MAPPING_SCHEMA.find((f) => f.field === 'token')
    expect(token?.type).toBe('enum-ref')
    expect(token?.source).toBe('tokens')
  })
})
