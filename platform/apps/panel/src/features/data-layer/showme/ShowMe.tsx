// ── ShowMe — "Show Me" suggested charts from the cube profile (V5, Tableau) ───
//
//  The Tableau "Show Me" affordance: read the active dataset's profile, run the
//  EXISTING suggestPanels (SDMX role → panel: isTime→timeseries, geo→map,
//  hierarchy→tree, measure→kpi-strip/bar) and offer each fit-for-the-data panel
//  as a ONE-CLICK insert. Clicking a suggestion builds a POPULATED `query`
//  DataSpec (buildSuggestedSpec — bound measure + encoding, codes from the
//  profile) and hands it to the host to persist. No new suggestion logic and no
//  new config dialect: Show-Me reuses suggestPanels and emits the same `query`
//  spec the typed editors produce.
//
//  Graceful degradation: when no dataset is bound or its profile is unavailable
//  / yields no suggestions, Show-Me hides itself — it is an accelerator, never a
//  blocker (the typed editors remain available).
//
import { useMemo } from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import MapIcon from '@mui/icons-material/Map'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import BarChartIcon from '@mui/icons-material/BarChart'
import SpeedIcon from '@mui/icons-material/Speed'
import type { DataSpec } from '@statdash/engine'
import { useActiveProfile } from '../../../discovery/useActiveProfile'
import { suggestPanels, type PanelSuggestion } from '../../../discovery/suggestPanels'
import { buildSuggestedSpec } from './buildSuggestedSpec'

export interface ShowMeProps {
  /**
   * Insert a populated DataSpec for the chosen suggestion. The host decides
   * persistence (e.g. createDataSpec) + naming — Show-Me stays a pure UI
   * surface. `panelType` is passed so the host can derive a default name.
   */
  onInsert: (spec: DataSpec, panelType: string) => void
}

// Panel-type → icon + Georgian label (the recommendation explanation, POLA).
const PANEL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  timeseries: { icon: <ShowChartIcon fontSize="small" />,   label: 'დროითი მწკრივი' },
  map:        { icon: <MapIcon fontSize="small" />,          label: 'რუკა' },
  tree:       { icon: <AccountTreeIcon fontSize="small" />,  label: 'იერარქია' },
  bar:        { icon: <BarChartIcon fontSize="small" />,     label: 'სვეტოვანი' },
  'kpi-strip':{ icon: <SpeedIcon fontSize="small" />,        label: 'მაჩვენებლები (KPI)' },
}

// Machine reason → human explanation of WHY this chart fits.
const REASON_TEXT: Record<PanelSuggestion['reason'], string> = {
  'time-axis':      'დროის ღერძი',
  'geo-role':       'გეო განზომილება',
  'hierarchy':      'იერარქიული განზომილება',
  'measure':        'მაჩვენებელი',
  'measure-by-dim': 'მაჩვენებელი განზომილების მიხედვით',
}

export function ShowMe({ onInsert }: ShowMeProps) {
  const active = useActiveProfile()

  const suggestions = useMemo<PanelSuggestion[]>(
    () => (active.status === 'ready' ? suggestPanels(active.profile) : []),
    [active],
  )

  // Accelerator, not a blocker: nothing to suggest → render nothing.
  if (active.status !== 'ready' || suggestions.length === 0) return null

  const profile = active.profile

  const insert = (s: PanelSuggestion) => {
    const spec = buildSuggestedSpec(s, profile)
    if (spec) onInsert(spec, s.panelType)
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoFixHighIcon color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={600}>აჩვენე — შემოთავაზებული გრაფიკები</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        თქვენი მონაცემებისთვის შერჩეული გრაფიკები — დააჭირეთ ჩასასმელად
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {suggestions.map((s) => {
          const meta = PANEL_META[s.panelType] ?? { icon: <BarChartIcon fontSize="small" />, label: s.panelType }
          return (
            <Button
              key={s.panelType}
              variant="outlined"
              size="small"
              startIcon={meta.icon}
              onClick={() => insert(s)}
              aria-label={`ჩასვი ${meta.label} — ${REASON_TEXT[s.reason]}: ${s.basis}`}
              sx={{ textTransform: 'none' }}
            >
              {meta.label}
            </Button>
          )
        })}
      </Box>
    </Paper>
  )
}
