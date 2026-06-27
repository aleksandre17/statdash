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
//  Beyond the type's scalar schema, a control carries a cross-cutting `visibleWhen`
//  VisibilityExpr — the SAME node-style gate (same `perspective-is` canon) the
//  filter-bar shell reads to show/hide a control per the active perspective (P5.1):
//  e.g. a year-selector shown only in the `year` perspective. It is NOT in any param
//  type's PropSchema (it is cross-cutting, like a node's `view.visibleWhen`), so it is
//  authored here through the SAME recursive VisibilityBuilder the node "show when" uses
//  (VisibilitySection) — surfacing the filter-item perspective-scoping in the inspector.
//
import { Box, Divider } from '@mui/material'
import type { ParamNode, VisibilityExpr } from '@statdash/engine'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { VisibilitySection } from '../visibility'
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

  // The control's `visibleWhen` gate (perspective-scoping). A null `next` CLEARS the
  // key (always shown) so an unedited control never grows `visibleWhen: undefined`
  // (additive + lossless — the filter round-trip stays byte-identical). A non-null
  // `next` writes the VisibilityExpr tree the filter-bar shell reads per perspective.
  const setVisibleWhen = (next: VisibilityExpr | undefined) => {
    if (next == null) {
      const { visibleWhen: _drop, ...rest } = param as ParamNode & { visibleWhen?: VisibilityExpr }
      onChange(rest as ParamNode)
    } else {
      onChange({ ...param, visibleWhen: next } as ParamNode)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Inspector
        node={node}
        onChange={handleChange}
        schemaSource={filterParamSchemaSource}
      />
      <Divider />
      {/* Filter-item perspective-scoping — the SAME node "show when" builder (P5.1). */}
      <VisibilitySection
        value={(param as ParamNode & { visibleWhen?: VisibilityExpr }).visibleWhen}
        onChange={setVisibleWhen}
      />
    </Box>
  )
}
