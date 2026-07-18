import { useEffect, useState } from 'react'
import { Box, Typography, Chip, Collapse, Button, CircularProgress } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import { cubeApi, type CubeDatasetRow, type CubeProfileDimension } from '../../lib/cubeApi'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'
import { readLocale } from '../../inspector/localeString'
import { dimLabelDebt, debtNote } from '../../features/data-layer/workbench/cubeDebt'
import { CodelistTree } from './CodelistTree'
import type { Locale } from '../../types/constructor'

// ── CubeInventory — the Sources page's «რა მაქვს» answer (0091 · Floor 1) ────────
//
//  The cube/dataset inventory: every governed cube, its title, its dimensions AND their
//  live classifiers, browsable. This is the Sources destination's centre — comprehension
//  BEFORE manipulation (owner). It is a self-contained section deriving from ONE SSOT per
//  concern: the cube LIST from `cubeApi.datasets()`, each profile from the shared
//  `cubeProfile.store` cache (no second fetch path), the label-debt from `cubeDebt`, the
//  classifier tree from `CodelistTree`. Nothing here re-implements a source read.
//
//  ── Cross-gesture (the ladder as navigation) ──────────────────────────────────
//  A cube row offers «დაათვალიერე workbench-ში» — hand the steward INTO the Model page's
//  workbench seeded with this cube (0084's withStewardCube), via `onBrowseInWorkbench`.
//  Optional: an isolated mount without a handoff simply hides the affordance.
//
//  WCAG (Law 9): a labelled region; each cube + each dimension a real <button> disclosure
//  with aria-expanded; honest loading/error/empty states, never a crash. Bilingual ka/en.

type DatasetsState =
  | { status: 'loading' }
  | { status: 'ready'; rows: CubeDatasetRow[] }
  | { status: 'error' }

export interface CubeInventoryProps {
  locale: Locale
  /** Cross-gesture: open the workbench (Model page, Steward lens) seeded with this cube. */
  onBrowseInWorkbench?: (datasetCode: string, measures: string[]) => void
}

function DimensionRow({ dim, locale }: { dim: CubeProfileDimension; locale: Locale }) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const debt = dimLabelDebt(dim)

  return (
    <Box component="li" sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`inv-dim-${dim.code}`}
        sx={{
          width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 0.75,
          py: 0.5, px: 0.5, font: 'inherit', border: 0, cursor: 'pointer', bgcolor: 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        <AccountTreeOutlinedIcon fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{dim.code}</Typography>
        {dim.conceptRole && (
          <Typography variant="caption" color="text.secondary">{dim.conceptRole}</Typography>
        )}
        {dim.isTime && (
          <Chip size="small" variant="outlined" label={en ? 'time' : 'დრო'} sx={{ height: 18 }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {en ? `${dim.members.length} members` : `${dim.members.length} წევრი`}
        </Typography>
        {debt.missing > 0 && (
          <Chip size="small" color="warning" variant="outlined" icon={<WarningAmberIcon />}
            data-testid={`inv-dim-debt-${dim.code}`} label={debtNote(debt.missing, en)}
            sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: 11 } }} />
        )}
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: 3.5, pr: 1, pb: 1 }}>
          <CodelistTree members={dim.members} locale={locale} />
        </Box>
      </Collapse>
    </Box>
  )
}

function CubeCard({ row, locale, onBrowseInWorkbench }: { row: CubeDatasetRow; locale: Locale; onBrowseInWorkbench?: CubeInventoryProps['onBrowseInWorkbench'] }) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const ensure = useCubeProfileStore((s) => s.ensure)
  const entry  = useCubeProfileStore((s) => s.byCode[row.code])

  useEffect(() => { if (open) ensure(row.code) }, [open, row.code, ensure])

  const profile = entry?.status === 'ready' ? entry.profile : null
  const title   = readLocale(row.label, locale) || row.code

  return (
    <Box component="li" sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`inv-cube-${row.code}`}
        sx={{
          width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 1,
          p: 1.25, font: 'inherit', border: 0, cursor: 'pointer', bgcolor: 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        <StorageIcon color="primary" fontSize="small" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }} noWrap>{row.code}</Typography>
        </Box>
        {profile && (
          <Typography variant="caption" color="text.secondary">
            {en ? `${profile.dimensions.length} dims · ${profile.measures.length} measures`
                : `${profile.dimensions.length} განზ. · ${profile.measures.length} საზომი`}
          </Typography>
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 1.25, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {entry?.status === 'loading' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                {en ? 'Loading cube profile…' : 'იტვირთება კუბის პროფილი…'}
              </Typography>
            </Box>
          )}
          {entry?.status === 'error' && (
            <Typography variant="caption" color="warning.main">
              {en ? 'Cube profile unavailable.' : 'კუბის პროფილი მიუწვდომელია.'}
            </Typography>
          )}
          {profile && (<>
            <Box>
              <Typography variant="overline" color="text.secondary">
                {en ? 'Dimensions & classifiers' : 'განზომილებები და კლასიფიკატორები'}
              </Typography>
              <Box component="ul" aria-label={en ? 'Dimensions' : 'განზომილებები'}
                sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderTop: 0, borderRadius: 1, overflow: 'hidden' }}>
                {profile.dimensions.map((dim) => (
                  <DimensionRow key={dim.code} dim={dim} locale={locale} />
                ))}
              </Box>
            </Box>
            {onBrowseInWorkbench && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ScienceOutlinedIcon />}
                data-testid={`inv-cube-workbench-${row.code}`}
                onClick={() => onBrowseInWorkbench(row.code, profile.measures.map((m) => m.code))}
                sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
              >
                {en ? 'Browse in workbench' : 'დაათვალიერე workbench-ში'}
              </Button>
            )}
          </>)}
        </Box>
      </Collapse>
    </Box>
  )
}

export function CubeInventory({ locale, onBrowseInWorkbench }: CubeInventoryProps) {
  const en = locale === 'en'
  const [state, setState] = useState<DatasetsState>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    cubeApi.datasets()
      .then((rows) => { if (alive) setState({ status: 'ready', rows }) })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [])

  return (
    <Box
      component="section"
      aria-label={en ? 'Cube inventory' : 'კუბების ინვენტარი'}
      data-testid="cube-inventory"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <StorageIcon color="primary" fontSize="small" />
        <Typography variant="overline" color="text.secondary">
          {en ? 'What you have — cubes' : 'რა მაქვს — კუბები'}
        </Typography>
      </Box>

      {state.status === 'loading' && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'Loading cubes…' : 'იტვირთება კუბები…'}
        </Typography>
      )}
      {state.status === 'error' && (
        <Typography variant="caption" color="text.secondary" data-testid="cube-inventory-error">
          {en ? 'Cube catalog unavailable.' : 'კუბების კატალოგი მიუწვდომელია.'}
        </Typography>
      )}
      {state.status === 'ready' && state.rows.length === 0 && (
        <Typography variant="caption" color="text.secondary" data-testid="cube-inventory-empty">
          {en ? 'No cubes yet — onboard data above to begin.' : 'ჯერ კუბები არ არის — ატვირთე მონაცემები ზემოთ.'}
        </Typography>
      )}
      {state.status === 'ready' && state.rows.length > 0 && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {state.rows.map((row) => (
            <CubeCard key={row.code} row={row} locale={locale} onBrowseInWorkbench={onBrowseInWorkbench} />
          ))}
        </Box>
      )}
    </Box>
  )
}
