// ── ThresholdStepEditor — schema-driven authoring of ONE threshold step ───────
//
//  Renders ONE ValueThresholdStep through the generic Inspector (schema-driven, no bespoke
//  form) — mirrors ValueMappingRuleEditor exactly. The step is modeled as a CanvasNode
//  whose `props` are the step; the Inspector reads each PropField off `props` and emits
//  a dot-path write (from, token, glyph, state) applied immutably.
//
import type { ValueThresholdStep } from '@statdash/engine'
import { Inspector } from '../../../inspector'
import { setAtPath } from '../../showWhen'
import { thresholdStepSchemaSource, THRESHOLD_STEP_KEY } from './thresholdStepSchemaSource'
import type { CanvasNode } from '../../../types/constructor'

export interface ThresholdStepEditorProps {
  uid:      string
  step:     ValueThresholdStep
  onChange: (next: ValueThresholdStep) => void
}

export function ThresholdStepEditor({ uid, step, onChange }: ThresholdStepEditorProps) {
  const node: CanvasNode = {
    id:       `thstep-${uid}`,
    type:     THRESHOLD_STEP_KEY,
    props:    step as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(step, field, next) as ValueThresholdStep)
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={thresholdStepSchemaSource}
    />
  )
}
