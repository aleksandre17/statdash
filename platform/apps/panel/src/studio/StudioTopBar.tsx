import { Box, Typography, Button, MenuItem, Select, IconButton, Tooltip } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LogoutIcon from '@mui/icons-material/Logout'
import { PageWorkflowBar } from '../features/page-workflow'
import { useConstructorStore, usePages, useActivePageId } from '../store/constructor.store'
import { logout } from '../lib/auth'
import type { Locale } from '../types/constructor'

// ── StudioTopBar — persistent global-context bar (Framer IA) ──────────────────
//
//  Owns the shell's global context: product wordmark (the Strata seam — M1.4),
//  the page switcher, the ⌘K omnibar entry, the draft→publish workflow (relocated
//  from PageStep), and logout. A <header role="banner"> landmark (WCAG 2.1 AA).
//
//  M1.2 scaffold: locale / theme / perspective / preview toggles are reserved
//  top-bar regions (spec §2.1) filled in M1.3/M1.4 — not stubbed here.
export interface StudioTopBarProps {
  locale:        Locale
  onOpenCommand: () => void
}

export function StudioTopBar({ locale, onOpenCommand }: StudioTopBarProps) {
  const pages        = usePages()
  const activePageId = useActivePageId()
  const setActivePage = useConstructorStore((s) => s.setActivePage)

  const handleLogout = () => { logout(); window.location.reload() }

  return (
    <Box component="header" role="banner" className="studio-topbar">
      <Typography className="studio-wordmark" component="span">Strata</Typography>

      <Select
        size="small"
        value={activePageId ?? ''}
        onChange={(e) => setActivePage(e.target.value || null)}
        displayEmpty
        aria-label={locale === 'en' ? 'Active page' : 'აქტიური გვერდი'}
        sx={{ minWidth: 180 }}
      >
        {pages.length === 0 && <MenuItem value="" disabled>{locale === 'en' ? 'No pages' : 'გვერდები არ არის'}</MenuItem>}
        {pages.map((p) => (
          <MenuItem key={p.id} value={p.id}>{p.title[locale] || p.title.ka || p.id}</MenuItem>
        ))}
      </Select>

      <Box sx={{ flex: 1, minWidth: 16 }}><PageWorkflowBar /></Box>

      <Button size="small" variant="outlined" startIcon={<SearchIcon />} onClick={onOpenCommand}>
        ⌘K
      </Button>

      <Tooltip title={locale === 'en' ? 'Logout' : 'გასვლა'}>
        <IconButton onClick={handleLogout} size="small" aria-label={locale === 'en' ? 'Logout' : 'გასვლა'}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
