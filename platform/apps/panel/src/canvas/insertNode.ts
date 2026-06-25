// ── insertNode — the single, byte-identical node-insert path (V6) ─────────────
//
//  Every insert surface funnels through here: the palette drop (CanvasOverlay),
//  the Cmd-K command palette, the slash-insert, and the Outline's "+" affordance.
//  Because they all build the node the SAME way and write it through the SAME
//  store reducer, an insert via Cmd-K produces a CanvasNode byte-identical to an
//  insert via the palette — the V6 invariant the fitness test asserts.
//
//  Two pure pieces + one orchestrator:
//    makeNode(type, id)        build the CanvasNode (id + registry defaults + no children)
//    slotAccepts(parent, type) the registry's accepts contract for a nest
//    resolveInsertParent(...)   where a type may land given the current selection
//  The component layer supplies the id factory and the store action; this module
//  owns the "what shape + where" decision so it cannot drift between surfaces.
//
import { nodeRegistry } from '@statdash/react/engine'
import type { CanvasNode, CanvasPage } from '../types/constructor'

/**
 * Build a fresh CanvasNode for `type`, seeding props from the slice registry's
 * defaults (open registry — a newly-registered type is insertable the moment it
 * is registered). Byte-identical to the node the palette drop has always built.
 */
export function makeNode(type: string, id: string, variant?: string): CanvasNode {
  const props = { ...(nodeRegistry.getDefaults(type, variant) ?? {}) }
  return {
    id,
    type,
    ...(variant && variant !== 'default' ? { variant } : {}),
    props,
    childIds: [],
  }
}

/**
 * Whether `childType` may be nested under `parentType` per the registry's slot
 * `accepts` contract. The page root (no parentType) and slot-less / open-accepts
 * containers accept anything (graceful default — the same rule CanvasOverlay's
 * drop uses). The single SSOT for "is this nest legal", shared by the Outline
 * drag and the palette drop so they cannot diverge.
 */
export function nestAccepts(parentType: string | undefined, childType: string): boolean {
  if (!parentType) return true                       // page root accepts any top-level node
  const slots = nodeRegistry.getSlots(parentType)
  if (!slots) return true                            // leaf/undeclared container → permissive
  const defs = Object.values(slots)
  if (defs.length === 0) return true
  // Accept if ANY slot accepts the type (a node has at most one children list in
  // the flat model; the union of slot accepts is the effective contract).
  return defs.some((slot) => !slot.accepts || slot.accepts.length === 0 || slot.accepts.includes(childType))
}

/**
 * Decide the container a newly-inserted `type` should land in, given the current
 * selection. Mirrors document-editor insert ergonomics (Notion/Gutenberg insert
 * "near the cursor"):
 *   - no selection            → page top-level
 *   - selected node is a legal container for the type → inside it
 *   - otherwise               → page top-level (sibling of the selection's branch)
 * Returns the parentId to insert under (pageId for top-level).
 */
export function resolveInsertParent(
  page: CanvasPage,
  selectedId: string | null | undefined,
  type: string,
): string {
  if (!selectedId) return page.id
  const selected = page.nodes[selectedId]
  if (!selected) return page.id
  return nestAccepts(selected.type, type) ? selected.id : page.id
}
