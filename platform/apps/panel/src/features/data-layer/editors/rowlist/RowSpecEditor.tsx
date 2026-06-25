// ── RowSpecEditor — schema-driven authoring of ONE RowSpec [V2] ────────────────
//
//  Renders ONE RowSpec (an entry of a `row-list` DataSpec) through the SAME generic
//  Inspector that authors node / panel / chrome / transform-step / ParamDef
//  properties — driven by the RowSpec PropSchema (carried in the engine rowspec-
//  schema registry, resolved via rowSpecSchemaSource). NO bespoke per-field form,
//  NO second form engine (the ADR mandate / OCP). Mirrors ParamDefEditor /
//  TransformStepEditor EXACTLY, one rung down: a row entry instead of a control.
//
//  The RowSpec is modeled as a CanvasNode: `{ type: 'row-spec', props: rowSpec }`.
//  The Inspector reads each PropField off `props` (= the RowSpec) and emits a
//  dot-path write; we apply it immutably with setAtPath and hand the next RowSpec
//  up. RowSpec has no discriminant, so nothing in the schema needs protecting.
//
//  The `code` and `pctOf` fields resolve their options from the active dataset's
//  cube profile (EnumRefField + useActiveProfile) — the author PICKS a real
//  measure, never types a raw code (Law 2 declarative authoring).
//
import type { RowSpec } from '@statdash/engine'
import { ROW_SPEC_KEY } from '@statdash/engine'
import { Inspector } from '../../../../inspector'
import { setAtPath } from '../../../../inspector/showWhen'
import { rowSpecSchemaSource } from './rowSpecSchemaSource'
import type { CanvasNode } from '../../../../types/constructor'

export interface RowSpecEditorProps {
  /** Stable id segment so the Inspector controls keep identity across edits. */
  uid:      string
  row:      RowSpec
  onChange: (next: RowSpec) => void
}

export function RowSpecEditor({ uid, row, onChange }: RowSpecEditorProps) {
  const node: CanvasNode = {
    id:       `rowspec-${uid}`,
    type:     ROW_SPEC_KEY,
    props:    row as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(row, field, next))
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={rowSpecSchemaSource}
    />
  )
}
