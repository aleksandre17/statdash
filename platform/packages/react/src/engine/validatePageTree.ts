// ── validatePageTree — static tree validation [N10, N11] ──────────────
//
//  Walks a NodeBase tree and calls each registered slice's validate hook.
//  Returns a flat list of TreeValidationError — one entry per failed field.
//
//  Architecture note: lives in @statdash/react (not @statdash/engine) because
//  it must call nodeRegistry, which imports React-layer registrations.
//  The engine cannot import React-layer modules (dependency arrow).
//
//  Usage (Constructor, page-load gate):
//    const errors = validatePageTree(page)
//    if (errors.some(e => e.level === 'error')) { ... }
//
//  Called automatically by NodePageRenderer on each render via renderNode
//  step-1 validation. Use validatePageTree for eager pre-render gates
//  (Constructor save, batch import, schema-migration checks).
//
//  Traversal mirrors renderNode's child-expansion logic:
//    node.children ?? node.items  — primary child slot
//    SlotDef fields               — named slots (Builder.io multi-slot pattern)
//

import type { NodeBase }    from './types'
import type { ValidationError } from './slice-meta'
import { nodeRegistry }     from './register-all'

// ── TreeValidationError ───────────────────────────────────────────────

/** A validation error enriched with its location in the page tree. */
export interface TreeValidationError extends ValidationError {
  /** JSONPath to the failing node — e.g. `"children[2].children[0]"` */
  nodePath: string
  /** `type` of the failing node — e.g. `"section"`, `"chart"` */
  nodeType: string
  /** `id` of the failing node, if present */
  nodeId?:  string
}

// ── validatePageTree ──────────────────────────────────────────────────

/**
 * Validate an entire page tree against each slice's registered validate hook.
 *
 * Returns ALL errors across ALL nodes in depth-first order.
 * Empty array → tree is valid (no error-level errors; warnings may still be present).
 *
 * @param root - The root NodeBase (typically a NodePageConfig cast to NodeBase).
 * @returns Flat array of TreeValidationError across the whole tree.
 */
export function validatePageTree(root: NodeBase): TreeValidationError[] {
  const results: TreeValidationError[] = []
  walkNode(root, '', results)
  return results
}

// ── Internal traversal ────────────────────────────────────────────────

type U = NodeBase & Record<string, unknown>

function walkNode(
  node:    NodeBase,
  path:    string,
  out:     TreeValidationError[],
): void {
  const type    = node.type
  const variant = (node as U)['variant'] as string | undefined ?? 'default'

  // Call slice's validate hook (same hook renderNode calls in step 1)
  const validateFn = nodeRegistry.getValidate(type, variant)
  if (validateFn) {
    const errors = validateFn(node as import('./types').NodeDef)
    if (errors?.length) {
      for (const e of errors) {
        out.push({
          ...e,
          nodePath: path || '<root>',
          nodeType: type,
          nodeId:   (node as U)['id'] as string | undefined,
        })
      }
    }
  }

  // ── Recurse into primary child slot (children ?? items) ───────────────
  const primary: NodeBase[] = (node as U)['children'] as NodeBase[] | undefined
    ?? (node as U)['items'] as NodeBase[] | undefined
    ?? []

  primary.forEach((child, i) => {
    const childId  = (child as U)['id'] as string | undefined
    const childSeg = childId ? `children[${i}](${childId})` : `children[${i}]`
    walkNode(child, path ? `${path}.${childSeg}` : childSeg, out)
  })

  // ── Recurse into named slots (SlotDef-driven) ─────────────────────────
  const slotDefs = nodeRegistry.getSlots(type, variant)
  if (slotDefs) {
    for (const [slotName, slotDef] of Object.entries(slotDefs)) {
      const slotRaw  = (node as U)[slotDef.field]
      const slotItems: NodeBase[] = Array.isArray(slotRaw)
        ? slotRaw as NodeBase[]
        : slotRaw ? [slotRaw as NodeBase] : []

      slotItems.forEach((child, i) => {
        const childId  = (child as U)['id'] as string | undefined
        const childSeg = childId
          ? `${slotName}[${i}](${childId})`
          : `${slotName}[${i}]`
        walkNode(child, path ? `${path}.${childSeg}` : childSeg, out)
      })
    }
  }
}
