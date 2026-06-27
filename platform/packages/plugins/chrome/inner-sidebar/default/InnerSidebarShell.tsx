import './inner-sidebar.css'
import { useState }                    from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useSiteNav, useLocale, useChromeConfig, useResolveLocale, useSlotConfig } from '@statdash/react'
import { useAnchorNav }                from '@statdash/react/context/AnchorNavContext'
import type { ReactNode }              from 'react'
import type { InnerSidebarConfig }     from './meta'
import { SIDEBAR }                     from './styleKeys'
import { resolveNavIcon }              from './navIcons'
import { useSidebarScroll }            from './useSidebarScroll'
import { useSidebarNav }               from './useSidebarNav'
import { SidebarNavSection }           from './SidebarNavSection'

// ── InnerSidebarShell — zero-prop chrome shell ────────────────────────
//
//  Reads nav data from context (useSiteNav, useAnchorNav) — no props needed.
//  AnchorNavProvider is mounted by InnerPageShell before rendering this slot.
//
//  Composition (no logic inline): icon lookup → navIcons registry; scroll
//  mechanics → useSidebarScroll; navigation intent (incl. cross-page routing
//  via the SPA router, NOT a hard window.location reload) → useSidebarNav; each
//  nav entry + its collapsible sub-list → <SidebarNavSection>.

export function InnerSidebarShell(): ReactNode {
  const location                            = useLocation()
  const locale                              = useLocale()
  const nav                                 = useSiteNav()
  const config                              = useChromeConfig()
  const slot                                = useSlotConfig<InnerSidebarConfig>()
  const t                                   = useResolveLocale()
  const { sections, activeId, perspectiveKey } = useAnchorNav()
  const [searchParams, setSearchParams]     = useSearchParams()

  const pathParts     = location.pathname.split('/').filter(Boolean)
  const activeSection = pathParts[1] ?? ''
  const [openSection, setOpenSection] = useState(activeSection)

  const scroll      = useSidebarScroll(searchParams)
  const currentMode = searchParams.get(perspectiveKey) ?? ''

  return (
    <aside className={SIDEBAR.root}>
      <div className={SIDEBAR.brand}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        {slot.brandTitle && (
          <span className={SIDEBAR.brandText}>{t(slot.brandTitle)}</span>
        )}
      </div>

      {slot.sectionsLabel && (
        <div className={SIDEBAR.sectionLabel}>{t(slot.sectionsLabel)}</div>
      )}

      {nav.map((entry) => {
        const localePath  = `/${locale}${entry.path}`
        const isCurrent   = location.pathname === localePath
        const isActive    = isCurrent || activeSection === entry.id

        return (
          <NavEntry
            key={entry.id}
            entry={entry}
            localePath={localePath}
            isCurrentPage={isCurrent}
            isActive={isActive}
            isOpen={openSection === entry.id}
            sections={isActive ? sections : []}
            activeAnchorId={activeId}
            currentMode={currentMode}
            perspectiveKey={perspectiveKey}
            setSearchParams={setSearchParams}
            scroll={scroll}
            onToggle={() => setOpenSection(o => (o === entry.id ? '' : entry.id))}
          />
        )
      })}

      {config.copyright && (
        <div className={SIDEBAR.footer}>
          © {new Date().getFullYear()} {t(config.copyright)}
        </div>
      )}
    </aside>
  )
}

// ── NavEntry — binds one nav entry to its navigation seam ──────────────
//
//  A thin per-entry adapter: each entry needs its OWN useSidebarNav handler
//  (closed over its localePath / current-page state), so the hook is called here
//  rather than once in the shell. Presentation lives in <SidebarNavSection>.

interface NavEntryProps {
  entry:          ReturnType<typeof useSiteNav>[number]
  localePath:     string
  isCurrentPage:  boolean
  isActive:       boolean
  isOpen:         boolean
  sections:       ReturnType<typeof useAnchorNav>['sections']
  activeAnchorId: string | null
  currentMode:    string
  perspectiveKey:    string
  setSearchParams: ReturnType<typeof useSearchParams>[1]
  scroll:         ReturnType<typeof useSidebarScroll>
  onToggle:       () => void
}

function NavEntry({
  entry,
  localePath,
  isCurrentPage,
  isActive,
  isOpen,
  sections,
  activeAnchorId,
  currentMode,
  perspectiveKey,
  setSearchParams,
  scroll,
  onToggle,
}: NavEntryProps): ReactNode {
  const onSelectSection = useSidebarNav({
    localePath,
    isCurrentPage,
    currentMode,
    perspectiveKey,
    setSearchParams,
    scroll,
  })

  return (
    <SidebarNavSection
      id={entry.id}
      label={entry.label}
      icon={entry.icon}
      color={entry.color}
      localePath={localePath}
      isActive={isActive}
      isOpen={isOpen}
      sections={sections}
      activeAnchorId={activeAnchorId}
      resolveIcon={resolveNavIcon}
      onToggle={onToggle}
      onSelectSection={onSelectSection}
    />
  )
}
