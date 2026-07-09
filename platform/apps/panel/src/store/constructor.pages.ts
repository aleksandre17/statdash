// ── constructor.pages — pure page/node reducers (Layer 3) ─────────────────────
//
//  The page-layer mutations (add/update/remove page, add/update/remove/reorder
//  node) as pure (state → patch) functions, mirroring the constructor.chrome
//  split. The store factory wires thin actions over these and composes history
//  at the call site (history is a store concern, not a reducer concern). Keeping
//  these out of the store module is the one-concern-per-file split that holds the
//  store under the bloat ceiling.
//
import type { ConstructorSession } from './constructor.history'
import type { CanvasPage, CanvasNode } from '../types/constructor'

type PagesState = Pick<ConstructorSession, 'pages' | 'activePageId'>
type PagesPatch = Partial<PagesState>

export function addPagePatch(s: PagesState, page: CanvasPage): PagesPatch {
  return { pages: [...s.pages, page] }
}

/**
 * Replace the WHOLE pages collection with the server's authoritative set — the
 * boot HYDRATE path (initFromApi), never a user edit. `addPagePatch` is a blind
 * append and is correct for that: a user's "add page" action must always create
 * one more page. Hydrate is different — it is loading the SAME server-side set,
 * so it must be idempotent: loading it twice (e.g. React StrictMode's
 * double-invoked boot effect racing initFromApi) must not duplicate page ids
 * (which would render duplicate React keys in the page tablist / top-bar page
 * Select). A REPLACE, not an append, is what "authoritative load" means.
 */
export function setPagesPatch(pages: CanvasPage[]): Pick<PagesState, 'pages'> {
  return { pages }
}

export function updatePagePatch(
  s: PagesState,
  id: string,
  patch: Partial<Omit<CanvasPage, 'nodes'>>,
): PagesPatch {
  return { pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
}

export function removePagePatch(s: PagesState, id: string): PagesPatch {
  return {
    pages:        s.pages.filter((p) => p.id !== id),
    activePageId: s.activePageId === id ? null : s.activePageId,
  }
}

export function reorderPageNodesPatch(
  s: PagesState,
  pageId: string,
  orderedNodeIds: string[],
): PagesPatch {
  return {
    pages: s.pages.map((p) => (p.id === pageId ? { ...p, nodeIds: orderedNodeIds } : p)),
  }
}

export function addNodePatch(
  s: PagesState,
  pageId: string,
  node: CanvasNode,
  afterId?: string,
): PagesPatch {
  const page = s.pages.find((p) => p.id === pageId)
  if (!page) return {}
  const idx = afterId ? page.nodeIds.indexOf(afterId) + 1 : page.nodeIds.length
  const nodeIds = [...page.nodeIds.slice(0, idx), node.id, ...page.nodeIds.slice(idx)]
  return {
    pages: s.pages.map((p) =>
      p.id === pageId ? { ...p, nodeIds, nodes: { ...p.nodes, [node.id]: node } } : p,
    ),
  }
}

export function updateNodePatch(
  s: PagesState,
  pageId: string,
  nodeId: string,
  patch: Partial<CanvasNode>,
): PagesPatch {
  return {
    pages: s.pages.map((p) =>
      p.id === pageId
        ? { ...p, nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], ...patch } } }
        : p,
    ),
  }
}

export function removeNodePatch(s: PagesState, pageId: string, nodeId: string): PagesPatch {
  const page = s.pages.find((p) => p.id === pageId)
  if (!page) return {}
  const { [nodeId]: _removed, ...restNodes } = page.nodes
  return {
    pages: s.pages.map((p) =>
      p.id === pageId
        ? { ...p, nodeIds: p.nodeIds.filter((id) => id !== nodeId), nodes: restNodes }
        : p,
    ),
  }
}

// ── Hierarchy primitives — the single insert/move engine ──────────────────────
//
//  The Outline tree, the palette drop, Cmd-K and slash-insert all mutate the SAME
//  flat store through these two pure reducers. There is NO parallel tree model and
//  NO second insert path: a node lands the same way regardless of which surface
//  triggered it, so the produced config is byte-identical (the V6 invariant).
//
//  Container addressing is uniform: `parentId === pageId` targets the page's
//  ordered top-level `nodeIds`; any other `parentId` targets that node's
//  `childIds`. The caller (which has the registry's slot/accepts contract) is
//  responsible for refusing an invalid nest — these reducers are mechanical.
//

