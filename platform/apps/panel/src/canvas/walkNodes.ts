// ── walkNodes — flat enumeration of every node in a NodePageConfig tree ────
//
//  Mirrors the engine's collectChildNodes (targets/nodeWalk): a child is any
//  plain object (or array item) with a string `type`, excluding data-carrying
//  keys. Reimplemented here because the engine walker is not exported from the
//  public @statdash/react surface. Pure + side-effect-free → unit-testable and
//  safe to share between the overlay component and its tests.
//
import type { NodeBase } from '@statdash/react/engine'

const DATA_KEYS = new Set([
  'data', 'transforms', 'fieldConfig', 'dataLinks', 'vars', 'view',
  'filterSchema', 'modeOrder', 'computed', 'crossValidate', 'context', 'store',
])

export function isNodeObject(val: unknown): val is NodeBase {
  return (
    val != null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    typeof (val as Record<string, unknown>)['type'] === 'string'
  )
}

export interface WalkedNode {
  node:    NodeBase
  type:    string
  variant: string
}

/** Depth-first flatten of every node carrying a `type`, in document order. */
export function walkNodes(root: NodeBase): WalkedNode[] {
  const out: WalkedNode[] = []
  const visit = (node: NodeBase) => {
    out.push({
      node,
      type:    node.type,
      variant: (node as { variant?: string }).variant ?? 'default',
    })
    for (const key of Object.keys(node)) {
      if (DATA_KEYS.has(key)) continue
      const val = (node as unknown as Record<string, unknown>)[key]
      if (Array.isArray(val)) val.forEach((v) => { if (isNodeObject(v)) visit(v) })
      else if (isNodeObject(val)) visit(val)
    }
  }
  visit(root)
  return out
}
