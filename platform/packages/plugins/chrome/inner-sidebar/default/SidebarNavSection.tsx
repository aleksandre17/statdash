// ── SidebarNavSection — one top-level nav entry + its collapsible sub-nav ──
//
//  Renders a nav entry's header row (icon · label-link · chevron) and the
//  animated sub-item list beneath it. Navigation is delegated: the parent-item
//  link is an SPA <Link>; each sub-item routes through the `onSelect` handler the
//  shell built from useSidebarNav. This component holds layout + open/active
//  state presentation only — no router or URL access of its own.
//

import { Link }              from 'react-router-dom'
import type { ReactNode, CSSProperties } from 'react'
import type { NavSection }   from '@statdash/react/engine'
import type { NavIconKey }   from '@statdash/react'
import { SIDEBAR, subNavOpenHeightRem } from './styleKeys'
import { SidebarSubItem }    from './SidebarSubItem'

export interface SidebarNavSectionProps {
  /** Stable id of the nav entry (page id). */
  id:           string
  label:        string
  icon:         NavIconKey
  /** Per-entry accent colour, fed to the `--sc` cascade. */
  color:        string
  /** Locale-prefixed link target for the entry's page. */
  localePath:   string
  isActive:     boolean
  isOpen:       boolean
  /** Section anchors shown when this entry is the active page (else empty). */
  sections:     NavSection[]
  activeAnchorId: string | null
  resolveIcon:  (key: NavIconKey) => () => ReactNode
  /** Toggle this entry's expanded state. */
  onToggle:     () => void
  /** Navigate to a sub-section (mode-switch / cross-page / in-page scroll). */
  onSelectSection: (section: NavSection) => void
}

export function SidebarNavSection({
  id,
  label,
  icon,
  color,
  localePath,
  isActive,
  isOpen,
  sections,
  activeAnchorId,
  resolveIcon,
  onToggle,
  onSelectSection,
}: SidebarNavSectionProps): ReactNode {
  const Icon         = resolveIcon(icon)
  const itemClass    = isActive ? `${SIDEBAR.navItem} ${SIDEBAR.isActive}` : SIDEBAR.navItem
  const chevronClass = isOpen ? `${SIDEBAR.chevron} ${SIDEBAR.isOpen}` : SIDEBAR.chevron

  return (
    <div className={SIDEBAR.navSection} style={{ '--sc': color } as CSSProperties} data-nav-entry={id}>
      <button className={itemClass} onClick={onToggle}>
        <span className={SIDEBAR.icon}><Icon /></span>
        <Link
          to={localePath}
          className={SIDEBAR.navLabel}
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
        <svg
          className={chevronClass}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      <div
        className={SIDEBAR.sub}
        style={{ maxHeight: isOpen ? `${subNavOpenHeightRem(sections.length)}rem` : '0' }}
      >
        {sections.map((sec) => (
          <SidebarSubItem
            key={sec.id}
            section={sec}
            isActive={activeAnchorId === sec.id}
            onSelect={onSelectSection}
          />
        ))}
      </div>
    </div>
  )
}
