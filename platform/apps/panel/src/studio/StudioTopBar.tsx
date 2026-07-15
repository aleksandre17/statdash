import { Box, Typography, Button, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LogoutIcon from '@mui/icons-material/Logout'
import { PageWorkflowBar } from '../features/page-workflow'
import { usePages, useActivePageId } from '../store/constructor.store'
import { logout } from '../lib/auth'
import type { Locale } from '../types/constructor'

// ── StudioTopBar — global context + the PUBLISH terminal (relay Step 1) ─────────
//
//  Stripped to GLOBAL context only (BLUEPRINT-panel-canonical-relay §1): the wordmark,
//  a read-only `project ▸ page` breadcrumb, the locale preview, ⌘K, and — top-right —
//  the lifecycle terminal (`PageWorkflowBar`: Save · Publish · History), the reference-
//  class "ship it" corner (MOMENT 4). The scattered doors that used to crowd this bar
//  are RETIRED to their ONE home (LAW C / FF-ONE-HOME-PER-CAPABILITY): the Compose⇄Data
//  switch, the "Site & chrome" button and the "Brand & theme" icon are now rail modes;
//  the page `Select` is gone (page-nav lives in the bottom tabs — ONE home). The
//  breadcrumb is NON-interactive context, not a second page-nav door.
//
//  A <header role="banner"> landmark (WCAG 2.1 AA). Colours come from the token layer
//  (studio.css) — no brand literal here (FF-CHROME-TOKEN-DRIVEN).
export interface StudioTopBarProps {
  locale:         Locale
  /** Selectable locales for the preview switcher. */
  locales:        readonly Locale[]
  onLocaleChange: (locale: Locale) => void
  onOpenCommand:  () => void
}

export function StudioTopBar({ locale, locales, onLocaleChange, onOpenCommand }: StudioTopBarProps) {
  const pages        = usePages()
  const activePageId = useActivePageId()
  const activePage   = pages.find((p) => p.id === activePageId)
  const pageTitle    = activePage ? (activePage.title[locale] || activePage.title.ka || activePage.id) : null

  const handleLogout = () => { logout(); window.location.reload() }

  return (
    <Box component="header" role="banner" className="studio-topbar">
      {/* ── Global context — wordmark + read-only project ▸ page breadcrumb ──── */}
      <Box className="studio-topbar__brand" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography className="studio-wordmark" component="span">Strata</Typography>
        {pageTitle && (
          <>
            <Typography component="span" aria-hidden="true" className="studio-topbar__crumb-sep" sx={{ opacity: 0.5 }}>›</Typography>
            <Typography component="span" className="studio-topbar__crumb" noWrap sx={{ minWidth: 0 }}>{pageTitle}</Typography>
          </>
        )}
      </Box>

      {/* Spacer — pushes the ship-it cluster to the terminal top-right. */}
      <Box sx={{ flex: 1, minWidth: 16 }} />

      {/* ── Locale preview switcher (global view context) ─────────────────────── */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={locale}
        onChange={(_, v: Locale | null) => { if (v) onLocaleChange(v) }}
        aria-label={locale === 'en' ? 'Preview locale' : 'ენის გადახედვა'}
      >
        {locales.map((l) => (
          <ToggleButton key={l} value={l} aria-label={l}>{l}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Button size="small" variant="outlined" startIcon={<SearchIcon />} onClick={onOpenCommand}>
        ⌘K
      </Button>

      {/* ── PUBLISH terminal (MOMENT 4) — the lifecycle "ship it" corner ──────── */}
      <PageWorkflowBar />

      <Tooltip title={locale === 'en' ? 'Logout' : 'გასვლა'}>
        <IconButton onClick={handleLogout} size="small" aria-label={locale === 'en' ? 'Logout' : 'გასვლა'}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
