// ── navUtils — extract nav section list from page config ──────────────
//
//  Agnostic: reads id/title/visibleWhen from NodeDef tree.
//  Handles RowNode by inheriting the row's visibleWhen as navMode for its children.
//  Uses structural types — engine must not import from plugins/.
//

import type { VisibilityExpr } from '@geostat/engine'
import type { NodeBase, NodeDef } from './types'

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

function getNavMode(vw: VisibilityExpr | undefined, timeModeKey: string): string | undefined {
  if (!vw) return undefined
  if (vw.op === 'eq' && vw.param === timeModeKey) return String(vw.is)
  return undefined
}

type Raw = Record<string, unknown>

function asRaw(node: NodeBase): Raw { return node as unknown as Raw }

function fromSectionLike(raw: Raw, timeModeKey: string, inherited?: string): NavSection {
  const view = raw['view'] as { visibleWhen?: VisibilityExpr } | undefined
  return {
    id:      (raw['anchor'] as string | undefined) ?? (raw['id'] as string),
    title:   raw['title'] as string,
    navMode: getNavMode(view?.visibleWhen, timeModeKey) ?? inherited,
  }
}

function isSectionLike(raw: Raw): boolean {
  return (raw['type'] === 'section' || raw['type'] === 'georgraph') &&
    typeof raw['id'] === 'string' && typeof raw['title'] === 'string'
}

export function extractNavSectionsFromChildren(
  children:    NodeDef[],
  timeModeKey: string,
  modeOrder?:  string[],
): NavSection[] {
  const sections = children
    .map(asRaw)
    .filter(r => r['type'] === 'section' || r['type'] === 'georgraph' || r['type'] === 'row')
  return _extract(sections, timeModeKey, modeOrder)
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
    if (node['type'] === 'row') {
      const rowView = node['view'] as { visibleWhen?: VisibilityExpr } | undefined
      const rowMode = getNavMode(rowView?.visibleWhen, timeModeKey)
      const items   = (node['items'] as Raw[] | undefined) ?? []
      for (const item of items) {
        if (isSectionLike(item)) out.push(fromSectionLike(item, timeModeKey, rowMode))
      }
    } else if (isSectionLike(node)) {
      out.push(fromSectionLike(node, timeModeKey))
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