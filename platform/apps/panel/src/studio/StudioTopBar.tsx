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
  /**
   * Enter the Data-model workspace: ONE intentful action that both sets the Steward
   * lens AND lands the user in metric authoring (the Model surface). Composed by
   * StudioShell so the top bar never touches the role SOURCE (FF-ROLE-IS-LENS).
   */
  onOpenDataModel: () => void
  /** Leave the Data-model workspace — return to the Compose (author) lens. */
  onExitDataModel: () => void
  onLocaleChange: (locale: Locale) => void
  onOpenCommand:  () => void
  /** Summon the Style surface (brand-token editor). */
  onOpenStyle:    () => void
}

export function StudioTopBar({ locale, locales, role, onOpenDataModel, onExitDataModel, onLocaleChange, onOpenCommand, onOpenStyle }: StudioTopBarProps) {
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

      {/* ── Workspace switch — Compose ⇄ Data model (AR-49, Framer/Webflow IA) ──
          A segmented mode switch (the Framer/Webflow "design ⇄ build" pattern):
          the current workspace is ALWAYS visible as the selected segment (state
          reads as its own thing), and picking the other segment is a SINGLE
          intentful action. Choosing "Data model" both sets the Steward lens AND
          lands the user in metric authoring (StudioShell composes onOpenDataModel);
          "Compose" returns to the author lens. This collapses the old two-step
          (flip an invisible role toggle, THEN hunt for a look-alike rail icon) into
          one click with unmistakable feedback — the segment highlights AND the
          surface swaps. Names the DESTINATION, never the internal "role lens".
          MUI ToggleButtons are native <button aria-pressed> → keyboard-reachable,
          bilingual accessible names (WCAG 2.1 AA · 4.1.2). NOT a security control —
          it only re-projects surfaces over the SAME document (FF-ROLE-IS-LENS). */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={role === 'steward' ? 'model' : 'compose'}
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
        <Tooltip title={en ? 'Define metrics & the data model' : 'მეტრიკებისა და მონაცემთა მოდელის განსაზღვრა'}>
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
