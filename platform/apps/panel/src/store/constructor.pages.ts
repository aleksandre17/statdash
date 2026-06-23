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
