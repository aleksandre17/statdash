import { Box, Typography, Button, MenuItem, Select, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LogoutIcon from '@mui/icons-material/Logout'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import { PageWorkflowBar } from '../features/page-workflow'
import { useConstructorStore, usePages, useActivePageId } from '../store/constructor.store'
import { logout } from '../lib/auth'
import type { Locale } from '../types/constructor'
import type { Role } from './useRole'

// ── StudioTopBar — persistent global-context bar (Framer IA) ──────────────────
//
//  Owns the shell's global context: product wordmark (the Strata seam), the page
//  switcher, the ⌘K omnibar entry, the draft→publish workflow (relocated from
//  PageStep), and logout. A <header role="banner"> landmark (WCAG 2.1 AA).
//
//  M1.4 fills the reserved locale/theme regions (spec §2.1): a locale PREVIEW
//  switcher (drives the whole shell's language live via the caller's ephemeral
//  override) and a brand/theme access button that summons the Style surface (the
//  writable brand-token editor). Colours come from the token layer (studio.css) —
//  no brand literal here (FF-CHROME-TOKEN-DRIVEN).
export interface StudioTopBarProps {
  locale:         Locale
  /** Selectable locales for the preview switcher. */
  locales:        readonly Locale[]
  /** The role LENS (author | steward) — read by StudioShell via useRole (single seam). */
  role:           Role
  /** Toggle the role lens (author ⇄ steward) — the "Model mode" control drives this. */
  onToggleRole:   () => void
  onLocaleChange: (locale: Locale) => void
  onOpenCommand:  () => void
  /** Summon the Style surface (brand-token editor). */
  onOpenStyle:    () => void
}

export function StudioTopBar({ locale, locales, role, onToggleRole, onLocaleChange, onOpenCommand, onOpenStyle }: StudioTopBarProps) {
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

      {/* ── Locale preview switcher (reserved region, spec §2.1) ──────────── */}
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

      {/* ── Role lens toggle — "Model mode" (AR-49 M2.0, spec §2.2) ────────────
          A toggle (aria-pressed) that flips the author ⇄ steward LENS. In the
          Steward lens the Model rail slot unlocks. Native <button> → keyboard-
          reachable (Tab + Enter/Space); bilingual accessible name + tooltip. NOT a
          security control — it only re-projects surfaces over the SAME document. */}
      <Tooltip
        title={
          role === 'steward'
            ? (locale === 'en' ? 'Return to Compose' : 'დაბრუნება კომპოზიციაში')
            : (locale === 'en' ? 'Enter Model mode' : 'მოდელის რეჟიმში შესვლა')
        }
      >
        <Button
          size="small"
          variant={role === 'steward' ? 'contained' : 'outlined'}
          startIcon={<HubOutlinedIcon fontSize="small" />}
          onClick={onToggleRole}
          aria-pressed={role === 'steward'}
          aria-label={locale === 'en' ? 'Model mode' : 'მოდელის რეჟიმი'}
        >
          {locale === 'en' ? 'Model' : 'მოდელი'}
        </Button>
      </Tooltip>

      {/* ── Brand / theme access (reserved region, spec §2.1) → Style editor ── */}
      <Tooltip title={locale === 'en' ? 'Brand & theme' : 'ბრენდი და თემა'}>
        <IconButton onClick={onOpenStyle} size="small" aria-label={locale === 'en' ? 'Brand & theme' : 'ბრენდი და თემა'}>
          <PaletteOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

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
