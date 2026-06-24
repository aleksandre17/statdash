// ── navUtils — extract nav section list from page config ──────────────
//
//  GENERIC registry-driven visitor (No-Privileged-Node ADR). Reads nothing by
//  hardcoded node type: it consults the nodeRegistry capabilities for each child.
//    - `nav-contributor` → emit a NavSection via the node's NavContribution
//      reader (default: id `anchor ?? id`, title `title`, navMode from
//      `view.visibleWhen`). section + georgraph declare this in their META.
//    - `nav-transparent`  → a REAL-DOM container (row) the extractor descends
//      through: its `view.visibleWhen` nav-mode is inherited by the contributor
//      children it wraps (reuses the generic `collectChildNodes` walker).
//
//  ZERO plugin node-type literals. New nav node = declare a cap in its META;
//  this file is never edited (OCP / Law 1 / Law 8). The engine reads the
//  registry, never imports plugins — the arrow is respected.
//

import type { VisibilityExpr }      from '@statdash/engine'
import type { NodeBase, NodeDef }   from './types'
import type { NavContribution }     from './nav-contribution'
import { nodeRegistry }             from './register-all'
import { collectChildNodes }        from './targets/nodeWalk'

export interface NavSection {
  id:       string
  title:    string
  navMode?: string
}

export function stickyOffset(): number {
  let offset = 8
  document.querySelectorAll<HTMLElement>('.filter-bar').forEach(bar => {
    const b = bar.getBoundingClientRect().bottom
    if (b > offset) offset = b
  })
  return offset
}

type Raw = Record<string, unknown>

function asRaw(node: NodeBase): Raw { return node as unknown as Raw }

/** Read a dot-path value off a raw node (e.g. 'view.visibleWhen'). */
function readPath(raw: Raw, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc != null && typeof acc === 'object'
      ? (acc as Record<string, unknown>)[key]
      : undefined),
    raw,
  )
}

function getNavMode(vw: VisibilityExpr | undefined, timeModeKey: string): string | undefined {
  if (!vw) return undefined
  if (vw.op === 'eq' && vw.param === timeModeKey) return String(vw.is)
  return undefined
}

/**
 * Apply a NavContribution reader to a raw contributor node. Returns a NavSection
 * only when both id and title resolve to strings (preserves the legacy
 * isSectionLike guard); otherwise undefined so the node is skipped.
 */
function readContribution(
  raw:         Raw,
  reader:      Required<NavContribution>,
  timeModeKey: string,
  inherited?:  string,
): NavSection | undefined {
  let id: string | undefined
  for (const field of reader.idFields) {
    const v = readPath(raw, field)
    if (typeof v === 'string') { id = v; break }
  }
  const title = readPath(raw, reader.titleField)
  if (id === undefined || typeof title !== 'string') return undefined

  const vw = readPath(raw, reader.modeField) as VisibilityExpr | undefined
  return { id, title, navMode: getNavMode(vw, timeModeKey) ?? inherited }
}

export function extractNavSectionsFromChildren(
  children:    NodeDef[],
  timeModeKey: string,
  modeOrder?:  string[],
): NavSection[] {
  return _extract(children.map(asRaw), timeModeKey, modeOrder)
}

export function extractNavSections(
  sections:    (NodeBase & { id: string; title: string })[],
  timeModeKey: string,
  modeOrder?:  string[],
): NavSection[] {
  return _extract(sections.map(asRaw), timeModeKey, modeOrder)
}

function _extract(nodes: Raw[], timeModeKey: string, modeOrder?: string[]): NavSection[] {
  const out: NavSection[] = []

  for (const node of nodes) {
    const type = node['type']
    if (typeof type !== 'string') continue
    const caps = nodeRegistry.getCaps(type)

    if (caps.includes('nav-transparent')) {
      // Real-DOM container: inherit its own nav-mode, descend into its child
      // nodes generically, and emit the contributor children it wraps.
      const containerVw = readPath(node, 'view.visibleWhen') as VisibilityExpr | undefined
      const inherited   = getNavMode(containerVw, timeModeKey)
      for (const child of collectChildNodes(node)) {
        const reader = nodeRegistry.getNavContribution(child.type)
        if (!reader) continue
        const sec = readContribution(child, reader, timeModeKey, inherited)
        if (sec) out.push(sec)
      }
    } else {
      const reader = nodeRegistry.getNavContribution(type)
      if (!reader) continue
      const sec = readContribution(node, reader, timeModeKey)
      if (sec) out.push(sec)
    }
  }

  const deduped = out.filter((s, i, a) => a.findIndex(x => x.id === s.id) === i)
  if (!modeOrder?.length) return deduped

  const rank = (m: string | undefined) => {
    if (m == null) return -1
    const i = modeOrder.indexOf(m)
    return i === -1 ? modeOrder.length : i
  }
  return [...deduped].sort((a, b) => rank(a.navMode) - rank(b.navMode))
}
