import { Box, Button, Typography, Divider } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useNavigate } from 'react-router-dom'
import { NodePalette } from '../../canvas/NodePalette'
import { INSERT_SECTION_LABELS } from '../../canvas/paletteGroupLabels'
import { studioDataPath } from '../useStudioRoute'
import type { CanvasController } from '../useCanvasController'
import type { Locale } from '../../types/constructor'

// ── Add pane — the page-content block palette (Left Navigator, SPEC S5) ─────────
//
//  Pane 1 of the two-pane left Navigator (Add | Layers): the engine NodePalette
//  (registry-driven icon tiles). Drag state is lifted to the shared controller so the
//  always-mounted canvas reveals drop zones while a palette item is dragged. The
//  section overline is localized (INSERT_SECTION_LABELS) — no bare English label leaks.
//
//  Chrome (header / sidebar / footer) is NOT here — it is SITE furniture, now
//  canvas-selectable (S4) and authored in the Site workspace, not inserted as content.
//
//  ── Onboard-data FRONT-DOOR (AR-51) — re-homed here from the retired Data surface ─
//  The author SEES the raw-data upload entry (front, not buried) and jumps to the ONE
//  Data workspace's Sources floor (ADR-051 DU1), where the governed upload door
//  (CanonicalUpload) actually lives. Define-vs-curate is preserved (the upload itself
//  stays a steward act) — a navigation CTA, not a query editor (FF-AUTHOR-NO-QUERY
//  untouched). It sits atop the always-visible Add pane so it is reachable before any
//  block exists on a blank page.
export function InsertSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  const navigate = useNavigate()
  const en = locale === 'en'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }} data-testid="onboard-data-cta">
        <Typography variant="subtitle2">{en ? 'Onboard raw data' : 'ნედლი მონაცემების ატვირთვა'}</Typography>
        <Typography variant="caption" color="text.secondary">
          {en
            ? 'Upload a workbook — it self-declares its structure (DSD), then publishes.'
            : 'ატვირთე workbook — თავად აცხადებს სტრუქტურას (DSD) და ქვეყნდება.'}
        </Typography>
        <Button
          variant="outlined" size="small" startIcon={<UploadFileIcon />}
          onClick={() => navigate(studioDataPath())}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', mt: 0.5 }}
        >
          {en ? 'Onboard data →' : 'ატვირთვა →'}
        </Button>
      </Box>
      <Divider flexItem />

      <Typography variant="overline" color="text.secondary">{INSERT_SECTION_LABELS.blocks[locale]}</Typography>
      <NodePalette
        locale={locale}
        selectedType={controller.selected?.type ?? null}
        pageType={controller.page?.type ?? null}
        onDragStateChange={controller.setDragging}
      />
    </Box>
  )
}
