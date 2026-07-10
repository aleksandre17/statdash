// ── FF-OVERFLOW-DETERMINISTIC (I) — the nested subject's container is DERIVED ────
//
//  Proves the SL-4 escalation INPUT is a pure, deterministic function of the
//  subject's schema — never a per-type literal. A schema is translated to the
//  Placement Law's abstract SubjectShape, and the container it lands in is exactly
//  `resolveSurface('nested-item', deriveWeight(shape))`. So a workspace-weight subject
//  (a rich-type item, a deep tree) ALWAYS resolves to `'focus-view'` (escalate out),
//  and a form-weight one stays a dock container — the same law, no editor branch.
//
import { describe, it, expect } from 'vitest'
import type { PropSchema } from '@statdash/react/engine'
import {
  schemaSubjectShape, fieldSubjectShape, nestedItemContainer, shouldEscalate,
} from './nestedItemPlacement'
import { resolveSurface, deriveWeight } from '../../studio/placement'

// ── Representative subject schemas (one per band) ──────────────────────────────
const FLAT: PropSchema = [
  { field: 'label', type: 'string', label: 'Label' },
  { field: 'value', type: 'number', label: 'Value' },
]
const GROUPED: PropSchema = Array.from({ length: 6 }, (_, i) => ({
  field: `f${i}`, type: 'string' as const, label: `F${i}`,
}))
const NESTED: PropSchema = [
  { field: 'label', type: 'string', label: 'Label' },
  { field: 'kids', type: 'array', label: 'Kids', itemSchema: [{ field: 'x', type: 'string', label: 'X' }] },
]
// A WORKSPACE subject: a rich-type field (a whole DataSpec sub-document) dominates —
// this is the representative fixture for the first real escalation (SL-5 wires the real
// filters-pipeline / chart-encoding metas; today's authored metas are all form-weight).
const RICH: PropSchema = [
  { field: 'label', type: 'string', label: 'Series' },
  { field: 'query', type: 'DataSpec', label: 'Query' },
]

describe('FF-OVERFLOW-DETERMINISTIC — schema → abstract SubjectShape (pure)', () => {
  it('counts flat scalars; marks nesting; marks a rich type; measures depth', () => {
    expect(schemaSubjectShape(FLAT)).toEqual({ flatFields: 2, hasNested: false, depth: 0, hasRichType: false })
    expect(schemaSubjectShape(GROUPED).flatFields).toBe(6)
    expect(schemaSubjectShape(NESTED)).toMatchObject({ hasNested: true, depth: 1 })
    expect(schemaSubjectShape(RICH)).toMatchObject({ hasRichType: true })
  })

  it('an OPAQUE array/object (no itemSchema) counts as one flat control, not nesting', () => {
    const opaque: PropSchema = [{ field: 'blob', type: 'object', label: 'Blob' }]
    expect(schemaSubjectShape(opaque)).toMatchObject({ flatFields: 1, hasNested: false })
  })

  it('fieldSubjectShape reads the field.itemSchema (the drilled-into subject)', () => {
    const field = { field: 'series', type: 'array' as const, label: 'Series', itemSchema: RICH }
    expect(fieldSubjectShape(field)).toEqual(schemaSubjectShape(RICH))
  })
})

describe('FF-OVERFLOW-DETERMINISTIC — the container is exactly the law verdict', () => {
  it('nestedItemContainer(s) === resolveSurface(nested-item, deriveWeight(shape(s)))', () => {
    for (const s of [FLAT, GROUPED, NESTED, RICH]) {
      expect(nestedItemContainer(s)).toBe(
        resolveSurface('nested-item', deriveWeight(schemaSubjectShape(s))),
      )
    }
  })

  it('form-weight subjects stay a DOCK container (inline/dock-drill) — no escalation', () => {
    expect(nestedItemContainer(FLAT)).toBe('inline')
    expect(nestedItemContainer(GROUPED)).toBe('dock-drill')
    expect(nestedItemContainer(NESTED)).toBe('dock-drill')
    for (const s of [FLAT, GROUPED, NESTED]) expect(shouldEscalate(s)).toBe(false)
  })

  it('FF-NO-CRAMMED-DOCK — a WORKSPACE subject resolves to focus-view, never a dock', () => {
    const c = nestedItemContainer(RICH)
    expect(c).toBe('focus-view')
    expect(shouldEscalate(RICH)).toBe(true)
    // It is never any dock container — cramming is unrepresentable.
    expect(c).not.toBe('dock-panel')
    expect(c).not.toBe('dock-drill')
    expect(c).not.toBe('inline')
  })

  it('a deep subject (structure past the drill budget) is also workspace-weight', () => {
    // Build a chain deeper than the drill budget (8): its own depth alone is oversize.
    let schema: PropSchema = [{ field: 'leaf', type: 'string', label: 'Leaf' }]
    for (let i = 0; i < 10; i++) schema = [{ field: `l${i}`, type: 'object', label: `L${i}`, itemSchema: schema }]
    expect(shouldEscalate(schema)).toBe(true)
  })
})
