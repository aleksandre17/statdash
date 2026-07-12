import { Box, Button, Typography, Divider } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useNavigate } from 'react-router-dom'
import { MetricPalette } from '../../discovery/MetricPalette'
import { studioSurfacePath } from '../useStudioRoute'
import type { Locale } from '../../types/constructor'
import type { CanvasController } from '../useCanvasController'

// ── Data surface — the governed Metric Palette, the author's ONLY data affordance ─
//
//  The inversion the vision fights for, now complete (spec §2.2, §3.3, M2.1): the
//  author's data surface is the GOVERNED Metric Palette (bind-by-noun) and NOTHING
//  else — no query/pivot/cube editor is reachable from the author lens
//  (FF-AUTHOR-NO-QUERY). The raw source/spec/query modeler that M1 parked here under
//  a demoted "Advanced" disclosure has RELOCATED behind the Steward role, into Model
//  mode (ModelSurface). Nothing is lost: an author who needs to model flips the
//  Model-mode lens (M2.0 top-bar toggle) → the Model surface hosts the SAME
//  DataModelingPanel. This is the define-vs-curate role separation made real
//  (Strangler relocation — the machinery MOVED audience, was not deleted).
export function DataSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  const { selected, selectedBindable, selectedId, bindMetric } = controller
  const navigate = useNavigate()
  const en = locale === 'en'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Onboard-data FRONT-DOOR (AR-51): the author SEES the raw-data upload entry
          here and jumps to Model mode, where the governed upload lives. Define-vs-
          curate is preserved (the upload itself stays a steward act) — but its DOOR is
          in front, not buried. A navigation CTA, not a query editor (FF-AUTHOR-NO-QUERY
          untouched). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }} data-testid="onboard-data-cta">
        <Typography variant="subtitle2">{en ? 'Onboard raw data' : 'ნედლი მონაცემების ატვირთვა'}</Typography>
        <Typography variant="caption" color="text.secondary">
          {en
            ? 'Upload a workbook — it self-declares its structure (DSD), then publishes.'
            : 'ატვირთე workbook — თავად აცხადებს სტრუქტურას (DSD) და ქვეყნდება.'}
        </Typography>
        <Button
          variant="outlined" size="small" startIcon={<UploadFileIcon />}
          onClick={() => navigate(studioSurfacePath('model'))}
          sx={{ alignSelf: 'flex-start', textTransform: 'none', mt: 0.5 }}
        >
          {en ? 'Onboard data →' : 'ატვირთვა →'}
        </Button>
      </Box>
      <Divider flexItem />

      {/* The author's single data affordance — the governed metric catalog. */}
      <MetricPalette
        locale={locale}
        canBind={selectedBindable}
        bindHint={selected ? 'არჩეული ბლოკი მეტრიკას არ იღებს' : 'აირჩიეთ მონაცემთა ბლოკი მეტრიკის მისაბმელად'}
        onBind={(metricId) => { if (selectedId) bindMetric(selectedId, metricId) }}
      />
    </Box>
  )
}
