// ── RawCubePalette — the STEWARD raw-cube browser (0084 §1/§3) ─────────────────
//
//  ADR-046 · SPEC §2 (Floor 1 vocabulary) · the international canon (Power Query
//  "connect to source" · Superset SQL Lab · Looker SQL Runner · dbt raw→staging): raw
//  cube access is a STEWARD ROLE, never the author's default. This palette lists the
//  governed catalog's cubes (dataset code + governed title + a dim summary from the cube
//  profile). Picking a cube emits the EXISTING steward `source(query)` head — the browse
//  grid then shows the cube's raw observations (steward plane, raw codes per the plane law).
//
//  P-OFFER (Law 4 / Excel-Power-Query school): the cube, its dims — everything is OFFERED,
//  nothing typed. The member-label DEBT (the R/U gap) is surfaced HONESTLY per dim
//  («N წევრს ეტიკეტი აკლია») — visibility for the steward who can fix it, never an invented
//  label (0084 §3). Reachable ONLY behind the steward lens (the parent gates the tab).
//
//  WCAG (Law 9): a labelled region; each cube a real <button> disclosure with aria-expanded;
//  the dim summary a <ul>; honest loading/error/empty states, never a crash. Bilingual ka/en.
//
import { useEffect, useState } from 'react'
import { Box, Typography, Chip, Collapse, Button, CircularProgress } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { cubeApi, type CubeDatasetRow } from '../../../lib/cubeApi'
import { useCubeProfileStore } from '../../../discovery/cubeProfile.store'
import { readLocale } from '../../../inspector/localeString'
import type { Locale } from '../../../types/constructor'
import { cubeLabelDebt, debtNote } from './cubeDebt'

export interface RawCubePaletteProps {
  /** Browse a raw cube: emit the steward `source(query)` head for `measures` of `datasetCode`. */
  onPickCube: (datasetCode: string, measures: string[]) => void
  /** Active locale for governed titles/labels. */
  locale:     Locale
}

/** One expandable cube row — governed title + code, its dim summary + label-debt marks. */
function CubeRow({ row, locale, onPickCube }: { row: CubeDatasetRow; locale: Locale; onPickCube: RawCubePaletteProps['onPickCube'] }) {
  const en = locale === 'en'
  const [open, setOpen] = useState(false)
  const ensure = useCubeProfileStore((s) => s.ensure)
  const entry  = useCubeProfileStore((s) => s.byCode[row.code])

  // Load the profile lazily — only when the steward opens the cube (one fetch per code).
  useEffect(() => { if (open) ensure(row.code) }, [open, row.code, ensure])

  const profile = entry?.status === 'ready' ? entry.profile : null
  const debt    = profile ? cubeLabelDebt(profile) : []
  const title   = readLocale(row.label, locale) || row.code

  return (
    <Box component="li" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid={`raw-cube-${row.code}`}
        sx={{
          width: '100%', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 0.75,
          p: 0.75, bgcolor: 'background.paper', font: 'inherit', cursor: 'pointer', border: 0,
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{row.code}</Typography>
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ p: 1, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {entry?.status === 'loading' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            {/* Dim summary — every axis offered, its label-debt marked (governance visibility). */}
            <Box component="ul" aria-label={en ? 'Dimensions' : 'განზომილებები'}
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {debt.map((d) => (
                <Box component="li" key={d.dimCode} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>{d.dimCode}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {en ? `${d.total} member${d.total === 1 ? '' : 's'}` : `${d.total} წევრი`}
                  </Typography>
                  {d.missing > 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      variant="outlined"
                      icon={<WarningAmberIcon />}
                      data-testid={`dim-debt-${d.dimCode}`}
                      label={debtNote(d.missing, en)}
                      sx={{ height: 20, '& .MuiChip-label': { px: 0.5, fontSize: 11 } }}
                    />
                  )}
                </Box>
              ))}
            </Box>
            <Button
              size="small"
              variant="outlined"
              data-testid={`raw-cube-browse-${row.code}`}
              onClick={() => onPickCube(row.code, profile.measures.map((m) => m.code))}
              sx={{ alignSelf: 'flex-start' }}
            >
              {en ? 'Browse raw observations' : 'ნედლი დაკვირვებების დათვალიერება'}
            </Button>
          </>)}
        </Box>
      </Collapse>
    </Box>
  )
}

export function RawCubePalette({ onPickCube, locale }: RawCubePaletteProps) {
  const en = locale === 'en'
  const [datasets, setDatasets] = useState<CubeDatasetRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    cubeApi.datasets()
      .then((rows) => { if (alive) setDatasets(rows) })
      .catch(() => { if (alive) { setDatasets([]); setFailed(true) } })
    return () => { alive = false }
  }, [])

  return (
    <Box
      component="section"
      aria-label={en ? 'Raw cubes' : 'ნედლი კუბები'}
      data-testid="raw-cube-palette"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <StorageIcon color="primary" fontSize="small" />
        <Typography variant="overline" color="text.secondary">{en ? 'Raw cubes' : 'ნედლი კუბები'}</Typography>
      </Box>

      {datasets === null && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'Loading cubes…' : 'იტვირთება კუბები…'}
        </Typography>
      )}
      {datasets !== null && datasets.length === 0 && (
        <Typography variant="caption" color="text.secondary" data-testid="raw-cube-empty">
          {failed
            ? (en ? 'Cube catalog unavailable.' : 'კუბების კატალოგი მიუწვდომელია.')
            : (en ? 'No cubes registered.' : 'კუბები არ არის რეგისტრირებული.')}
        </Typography>
      )}
      {datasets && datasets.length > 0 && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {datasets.map((row) => (
            <CubeRow key={row.code} row={row} locale={locale} onPickCube={onPickCube} />
          ))}
        </Box>
      )}
    </Box>
  )
}
