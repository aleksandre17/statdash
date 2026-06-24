// ── TransformStepEditor — schema-driven transform-step authoring [V1] ──────────
//
//  Renders ONE TransformStep through the SAME generic Inspector that authors
//  node/panel/chrome properties — driven by the op's PropSchema (carried in the
//  engine step-registry, resolved via transformStepSchemaSource). NO bespoke
//  per-op form, NO second form engine (the ADR mandate / OCP).
//
//  The step is modeled as a CanvasNode: `{ type: step.op, props: step }`. The
//  Inspector reads each PropField off `props` (= the step) and emits a dot-path
//  write; we apply it immutably with setAtPath and hand the new step up. `op` is
//  never in any schema, so it is carried through untouched (the discriminant is
//  immutable in the editor — exactly the prior RawStepForm guarantee).
//
//  An op WITHOUT a registered schema yields an empty Inspector ("no property
//  schema yet") — the visible COVERAGE_TODO surface. Today only `joinByField`
//  (resolved-rows, non-declarative) hits that path.
//
import type { TransformStep } from '@statdash/engine'
import { Inspector } from '../../../../../inspector'
import { setAtPath } from '../../../../../inspector/showWhen'
import { transformStepSchemaSource } from './transformStepSchemaSource'
import type { CanvasNode } from '../../../../../types/constructor'

export interface TransformStepEditorProps {
  step:     TransformStep
  onChange: (next: TransformStep) => void
}

export function TransformStepEditor({ step, onChange }: TransformStepEditorProps) {
  // Model the step as the Inspector's element: type = op, props = the step.
  const node: CanvasNode = {
    id:       `step-${step.op}`,
    type:     step.op,
    props:    step as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(step, field, next))
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={transformStepSchemaSource}
    />
  )
}
