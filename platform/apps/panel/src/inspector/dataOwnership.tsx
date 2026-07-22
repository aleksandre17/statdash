// ── dataOwnership — effective data binding resolved through the containment tree ──
//
//  ADR-041 residence / Law-10 (ONE containment grammar): a data panel's rows come from
//  the NEAREST enclosing element that owns a `data: DataSpec` (resolveNodeRows: `node.data`
//  present → interpret; absent → inherit the parent cascade `ctx.rows`). So "who owns the
//  data" is an INSTANCE + CONTAINMENT property, NOT a static type-cap: in the ONS/Eurostat
//  section grammar a SECTION owns one inline `query`, and its chart/table children are
//  DATA-LESS views that render from the section's shared rows.
//
//  The DATA facet must project onto that truth (card 0112 · S2). This module resolves the
//  selected element's data role by walking the page's containment tree — the panel layer
//  holds the tree, so the walk lives here (never in packages/react, which is app-agnostic):
//    • OWNER      — the element itself carries `props.data` (its door edits ITS spec);
//    • INHERITING — a data-LESS element whose nearest ancestor owns data (its door opens the
//                   OWNER's spec, never a fresh unbound one that would SHADOW the inherited
//                   rows — the S2/S3 root; Law 11 «the canvas never lies»);
//    • UNBOUND    — no own data and no ancestor data (genuinely bindable from scratch).
//
//  Delivered to the field control through a CONTEXT (mirrors `useFocusEscalation`): the
//  host (StudioShell) resolves it for the current selection and provides it; a control
//  mounted with NO host (unit tests / isolated mounts) reads null and falls back to the
//  own-spec view — fail-soft, zero regression.
//
import { createContext, useContext } from 'react'
import type { DataSpec, LocaleString } from '@statdash/engine'
import type { CanvasNode, CanvasPage, Locale } from '../types/constructor'

/** The selected element's data role, resolved through the containment tree (ADR-041). */
export type DataOwnership =
  | { role: 'owner' }
  | { role: 'inheriting'; ownerId: string; ownerLabel: string; ownerSpec: DataSpec }
  | { role: 'unbound' }

/** True when the node carries its OWN data spec (the ownership discriminant — the same
 *  `node.data` presence resolveNodeRows keys the render-time inherit cascade on). */
function ownsData(node: CanvasNode | undefined): node is CanvasNode {
  return !!node && (node.props as { data?: unknown }).data != null
}

/** The element's authored title (the honest inheritance label the summary shows) — a plain
 *  string or a `LocaleString`, resolved to the active locale; falls back to the type name. */
function nodeLabel(node: CanvasNode, locale: Locale): string {
  const title = (node.props as { title?: unknown }).title
  if (typeof title === 'string' && title) return title
  if (title && typeof title === 'object') {
    const rec = title as Record<string, string>
    return rec[locale] ?? rec['en'] ?? Object.values(rec)[0] ?? node.type
  }
  return node.type
}

/**
 * Resolve the selected node's data role by walking UP its containment chain. Pure —
 * the parent is found by the flat `childIds` reference map (Identity Map, the page's
 * canonical tree). Cycle-guarded (a malformed tree can never loop). No type literal:
 * ownership is `props.data` presence, generic over every element kind (Law 1).
 */
export function resolveDataOwnership(page: CanvasPage, nodeId: string, locale: Locale): DataOwnership {
  const nodes = page.nodes
  const self = nodes[nodeId]
  if (ownsData(self)) return { role: 'owner' }

  const parentOf = (id: string): string | undefined => {
    for (const n of Object.values(nodes)) if (n.childIds.includes(id)) return n.id
    return undefined
  }

  const seen = new Set<string>([nodeId])
  let cur = parentOf(nodeId)
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const owner = nodes[cur]
    if (ownsData(owner)) {
      return {
        role:       'inheriting',
        ownerId:    cur,
        ownerLabel: nodeLabel(owner, locale),
        ownerSpec:  (owner.props as { data: DataSpec }).data,
      }
    }
    cur = parentOf(cur)
  }
  return { role: 'unbound' }
}

// ── The context seam (mirrors focusEscalation) — null host ⇒ own-spec fallback ──────
const DataOwnershipContext = createContext<DataOwnership | null>(null)

/** The reader a data-facet control uses to learn its containment data role (or null →
 *  own-spec fallback, the isolated-mount behaviour). */
export function useDataOwnership(): DataOwnership | null {
  return useContext(DataOwnershipContext)
}

/** The host provides the selected element's resolved ownership around the dock. */
export const DataOwnershipProvider = DataOwnershipContext.Provider

/** Re-exported for the summary's honest label typing (a section title may be a LocaleString). */
export type { LocaleString }
