// ── SidebarSubItem — one in-page anchor row under a nav section ────────
//
//  Pure presentation: a button that, when clicked, hands its NavSection back to
//  the parent's navigation seam (useSidebarNav). It owns ZERO navigation logic —
//  it never touches the router or the URL directly.
//

import type { ReactNode }   from 'react'
import type { NavSection }  from '@statdash/react/engine'
import { SIDEBAR }          from './styleKeys'

export interface SidebarSubItemProps {
  section:  NavSection
  isActive: boolean
  onSelect: (section: NavSection) => void
}

export function SidebarSubItem({ section, isActive, onSelect }: SidebarSubItemProps): ReactNode {
  const className = isActive ? `${SIDEBAR.subItem} ${SIDEBAR.isActive}` : SIDEBAR.subItem
  return (
    <button className={className} onClick={() => onSelect(section)}>
      <span className={SIDEBAR.subDot} />
      <span className={SIDEBAR.subTitle}>{section.title}</span>
    </button>
  )
}
