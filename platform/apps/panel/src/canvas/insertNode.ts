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
//    nestAccepts(parent, type) the registry's accepts contract for a nest
//    resolveInsertPlan(...)     HOW a type lands given the current selection —
//                              direct nest, auto-wrap into a container, or a
//                              guided hint (never a hidden no-op / invalid tree)
//  The component layer supplies the id factory and the store action; this module
//  owns the "what shape + where" decision so it cannot drift between surfaces.
//
import { nodeRegistry } from '@statdash/react/engine'
import type { CanvasNode, CanvasPage } from '../types/constructor'

/**
 * The canonical page-level content container an auto-wrap creates. When a type is
 * not directly page-acceptable, the insert wraps it in a `section` (page → section
 * → type) — the document-editor "insert anything, the tool builds the structure"
 * rule (Notion/Gutenberg). The wrap is only offered when the registry contracts
 * actually permit it (nestAccepts guards below), so this constant names the
 * PREFERENCE, never bypasses the accept contract.
 */
export const AUTOWRAP_CONTAINER = 'section'

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
 * Whether `parentType` is a NODE-TREE drop target at all — the leaf/container
 * discriminant (D-M4.1-A). Reads the already-declared `canHaveChildren` meta: the
 * page root (no parentType) is always a top-level target; a registered node is a
 * target ONLY when its meta pins `canHaveChildren === true`. A LEAF (chart, kpi,
 * hero, filter-bar — `canHaveChildren` false/absent) accepts NO child node, even
 * if it happens to declare an empty `slots` object (hero: `slots:{}`).
 */
export function isDropTarget(parentType: string | undefined): boolean {
  if (!parentType) return true                       // page root — top-level target
  return nodeRegistry.getMeta(parentType)?.canHaveChildren === true
}

/**
 * Whether `childType` may be nested under `parentType`. Two questions, both from
 * already-declared meta (D-M4.1-A — no new field, no packages change):
 *   1. Is the parent a drop target at all?  → `canHaveChildren === true` (isDropTarget)
 *   2. Which child types may it hold?        → `slots.accepts` (empty ⇒ any)
 *
 * Previously step 1 was skipped — a slot-less parent returned `true`, conflating
 * "leaf (accepts nothing)" with "open container (accepts anything)" and causing
 * the insert resolver to silently redirect an incompatible insert to page top.
 * Gating on `canHaveChildren` FIRST fixes that silent-fail at the root: a leaf is
 * never a nest target, so the palette never offers (and the router never redirects)
 * an incompatible tile. The single SSOT shared by the Outline drag, the palette
 * drop, the ⌘K insert, and the context-aware palette filter (M4.1 Thread A).
 */
export function nestAccepts(parentType: string | undefined, childType: string): boolean {
  if (!parentType) return true                       // page root accepts any top-level node
  if (!isDropTarget(parentType)) return false        // a leaf accepts no child node
  const slots = nodeRegistry.getSlots(parentType)
  if (!slots) return true                            // open container (no explicit slots) → any
  const defs = Object.values(slots)
  if (defs.length === 0) return true
  // Accept if ANY slot accepts the type (a node has at most one children list in
  // the flat model; the union of slot accepts is the effective contract).
  return defs.some((slot) => !slot.accepts || slot.accepts.length === 0 || slot.accepts.includes(childType))
}

/**
 * Whether — and HOW — `type` can be placed at the PAGE ROOT (nothing selected), the
 * palette's honest insertion context for a blank page (SPEC S2 / §3.3). The page-root
 * palette must offer exactly `page-accepts ∪ canonical-wrap-reachable`, DECLARED from
 * the slot `accepts` contracts (never hardcoded to `section`):
 *   'direct' — the page's own root slots accept the type (section / repeat / …);
 *   'wrap'   — the page accepts the canonical container AND that container accepts the
 *              type (page → section → type, the auto-wrap `resolveInsertPlan` applies);
 *   'blocked'— neither: the type has no single-step home at the page root (a homeless
 *              content block), so the palette honestly omits it (it is reachable once a
 *              container is added — guidance-by-affordance, never a bouncing tile).
 * Pure over TYPES (no page tree), so the palette can classify every registry entry.
 * An absent `pageType` degrades to the permissive page-root (`nestAccepts(undefined)`),
 * preserving isolated-mount behaviour.
 */
export function pageRootInsertability(
  pageType: string | undefined,
  type: string,
): 'direct' | 'wrap' | 'blocked' {
  if (nestAccepts(pageType, type)) return 'direct'
  if (nestAccepts(pageType, AUTOWRAP_CONTAINER) && nestAccepts(AUTOWRAP_CONTAINER, type)) return 'wrap'
  return 'blocked'
}

