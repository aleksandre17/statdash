// ── canvasPageAdapter — CanvasPage (store model) ⇄ NodePageConfig (engine) ──
//
//  Single source of truth: the Constructor store holds a flat CanvasPage
//  (nodes keyed by id + ordered nodeIds). The engine renderer consumes a
//  NodePageConfig tree. This pure adapter is the lossless projection between
//  the two — the canvas renders `toNodePageConfig(page)`, never a hand-kept
//  second copy of the tree.
//
//  Why a flat store + a tree projection (not a tree store)?
//    - O(1) node lookup / patch by id (store.updateNode) — Identity Map pattern.
//    - The drag-and-drop overlay addresses nodes by id, not by tree path.
//    - The engine still receives the exact tree shape it validates and renders.
//
//  Two directions (the round-trip the ADR's fitness function asserts):
//    toNodePageConfig(page)   flat store  → engine NodeDef tree   (save / render)
//    fromNodePageConfig(cfg)  engine tree → flat store CanvasPage (load)
//  Invariant:  fromNodePageConfig(toNodePageConfig(x)) ≡ x   (lossless).
//
//  Constructor-ready: output is pure JSON (no functions), so the same shape
//  serializes to the config API in Phase 2.
//
import type { NodePageConfig, NodeBase } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode }   from '../types/constructor'

/** Engine node shape after projection — a NodeBase with recursively-built children. */
type EngineNode = NodeBase & { children?: EngineNode[] }

// ── Reserved structural keys ────────────────────────────────────────────────
//
//  Keys the engine node carries that are NOT free-form props: they are the
//  structural identity of the node (type/variant/id) or its children list.
//  fromNodePageConfig peels these off; everything else is the `props` body.
//
const STRUCTURAL_KEYS = new Set(['type', 'variant', 'id', 'children'])

// ── Serialize side: flat store → engine NodeDef tree ────────────────────────

/**
 * Project one CanvasNode into its engine node shape.
 * `type`/`variant` are stamped, `props` is spread as the node body, `children`
 * resolved recursively against the page's flat node map (skipping dangling ids).
 */
function toEngineNode(node: CanvasNode, page: CanvasPage): EngineNode {
  const children = node.childIds
    .map((childId) => page.nodes[childId])
    .filter((n): n is CanvasNode => n != null)
    .map((child) => toEngineNode(child, page))

  return {
    ...node.props,
    type: node.type,
    ...(node.variant ? { variant: node.variant } : {}),
    id:   node.id,
    ...(children.length > 0 ? { children } : {}),
  }
}

/**
 * Project a CanvasPage into a NodePageConfig the engine can render.
 *
 * The page IS the root node (engine convention — no `root` wrapper). We wrap
 * the ordered top-level nodes in an `inner-page` root so NodePageRenderer's
 * navigation/filter wiring resolves. PageConfigBase fields (id, path, color)
 * come from the CanvasPage identity.
 */
export function toNodePageConfig(page: CanvasPage): NodePageConfig {
  const children = page.nodeIds
    .map((id) => page.nodes[id])
    .filter((n): n is CanvasNode => n != null)
    .map((node) => toEngineNode(node, page))

  return {
    type:     'inner-page',
    id:       page.id,
    path:     page.slug,
    children,
  } as unknown as NodePageConfig
}

// ── Load side: engine NodeDef tree → flat store CanvasPage ───────────────────

/** Strip structural keys, leaving the free-form prop body of a node. */
function propsOf(node: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const key of Object.keys(node)) {
    if (STRUCTURAL_KEYS.has(key)) continue
    props[key] = node[key]
  }
  return props
}

/**
 * Flatten one engine node (and its subtree) into the page's node map, returning
 * the node's id. Children are flattened first, depth-first, so the parent's
 * `childIds` references are stable. Ids are taken from the engine node when
 * present (round-trip identity), else synthesized deterministically by path so
 * a config authored without ids still hydrates to a stable, addressable tree.
 */
function flattenNode(
  raw: Record<string, unknown>,
  nodes: Record<string, CanvasNode>,
  fallbackId: string,
): string {
  const id = typeof raw.id === 'string' && raw.id ? raw.id : fallbackId
  const rawChildren = Array.isArray(raw.children) ? (raw.children as unknown[]) : []

  const childIds = rawChildren
    .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object' && !Array.isArray(c))
    .map((child, i) => flattenNode(child, nodes, `${id}-${i}`))

  nodes[id] = {
    id,
    type:     typeof raw.type === 'string' ? raw.type : 'unknown',
    ...(typeof raw.variant === 'string' ? { variant: raw.variant } : {}),
    props:    propsOf(raw),
    childIds,
  }
  return id
}

/**
 * Hydrate a flat editor CanvasPage from a stored NodePageConfig (the NodeDef
 * tree from `GET /api/pages/:id`). The inverse of toNodePageConfig.
 *
 * The page root (`inner-page`) is unwrapped — its identity (id, slug←path) maps
 * onto the CanvasPage, and its top-level children become the ordered nodeIds.
 * `title` is not part of the engine node shape; the caller supplies it (it lives
 * on the page list row, not the config tree), defaulting to the slug.
 *
 * Lossless against toNodePageConfig: every node's type/variant/props/childIds
 * and document order survive the round-trip.
 */
export function fromNodePageConfig(
  cfg: NodePageConfig,
  title?: { ka: string; en: string },
): CanvasPage {
  const root = cfg as unknown as Record<string, unknown>
  const id   = typeof root.id === 'string' ? root.id : 'page'
  const slug = typeof root.path === 'string' ? root.path : id

  const nodes: Record<string, CanvasNode> = {}
  const rawTop = Array.isArray(root.children) ? (root.children as unknown[]) : []

  const nodeIds = rawTop
    .filter((c): c is Record<string, unknown> => c != null && typeof c === 'object' && !Array.isArray(c))
    .map((child, i) => flattenNode(child, nodes, `${id}-${i}`))

  return {
    id,
    title: title ?? { ka: slug, en: slug },
    slug,
    nodeIds,
    nodes,
  }
}
