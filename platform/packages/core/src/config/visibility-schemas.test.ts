// ── visibility-schemas — every VisibilityExpr op carries an authoring surface [V4] ──
//
//  The engine-side half of Coverage Fitness #1 for VisibilityExpr ops: each op
//  (the SSOT tuple VISIBILITY_OPS) registers an authoring surface — a leaf
//  PropSchema (eq/neq/in/isset/perspective-*) or a composite marker (and/or/not). Leaf
//  schemas bind `param`/`perspective` to pick-don't-type sources. This pins the OCP
//  contract at the registration layer (the panel's coverage test pins it at the
//  surface layer); evalVisibility agreement is proven in the panel round-trip.
//
import { describe, it, expect } from 'vitest'
import {
  getVisibilitySurface, getVisibilityLeafSchema, listVisibilitySurfaces,
  isVisibilityOpAuthorable, VISIBILITY_OPS,
} from '../index'

const LEAF_OPS      = [
  'eq', 'neq', 'in', 'isset',
  'perspective-is', 'perspective-in', 'perspective-not',
] as const
const COMPOSITE_OPS = ['and', 'or', 'not'] as const

describe('visibility-schemas — VisibilityExpr authoring surfaces (V4)', () => {
  it('every VisibilityExpr op registers an authoring surface (leaf or composite)', () => {
    for (const op of VISIBILITY_OPS) {
      expect(isVisibilityOpAuthorable(op), `${op} must carry an authoring surface`).toBe(true)
    }
  })

  it('the registered set is EXACTLY the engine SSOT (no drift either way)', () => {
    expect(listVisibilitySurfaces().sort()).toEqual([...VISIBILITY_OPS].sort())
  })

  it('leaf ops carry a non-empty PropSchema; composites carry none', () => {
    for (const op of LEAF_OPS) {
      const surface = getVisibilitySurface(op)!
      expect(surface.kind, `${op} should be a leaf`).toBe('leaf')
      const schema = getVisibilityLeafSchema(op)
      expect(Array.isArray(schema)).toBe(true)
      expect(schema!.length).toBeGreaterThan(0)
    }
    for (const op of COMPOSITE_OPS) {
      expect(getVisibilitySurface(op)!.kind, `${op} should be composite`).toBe('composite')
      // A composite has NO leaf schema (its fields are child exprs).
      expect(getVisibilityLeafSchema(op)).toBeUndefined()
    }
  })

  it('param-valued leaves pick their param from the authored filters (Law 2)', () => {
    for (const op of ['eq', 'neq', 'in', 'isset'] as const) {
      const schema = getVisibilityLeafSchema(op)!
      const paramField = schema.find((f) => f.field === 'param')
      expect(paramField, `${op}.param must exist`).toBeTruthy()
      expect(paramField!.type).toBe('enum-ref')
      expect(paramField!.source).toBe('filterParams')
    }
  })

  it('eq/neq `is` is a cube.members enum-ref scoped to the chosen param', () => {
    for (const op of ['eq', 'neq'] as const) {
      const isField = getVisibilityLeafSchema(op)!.find((f) => f.field === 'is')!
      expect(isField.type).toBe('enum-ref')
      expect(isField.source).toBe('cube.members')
      expect(isField.sourceDim).toBe('param') // member list follows the sibling `param`
    }
  })

  it('perspective-* leaves pick their perspective from the registered perspectives (pick-don\'t-type)', () => {
    const isField  = getVisibilityLeafSchema('perspective-is')!.find((f) => f.field === 'perspective')!
    const notField = getVisibilityLeafSchema('perspective-not')!.find((f) => f.field === 'perspective')!
    for (const f of [isField, notField]) {
      expect(f.type).toBe('enum-ref')
      expect(f.source).toBe('perspectives') // the perspectiveRegistry-backed source
      expect(f.required).toBe(true)
    }
    const perspsField = getVisibilityLeafSchema('perspective-in')!.find((f) => f.field === 'perspectives')!
    expect(perspsField.type).toBe('array')
  })
})