/**
 * How a newly-inserted `type` lands given the current selection (FF-INSERT-NEVER-
 * CLIFF). A discriminated union so the illegal "insert into a parent that rejects
 * it" state is unrepresentable — every plan is a VALID placement or an explicit
 * guided hint, never a hidden no-op and never an invalid tree:
 *
 *   'direct'  — nest straight into `parentId` (a selected container that accepts
 *               the type, OR the page frame when it directly accepts the type).
 *   'wrap'    — the page does not directly accept the type, but the canonical
 *               container `wrapperType` (which the page DOES accept) accepts it:
 *               create the wrapper under `parentId`, nest the type inside it, in
 *               one undoable action (page → section → type).
 *   'blocked' — no single unambiguous wrapper makes the insert valid (a deeper /
 *               ambiguous structure would be needed); surface a guided hint rather
 *               than invent an ambiguous tree.
 */
export type InsertPlan =
  | { kind: 'direct';  parentId: string }
  | { kind: 'wrap';    wrapperType: string; parentId: string }
  | { kind: 'blocked'; reason: 'no-single-wrapper' }

/** One resolved insert operation — a built node and the container it lands under. */
export interface InsertOp {
  node:     CanvasNode
  parentId: string
}

/**
 * Resolve the insert plan for `type` given the current selection. Mirrors document-
 * editor ergonomics (Notion/Gutenberg "insert anything; the tool builds the needed
 * structure"), reconciled with the Wave-1 contextual filter:
 *   1. a selected CONTAINER that accepts the type → nest directly inside it;
 *   2. else the page frame directly accepts the type → page top-level;
 *   3. else the canonical wrapper (`section`) both fits the page AND accepts the
 *      type → auto-wrap (page → section → type);
 *   4. else → a guided hint (blocked), never an invalid tree or silent no-op.
 *
 * Every branch is registry-validated via `nestAccepts`, so a contract change (a
 * slot widening/narrowing its `accepts`) automatically reshapes the plan — no
 * hardcoded per-type placement list.
 */
export function resolveInsertPlan(
  page: CanvasPage,
  selectedId: string | null | undefined,
  type: string,
): InsertPlan {
  // 1. A selected container that can legally hold the type → nest directly.
  if (selectedId) {
    const selected = page.nodes[selectedId]
    if (selected && nestAccepts(selected.type, type)) {
      return { kind: 'direct', parentId: selected.id }
    }
  }
  // 2. Page/frame level: the page's OWN root kind directly accepts the type →
  //    top-level insert. Read per-page (`page.type`), never a privileged literal:
  //    a landing/tab/container page root accepts what THAT root's slots accept.
  if (nestAccepts(page.type, type)) {
    return { kind: 'direct', parentId: page.id }
  }
  // 3. Auto-wrap into the canonical container the page accepts AND that accepts
  //    the type (page → section → type), one undoable action.
  if (
    nestAccepts(page.type, AUTOWRAP_CONTAINER) &&
    nestAccepts(AUTOWRAP_CONTAINER, type)
  ) {
    return { kind: 'wrap', wrapperType: AUTOWRAP_CONTAINER, parentId: page.id }
  }
  // 4. No single unambiguous wrapper makes it valid → guided hint.
  return { kind: 'blocked', reason: 'no-single-wrapper' }
}

/**
 * Compile an insert plan into the ordered node-insert operations a surface applies
 * through the store's batched `insertNodes` (ONE history entry). The id factory is
 * called once per created node IN ORDER, so two surfaces that share the same
 * factory sequence produce byte-identical results — the V6 invariant, now covering
 * the auto-wrap (a ⌘K wrap == a palette wrap). A 'blocked' plan compiles to no ops
 * (the caller surfaces the guided hint instead).
 */
export function planInserts(
  plan: InsertPlan,
  type: string,
  makeId: () => string,
  variant?: string,
): InsertOp[] {
  if (plan.kind === 'blocked') return []
  if (plan.kind === 'direct') {
    return [{ node: makeNode(type, makeId(), variant), parentId: plan.parentId }]
  }
  // wrap: build the wrapper first (its id is the child's parent), then the child.
  const wrapper = makeNode(plan.wrapperType, makeId())
  const child   = makeNode(type, makeId(), variant)
  return [
    { node: wrapper, parentId: plan.parentId },
    { node: child,   parentId: wrapper.id },
  ]
}
