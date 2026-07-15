// ── outlineModel — flat store → flattened, depth-stamped Outline rows ─────────
//
//  Webflow Navigator model: the Outline is a STRUCTURAL projection of the SAME
//  CanvasPage flat store the canvas renders — never a parallel tree. We flatten
//  the hierarchy (page top-level → childIds, depth-first) into an ordered row
//  list, each row carrying its depth + parent + sibling index so the tree view
//  can render `role=tree`/`treeitem` with `aria-level`/`aria-posinset` and so
//  drag-reorder can address a drop as (parentId, index) for the store's moveNode.
//
//  Collapsed subtrees are pruned from the visible rows (the collapse state lives
//  in the component — view state, not store/config state).
//
import { nodeRegistry } from '@statdash/react/engine'
import type { LocaleString } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode } from '../types/constructor'

export interface OutlineRow {
  id:        string
  type:      string
  variant?:  string
  /** Human label for the row — node's title-ish prop, else the registry label, else the type. */
  label:     string
  /**
   * A secondary line that DISTINGUISHES structurally-identical siblings — the node's
   * primary bound measure (two Tables that render different metrics are no longer
   * indistinguishable "Table" rows). Absent when the node binds no measure. Generic
   * (Law 1): the query's measure, never a privileged dimension.
   */
  subtitle?: string
  /** 1-based nesting depth (top-level = 1) → aria-level. */
  depth:     number
  /** Parent container id (the page id for top-level rows). */
  parentId:  string
  /** 1-based position among its siblings → aria-posinset. */
  posInSet:  number
  /** Sibling count in its container → aria-setsize. */
  setSize:   number
  /** True when this row's node has at least one child (can collapse/expand). */
  hasChildren: boolean
}

function resolveLabel(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const l = value as Record<string, string>
    return l.en ?? l.ka ?? fallback
  }
  return fallback
}

/** A friendly row label: a node title-ish prop, then the registry display label, then the type. */
function rowLabel(node: CanvasNode): string {
  const titleish = node.props.title ?? node.props.label ?? node.props.heading
  if (titleish != null) return resolveLabel(titleish, node.type)
  const meta = nodeRegistry.getMeta(node.type, node.variant)
  return resolveLabel(meta?.label as LocaleString | undefined, node.type)
}

/**
 * The node's primary bound measure — a disambiguating secondary line for the outline.
 * Reads the canonical bind location (`props.data.query.measure`, where the Inspector /
 * Metric-Palette / DATA facet all write). Generic (Law 1): a query's measure is not a
 * privileged dimension. Absent when the node carries no query DataSpec / no measure.
 */
function rowSubtitle(node: CanvasNode): string | undefined {
  const data = node.props.data as { type?: string; query?: { measure?: unknown } } | undefined
  if (!data || data.type !== 'query') return undefined
  const measure = data.query?.measure
  if (Array.isArray(measure)) {
    const parts = measure.filter((m): m is string => typeof m === 'string' && m.length > 0)
    return parts.length > 0 ? parts.join(', ') : undefined
  }
  return typeof measure === 'string' && measure.length > 0 ? measure : undefined
}

/**
 * Flatten the page hierarchy into ordered, depth-stamped Outline rows.
 * `collapsed` is the set of node ids whose subtrees are hidden — their rows are
 * still emitted (so the toggle shows) but their descendants are pruned.
 */
export function buildOutlineRows(
  page: CanvasPage,
  collapsed: ReadonlySet<string>,
): OutlineRow[] {
  const rows: OutlineRow[] = []

  const walk = (ids: string[], parentId: string, depth: number) => {
    const setSize = ids.length
    ids.forEach((id, i) => {
      const node = page.nodes[id]
      if (!node) return
      rows.push({
        id,
        type:        node.type,
        variant:     node.variant,
        label:       rowLabel(node),
        subtitle:    rowSubtitle(node),
        depth,
        parentId,
        posInSet:    i + 1,
        setSize,
        hasChildren: node.childIds.length > 0,
      })
      if (node.childIds.length > 0 && !collapsed.has(id)) {
        walk(node.childIds, id, depth + 1)
      }
    })
  }

  walk(page.nodeIds, page.id, 1)
  return rows
}
