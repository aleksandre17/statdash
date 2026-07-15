// ── thresholdAuthorable.fitness — thresholds are authorable through the Inspector ─
//
//  The coverage promise (mirrors valueMappingAuthorable): a renderable capability MUST
//  have an authoring surface. Thresholds drive the KPI value's conditional formatting;
//  this gate proves the Inspector can author them — a PropField of type 'thresholds'
//  resolves to the friendly step-list editor (NOT the raw-JSON fallback), and that
//  editor is driven by THRESHOLD_STEP_SCHEMA whose colour is a token enum-ref (no
//  literal hex authorable — Law 2).
//
import { describe, it, expect } from 'vitest'
import { THRESHOLD_STEP_SCHEMA } from './thresholdStepSchema'
import type { PropField } from '@statdash/react/engine'
import { fieldControlRegistry } from '../../FieldControlRegistry'
import { JsonControl } from '../primitives'
import { ThresholdField } from './ThresholdField'
import { THRESHOLDS_FIELD_TYPE, registerThresholdsControl } from './register'
import { thresholdStepSchemaSource } from './thresholdStepSchemaSource'

registerThresholdsControl()

describe('thresholds are authorable through the Inspector (coverage)', () => {
  it('a `thresholds` PropField resolves to the step-list editor, not raw JSON', () => {
    const field = { field: 'thresholds', type: THRESHOLDS_FIELD_TYPE, label: { ka: 'ბიჯები', en: 'Steps' } } as unknown as PropField
    const control = fieldControlRegistry.resolve(field)
    expect(control).toBe(ThresholdField)
    expect(control).not.toBe(JsonControl)
  })

  it('the step editor is driven by THRESHOLD_STEP_SCHEMA (no bespoke form)', () => {
    expect(thresholdStepSchemaSource.getSchema({} as never)).toBe(THRESHOLD_STEP_SCHEMA)
    expect(THRESHOLD_STEP_SCHEMA.length).toBeGreaterThan(0)
  })

  it('the colour is picked from the token palette (enum-ref) — no literal hex authorable', () => {
    const token = THRESHOLD_STEP_SCHEMA.find((f) => f.field === 'token')
    expect(token?.type).toBe('enum-ref')
    expect(token?.source).toBe('tokens')
  })

  it('the breakpoint bound (`from`) is a numeric field — the ordered-axis discriminant', () => {
    const from = THRESHOLD_STEP_SCHEMA.find((f) => f.field === 'from')
    expect(from?.type).toBe('number')
  })
})