/** The ordered child-id list for a container (page root or a node), or undefined. */
function containerOrder(page: CanvasPage, parentId: string): string[] | undefined {
  if (parentId === page.id) return page.nodeIds
  return page.nodes[parentId]?.childIds
}

/** Write a container's ordered child-id list back onto the page (immutably). */
function withContainerOrder(page: CanvasPage, parentId: string, order: string[]): CanvasPage {
  if (parentId === page.id) return { ...page, nodeIds: order }
  const parent = page.nodes[parentId]
  if (!parent) return page
  return { ...page, nodes: { ...page.nodes, [parentId]: { ...parent, childIds: order } } }
}

function insertAt(order: string[], id: string, index?: number): string[] {
  const at = index == null || index < 0 || index > order.length ? order.length : index
  return [...order.slice(0, at), id, ...order.slice(at)]
}

/**
 * Insert a NEW node into a container at an index (defaults to append). Registers
 * the node in the flat map and links it under the parent. This is the unified
 * insert the palette drop / Cmd-K / slash all funnel through — replacing the
 * ad-hoc addNode-then-updateNode(childIds) re-parent dance in PageStep.
 */
export function insertNodePatch(
  s: PagesState,
  pageId: string,
  node: CanvasNode,
  parentId: string,
  index?: number,
): PagesPatch {
  const page = s.pages.find((p) => p.id === pageId)
  if (!page) return {}
  if (containerOrder(page, parentId) == null) return {}   // unknown parent → no-op
  const withNode: CanvasPage = { ...page, nodes: { ...page.nodes, [node.id]: node } }
  const order = insertAt(containerOrder(withNode, parentId)!, node.id, index)
  const next = withContainerOrder(withNode, parentId, order)
  return { pages: s.pages.map((p) => (p.id === pageId ? next : p)) }
}

/**
 * Move an EXISTING node to a (possibly new) container at an index — the Outline's
 * drag-to-reorder / drag-to-re-nest. Detaches the id from whichever container
 * currently holds it (top-level or a parent's childIds) and re-inserts it under
 * the target. The node object itself is untouched (Identity Map) — only the
 * ordering lists change, so its props/children/subtree ride along intact.
 *
 * Guards against the illegal nest of a node into itself or its own descendant
 * (which would orphan the subtree) — such a move is a no-op.
 */
export function moveNodePatch(
  s: PagesState,
  pageId: string,
  nodeId: string,
  parentId: string,
  index?: number,
): PagesPatch {
  const page = s.pages.find((p) => p.id === pageId)
  if (!page) return {}
  if (nodeId === parentId) return {}
  if (!page.nodes[nodeId]) return {}
  if (containerOrder(page, parentId) == null) return {}
  if (isDescendant(page, nodeId, parentId)) return {}     // can't nest into own subtree

  // Detach from the page top-level and from every node's childIds.
  const detachedNodeIds = page.nodeIds.filter((id) => id !== nodeId)
  const detachedNodes: Record<string, CanvasNode> = {}
  for (const [id, n] of Object.entries(page.nodes)) {
    detachedNodes[id] = n.childIds.includes(nodeId)
      ? { ...n, childIds: n.childIds.filter((c) => c !== nodeId) }
      : n
  }
  const detached: CanvasPage = { ...page, nodeIds: detachedNodeIds, nodes: detachedNodes }

  // Re-attach into the target container at the requested index.
  const order = insertAt(containerOrder(detached, parentId)!, nodeId, index)
  const next = withContainerOrder(detached, parentId, order)
  return { pages: s.pages.map((p) => (p.id === pageId ? next : p)) }
}

/** True when `maybeAncestorId` is `nodeId` itself or sits inside its subtree. */
function isDescendant(page: CanvasPage, nodeId: string, maybeDescendantId: string): boolean {
  if (nodeId === maybeDescendantId) return true
  const node = page.nodes[nodeId]
  if (!node) return false
  return node.childIds.some((childId) => isDescendant(page, childId, maybeDescendantId))
}
