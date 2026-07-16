// ── visibilityFactory — seed a fresh VisibilityExpr of a chosen op [V4] ────────
//
//  Adding a condition needs a minimal, VALID seed of the chosen op — the
//  VisibilityExpr analogue of makeParamNode for ParamDefs / nodeRegistry.getDefaults
//  for canvas nodes. Each seed carries only the structural scaffolding the op's
//  schema/builder expects (the discriminant + empty/zeroed fields); the author
//  fills the rest through the Inspector (leaves) or by adding children (composites).
//  Kept pure + data-only (Law 2: the seed is JSON-serializable, Constructor-ready).
//
//  OCP: a NEW op that wants a richer seed adds a case here; an unlisted op falls
//  back to a bare `{ op }` (still authorable — the Inspector / builder fills it in).
//
import type { VisibilityExpr } from '@statdash/engine'

/** The selectable VisibilityExpr ops, grouped for the builder's pickers. */
export const VISIBILITY_LEAF_OPS = [
  'eq', 'neq', 'in', 'isset', 'count-gt',
  'perspective-is', 'perspective-in', 'perspective-not',
] as const
export const VISIBILITY_COMPOSITE_OPS = ['and', 'or', 'not'] as const

export type VisibilityOpId = VisibilityExpr['op']

/** True if the op is a composite combinator (renders a child sub-tree, not a form). */
export function isComposite(op: string): op is 'and' | 'or' | 'not' {
  return op === 'and' || op === 'or' || op === 'not'
}

/**
 * Seed a fresh VisibilityExpr of `op`. Minimal structural fields are present so
 * evalVisibility and the editor have something coherent to work with; the author
 * completes the condition via the Inspector (leaf) or by adding children (group).
 */
export function makeVisibilityExpr(op: VisibilityOpId): VisibilityExpr {
  switch (op) {
    case 'eq':       return { op: 'eq',  param: '', is: null }
    case 'neq':      return { op: 'neq', param: '', is: null }
    case 'in':       return { op: 'in',  param: '', values: [] }
    case 'isset':    return { op: 'isset', param: '' }
    // n:1 seeds the common "more than one selected" condition (author-adjustable).
    case 'count-gt': return { op: 'count-gt', param: '', n: 1 }
    case 'perspective-is':  return { op: 'perspective-is',  perspective: '' }
    case 'perspective-not': return { op: 'perspective-not', perspective: '' }
    case 'perspective-in':  return { op: 'perspective-in',  perspectives: [] }
    case 'and':      return { op: 'and', exprs: [] }
    case 'or':       return { op: 'or',  exprs: [] }
    case 'not':      return { op: 'not', expr: { op: 'isset', param: '' } }
  }
}
