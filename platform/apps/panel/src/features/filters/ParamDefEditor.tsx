// ── ParamDefEditor — schema-driven page-filter control authoring [V0] ──────────
//
//  Renders ONE page-level filter control (a ParamDef) through the SAME generic
//  Inspector that authors node / panel / chrome / transform-step properties —
//  driven by the type's PropSchema (carried in the engine param-schema registry,
//  resolved via filterParamSchemaSource). NO bespoke per-control form, NO second
//  form engine (the ADR mandate / OCP).
//
//  The control is modeled as a CanvasNode: `{ type: param.type, props: param }`.
//  The Inspector reads each PropField off `props` (= the ParamDef incl. its `key`)
//  and emits a dot-path write; we apply it immutably with setAtPath and hand the
//  next ParamDef up. `type` is never in any schema, so the discriminant is carried
//  through untouched (immutable in the editor — exactly the TransformStepEditor
//  guarantee for `op`).
//
//  The dimension `key` and cube-bound defaults resolve their options from the
//  active dataset's cube profile (EnumRefField + useActiveProfile) — the author
//  PICKS a real dimension / member, never types a raw code (Law 2).
//
import type { ParamNode } from '@statdash/engine'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { filterParamSchemaSource } from './filterParamSchemaSource'
import type { CanvasNode } from '../../types/constructor'

export interface ParamDefEditorProps {
  /** The ParamDef being edited, as a self-contained node (carries its `key`). */
  param:    ParamNode
  onChange: (next: ParamNode) => void
}

export function ParamDefEditor({ param, onChange }: ParamDefEditorProps) {
  // Model the ParamDef as the Inspector's element: type = ParamDef type, props =
  // the ParamDef. `id` is stable per (type,key) so the Inspector controls keep
  // their identity across edits to the same control.
  const node: CanvasNode = {
    id:       `param-${param.type}-${param.key}`,
    type:     param.type,
    props:    param as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(param, field, next) as ParamNode)
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={filterParamSchemaSource}
    />
  )
}
