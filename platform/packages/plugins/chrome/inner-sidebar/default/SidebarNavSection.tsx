// ── SidebarNavSection — one top-level nav entry + its collapsible sub-nav ──
//
//  Renders a nav entry's row (icon · label — ONE link) plus a dedicated
//  chevron toggle, and the animated sub-item list beneath. Navigation is
//  delegated: the row is an SPA <Link>; each sub-item routes through the
//  `onSelect` handler the shell built from useSidebarNav. This component holds
//  layout + open/active state presentation only — no router or URL access.
//
//  Interaction contract (owner, round 12 — the WAI-ARIA disclosure-navigation
//  convention, gov.uk / docs-site school):
//    · entry WITH sub-items, CLOSED → the row click EXPANDS (link intercepted);
//    · entry WITH sub-items, OPEN   → the row click NAVIGATES (it is a link);
//    · entry WITHOUT sub-items      → the row click navigates directly;
//    · the chevron is a separate, always-toggle disclosure button
//      (aria-expanded), so collapsing never requires navigating.
//  Valid HTML: the old <a>-inside-<button> nesting is gone.
//

import { Link }              from 'react-router-dom'
import type { ReactNode }    from 'react'
import { accentStyle }       from '@statdash/react/engine'
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
  const hasChildren  = sections.length > 0
  // Disclosure-first: a closed parent's row expands instead of navigating.
  const expandFirst  = hasChildren && !isOpen

  return (
    <div className={SIDEBAR.navSection} style={accentStyle(color)} data-nav-entry={id}>
      <div className={itemClass}>
        <Link
          to={localePath}
          className={SIDEBAR.navLink}
          aria-current={isActive ? 'page' : undefined}
          onClick={expandFirst ? (e) => { e.preventDefault(); onToggle() } : undefined}
        >
          <span className={SIDEBAR.icon}><Icon /></span>
          <span className={SIDEBAR.navLabel}>{label}</span>
        </Link>
        {hasChildren && (
          <button
            type="button"
            className={SIDEBAR.chevronBtn}
            aria-expanded={isOpen}
            aria-label={label}
            onClick={onToggle}
          >
            <svg
              className={chevronClass}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        )}
      </div>

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
