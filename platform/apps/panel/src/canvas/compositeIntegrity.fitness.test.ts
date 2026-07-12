// ── FF-COMPOSITE-INTEGRITY (BE-5 / ADR-038 Composite arm) ───────────────────────
//
//  The stored-tree invariant behind declaration-driven composition: every child must
//  be ADMITTED by its PARENT's DECLARED content model. Since the composition grammar
//  moved from a frozen `slots.accepts` type list to the capability content model (HTML5
//  content-model grammar), this gate now validates against the SAME `slotAdmits`
//  predicate the drop path uses — identity (`accepts`) ∪ capability (`acceptsCaps` ∩ the
//  child's declared `caps`) — NOT a hardcoded list. The canvas drop path enforces this at
//  authoring time (CanvasOverlay); this gate locks it as an INVARIANT for imported /
//  hand-authored / migrated configs too (defense-in-depth). Pure projection of each
//  element's declaration — no per-type branch: parent slots from `getSlots`, child caps
//  from `getCaps`.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry, slotAdmits } from '@statdash/react/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'

/** Does `parentType` ADMIT `childType`, per the parent's declared content model? A parent
 *  with no slots (a leaf) or an open slot imposes no restriction. Capability-aware: reads
 *  the child's declared caps so a `flow` block is admitted by a section by DECLARATION. */
function admits(parentType: string, childType: string, variant = 'default'): boolean {
  const slots = nodeRegistry.getSlots(parentType, variant)
  if (!slots) return true                                  // leaf / no slots → no restriction
  const defs = Object.values(slots)
  if (defs.length === 0) return true
  const childCaps = nodeRegistry.getCaps(childType)
  return defs.some((slot) => slotAdmits(slot, { type: childType, caps: childCaps }))
}

interface TreeNode { type: string; variant?: string; children?: TreeNode[] }

/** Composite integrity: collect every (parent → child) where the child is NOT admitted by
 *  the parent's declared content model. Generic — derived from each node's declaration. */
function compositeViolations(
  node: TreeNode,
  out: Array<{ parent: string; child: string }> = [],
): Array<{ parent: string; child: string }> {
  for (const child of node.children ?? []) {
    if (!admits(node.type, child.type, node.variant)) out.push({ parent: node.type, child: child.type })
    compositeViolations(child, out)
  }
  return out
}

describe('FF-COMPOSITE-INTEGRITY (BE-5 / ADR-038) — children ∈ the parent DECLARED content model', () => {
  beforeAll(() => { setupCanvasRegistry() })

  it('a VALID tree (children admitted by the parent content model) has no violations', () => {
    // section admits any `flow` block — chart · table are flow content.
    const tree: TreeNode = { type: 'section', children: [{ type: 'chart' }, { type: 'table' }] }
    expect(compositeViolations(tree)).toEqual([])
  })

  it('formerly-homeless content blocks are now VALID section children (capability grammar)', () => {
    // hero/text/links/card/divider/spacer/stack all declare `flow` → admitted by declaration.
    const tree: TreeNode = {
      type: 'section',
      children: [
        { type: 'hero' }, { type: 'text' }, { type: 'links' }, { type: 'card' },
        { type: 'divider' }, { type: 'spacer' }, { type: 'stack' },
      ],
    }
    expect(compositeViolations(tree)).toEqual([])
  })

  it('the gate BITES: a child NOT admitted by the parent content model is flagged', () => {
    // page-header is page-level structure — it does NOT declare `flow`, so a section rejects it.
    const tree: TreeNode = { type: 'section', children: [{ type: 'page-header' }] }
    expect(compositeViolations(tree)).toContainEqual({ parent: 'section', child: 'page-header' })
  })

  it('a leaf / unrestricted parent imposes no restriction (no false positives)', () => {
    // a chart declares no children slot ⇒ no content model ⇒ nothing to violate
    const tree: TreeNode = { type: 'chart', children: [{ type: 'whatever' }] }
    expect(compositeViolations(tree)).toEqual([])
  })

  it('the invariant is DECLARATION-driven — admission is a projection of getSlots + getCaps, not a per-type literal', () => {
    // section's content model (acceptsCaps:['flow']) is read from the registry; a child's
    // membership is decided by ITS declared caps, never a literal type list here.
    expect(admits('section', 'chart')).toBe(true)         // chart declares `flow`
    expect(admits('section', 'hero')).toBe(true)          // hero declares `flow`
    expect(admits('section', 'page-header')).toBe(false)  // page-header does not
  })
})
