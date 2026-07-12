// ── FF-COMPOSITE-INTEGRITY (BE-5 / ADR-038 Composite arm) ───────────────────────
//
//  The stored-tree invariant behind declaration-driven composition: every child's
//  type must be in its PARENT's DECLARED accept-set (`slots.accepts`). The canvas
//  drop path already enforces this at authoring time (CanvasOverlay ':156'); this
//  gate locks it as an INVARIANT for imported / hand-authored / migrated configs
//  too (defense-in-depth). Pure projection of each element's declaration — no
//  per-type branch: the accept-set comes from `nodeRegistry.getSlots(type)`.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'

/** The union of types a parent DECLARES it accepts (across its declared slots).
 *  `null` ⇒ the parent declares no accept-restriction (a leaf, or an open container). */
function acceptedTypesOf(type: string, variant = 'default'): Set<string> | null {
  const slots = nodeRegistry.getSlots(type, variant)
  if (!slots) return null
  const accepts = new Set<string>()
  let restricted = false
  for (const slot of Object.values(slots)) {
    if (slot.accepts && slot.accepts.length > 0) {
      restricted = true
      for (const a of slot.accepts) accepts.add(a)
    }
  }
  return restricted ? accepts : null
}

interface TreeNode { type: string; variant?: string; children?: TreeNode[] }

/** Composite integrity: collect every (parent → child) where the child's type is NOT
 *  in the parent's declared accept-set. Generic — derived from each node's declaration. */
function compositeViolations(
  node: TreeNode,
  out: Array<{ parent: string; child: string }> = [],
): Array<{ parent: string; child: string }> {
  const accepts = acceptedTypesOf(node.type, node.variant)
  for (const child of node.children ?? []) {
    if (accepts && !accepts.has(child.type)) out.push({ parent: node.type, child: child.type })
    compositeViolations(child, out)
  }
  return out
}

describe('FF-COMPOSITE-INTEGRITY (BE-5 / ADR-038) — children ∈ declared slots.accepts', () => {
  beforeAll(() => { setupCanvasRegistry() })

  it('a VALID tree (children in the parent accept-set) has no violations', () => {
    // section declares accepts: chart · table · kpi-strip · columns · grid · wrap · geograph
    const tree: TreeNode = { type: 'section', children: [{ type: 'chart' }, { type: 'table' }] }
    expect(compositeViolations(tree)).toEqual([])
  })

  it('the gate BITES: a child NOT in the parent accept-set is flagged', () => {
    // page-header is a page node, never a section child
    const tree: TreeNode = { type: 'section', children: [{ type: 'page-header' }] }
    expect(compositeViolations(tree)).toContainEqual({ parent: 'section', child: 'page-header' })
  })

  it('a leaf / unrestricted parent imposes no restriction (no false positives)', () => {
    // a chart declares no children slot ⇒ acceptedTypesOf = null ⇒ nothing to violate
    const tree: TreeNode = { type: 'chart', children: [{ type: 'whatever' }] }
    expect(compositeViolations(tree)).toEqual([])
  })

  it('the invariant is DECLARATION-driven — the accept-set is a projection of getSlots, not a per-type literal', () => {
    // section's declared accept-set is read from the registry, not hardcoded here
    const accepts = acceptedTypesOf('section')
    expect(accepts).not.toBeNull()
    expect(accepts!.has('chart')).toBe(true)
    expect(accepts!.has('page-header')).toBe(false)
  })
})
