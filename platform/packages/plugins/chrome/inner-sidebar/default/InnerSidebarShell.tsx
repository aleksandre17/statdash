import './inner-sidebar.css'
import { useRef, useEffect, useState } from 'react'
import { Link, useLocation }           from 'react-router-dom'
import { useSearchParams }             from 'react-router-dom'
import { useSiteNav, useLocale, useChromeConfig, useResolveLocale, useSlotConfig } from '@statdash/react'
import { useSectionNav }               from '@statdash/react/context/SectionNavContext'
import { stickyOffset }                from '@statdash/react/engine'
import type { NavIconKey }             from '@statdash/react'
import type { ReactNode }              from 'react'
import type { InnerSidebarConfig }     from './meta'

// ── Nav icon registry — token → SVG ───────────────────────────────────

function BarChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="4" height="11" rx="1"/>
      <rect x="9" y="6" width="4" height="15" rx="1"/>
      <rect x="16" y="2" width="4" height="19" rx="1"/>
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M9 13h6M9 17h4"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

const NAV_ICONS: Record<NavIconKey, () => ReactNode> = {
  'bar-chart': BarChartIcon,
  'document':  DocumentIcon,
  'pin':       PinIcon,
}

function scrollTo(anchor: string) {
  const el = document.getElementById(anchor)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - stickyOffset()
  window.scrollTo({ top, behavior: 'smooth' })
}

// ── InnerSidebarShell — zero-prop chrome shell ────────────────────────
//
//  Reads nav data from context (useSiteNav, useSectionNav) — no props needed.
//  SectionNavProvider is mounted by InnerPageShell before rendering this slot.

export function InnerSidebarShell(): ReactNode {
  const location                            = useLocation()
  const locale                              = useLocale()
  const nav                                 = useSiteNav()
  const config                              = useChromeConfig()
  const slot                                = useSlotConfig<InnerSidebarConfig>()
  const t                                   = useResolveLocale()
  const { sections, activeId, timeModeKey } = useSectionNav()
  const [searchParams, setSearchParams]     = useSearchParams()

  const pathParts     = location.pathname.split('/').filter(Boolean)
  const activeSection = pathParts[1] ?? ''
  const [openSection, setOpenSection] = useState(activeSection)

  const pendingScrollRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pendingScrollRef.current) return
    const anchor = pendingScrollRef.current
    if (document.getElementById(anchor)) {
      scrollTo(anchor)
      pendingScrollRef.current = null
    }
  }, [searchParams])

  const currentMode = searchParams.get(timeModeKey) ?? ''

  return (
    <aside className="inner-sidebar">
      <div className="sidebar-brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        {slot.brandTitle && (
          <span className="sidebar-brand-text">{t(slot.brandTitle)}</span>
        )}
      </div>

      {slot.sectionsLabel && (
        <div className="sidebar-section-label">{t(slot.sectionsLabel)}</div>
      )}

      {nav.map((entry) => {
        const localePath   = `/${locale}${entry.path}`
        const isActive     = location.pathname === localePath || activeSection === entry.id
        const isOpen       = openSection === entry.id
        const Icon         = NAV_ICONS[entry.icon]
        const pageSections = isActive ? sections : []

        return (
          <div key={entry.id} className="sidebar-nav-section" style={{ '--sc': entry.color } as React.CSSProperties}>
            <button
              className={`sidebar-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => setOpenSection(isOpen ? '' : entry.id)}
            >
              <span className="sidebar-icon"><Icon /></span>
              <Link
                to={localePath}
                className="sidebar-nav-label"
                style={{ textDecoration: 'none', color: 'inherit' }}
                onClick={(e) => e.stopPropagation()}
              >
                {entry.label}
              </Link>
              <svg
                className={`sidebar-chevron ${isOpen ? 'open' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            <div
              className="sidebar-sub"
              style={{ maxHeight: isOpen ? `${Math.max(pageSections.length, 1) * 2.6}rem` : '0' }}
            >
              {pageSections.map((sec) => (
                <button
                  key={sec.id}
                  className={`sidebar-sub-item${activeId === sec.id ? ' is-active' : ''}`}
                  onClick={() => {
                    const needsModeSwitch = sec.navMode && sec.navMode !== currentMode
                    if (needsModeSwitch) {
                      pendingScrollRef.current = sec.id
                      setSearchParams(prev => {
                        prev.set(timeModeKey, sec.navMode!)
                        return prev
                      }, { replace: true })
                    } else if (location.pathname !== localePath) {
                      window.location.href = `${localePath}#${sec.id}`
                    } else {
                      scrollTo(sec.id)
                    }
                  }}
                >
                  <span className="sidebar-sub-dot" />
                  <span className="sidebar-sub-title">{sec.title}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {config.copyright && (
        <div className="sidebar-footer">
          © {new Date().getFullYear()} {t(config.copyright)}
        </div>
      )}
    </aside>
  )
}