// ── VisibilityLeafEditor — schema-driven VisibilityExpr leaf authoring [V4] ────
//
//  Renders ONE atomic VisibilityExpr condition (eq / neq / in / isset / mode-*)
//  through the SAME generic Inspector that authors node / panel / chrome /
//  transform-step / ParamDef properties — driven by the op's PropSchema (carried
//  in the engine visibility registry, resolved via visibilityLeafSchemaSource).
//  NO bespoke per-op form, NO second form engine (the ADR mandate / OCP).
//
//  The leaf is modeled as a CanvasNode: `{ type: leaf.op, props: leaf }`. The
//  Inspector reads each PropField off `props` (= the leaf, incl. its `op`) and
//  emits a dot-path write; we apply it immutably with setAtPath and hand the next
//  leaf up. `op` is never in any schema, so the discriminant is carried through
//  untouched (exactly the ParamDefEditor / TransformStepEditor guarantee).
//
//  `param` binds to the active page's authored ParamDefs (filterParams source);
//  `is`/`values` scope to that param's dimension members (cube.members); `mode(s)`
//  pick from the registered modes — the author PICKS, never types a raw code (Law 2).
//
import type { VisibilityExpr } from '@statdash/engine'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { visibilityLeafSchemaSource } from './visibilityLeafSchemaSource'
import type { CanvasNode } from '../../types/constructor'

/** A leaf VisibilityExpr (never a composite — those go through VisibilityBuilder). */
export type VisibilityLeaf = Exclude<VisibilityExpr, { op: 'and' } | { op: 'or' } | { op: 'not' }>

export interface VisibilityLeafEditorProps {
  /** Stable id segment so the Inspector controls keep identity across edits. */
  path:     string
  /** The leaf condition being edited (carries its `op`). */
  leaf:     VisibilityLeaf
  onChange: (next: VisibilityLeaf) => void
}

export function VisibilityLeafEditor({ path, leaf, onChange }: VisibilityLeafEditorProps) {
  // Model the leaf as the Inspector's element: type = the op, props = the leaf.
  const node: CanvasNode = {
    id:      `vis-${path}-${leaf.op}`,
    type:    leaf.op,
    props:   leaf as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(leaf, field, next) as VisibilityLeaf)
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={visibilityLeafSchemaSource}
    />
  )
}
