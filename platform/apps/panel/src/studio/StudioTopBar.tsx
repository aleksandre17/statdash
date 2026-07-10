import { Box, Typography, Button, MenuItem, Select, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import LogoutIcon from '@mui/icons-material/Logout'
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined'
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import { PageWorkflowBar } from '../features/page-workflow'
import { useConstructorStore, usePages, useActivePageId } from '../store/constructor.store'
import { logout } from '../lib/auth'
import type { Locale } from '../types/constructor'

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
  /** Whether the Data-model destination is the active screen (NAVIGATION, not role). */
  dataModelActive: boolean
  /**
   * Enter the Data-model destination — PURE NAVIGATION (AR-50 M5b): opens the
   * Data-model screen WITHOUT touching the role lens, so the user lands on the
   * role-appropriate content (author → read-only Data Dictionary). Composed by
   * StudioShell; the top bar never touches the role source (FF-ROLE-IS-LENS).
   */
  onOpenDataModel: () => void
  /** Leave the Data-model destination — return to the Compose surface (lens untouched). */
  onExitDataModel: () => void
  onLocaleChange: (locale: Locale) => void
  onOpenCommand:  () => void
  /** Summon the Style surface (brand-token editor). */
  onOpenStyle:    () => void
}

export function StudioTopBar({ locale, locales, dataModelActive, onOpenDataModel, onExitDataModel, onLocaleChange, onOpenCommand, onOpenStyle }: StudioTopBarProps) {
  const pages        = usePages()
  const activePageId = useActivePageId()
  const setActivePage = useConstructorStore((s) => s.setActivePage)
  const en = locale === 'en'

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

      {/* ── Workspace switch — Compose ⇄ Data model (Framer/Webflow IA) ─────────
          A segmented NAVIGATION switch (the Framer/Webflow "design ⇄ build" pattern):
          the active screen is the selected segment, and picking the other is a SINGLE
          intentful action. Choosing "Data model" navigates to the always-reachable
          Data-model destination (AR-50 M5b) — WITHOUT touching the role lens, so the
          user lands on the role-appropriate content (author → read-only Dictionary,
          steward → modeler); "Compose" returns to the editing surface. It NAMES the
          destination and reflects NAVIGATION, never the internal "role lens". This is
          one of several always-visible entries to the destination (the rail entry is
          the first-class one). MUI ToggleButtons are native <button aria-pressed> →
          keyboard-reachable, bilingual accessible names (WCAG 2.1 AA · 4.1.2). NOT a
          security control — it only re-projects screens over the SAME document. */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={dataModelActive ? 'model' : 'compose'}
        onChange={(_, v: 'compose' | 'model' | null) => {
          if (v === 'model') onOpenDataModel()
          else if (v === 'compose') onExitDataModel()
        }}
        aria-label={en ? 'Workspace' : 'სამუშაო სივრცე'}
        className="studio-mode-switch"
      >
        <Tooltip title={en ? 'Compose pages with governed metrics' : 'გვერდების აწყობა მართული მეტრიკებით'}>
          <ToggleButton value="compose" aria-label={en ? 'Compose' : 'კომპოზიცია'}>
            <DashboardCustomizeOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
            {en ? 'Compose' : 'კომპოზიცია'}
          </ToggleButton>
        </Tooltip>
        <Tooltip title={en ? 'Browse & define metrics and the data model' : 'მეტრიკებისა და მონაცემთა მოდელის დათვალიერება/განსაზღვრა'}>
          <ToggleButton value="model" aria-label={en ? 'Data model' : 'მონაცემთა მოდელი'}>
            <SchemaOutlinedIcon fontSize="small" sx={{ mr: 0.5 }} />
            {en ? 'Data model' : 'მონაცემთა მოდელი'}
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

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
