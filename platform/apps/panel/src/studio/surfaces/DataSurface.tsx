import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Alert } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { MetricPalette } from '../../discovery/MetricPalette'
import { ShowMe } from '../../features/data-layer/showme/ShowMe'
import { createDataSpec } from '../../store/api-actions'
import type { DataSpec } from '@statdash/engine'
import type { Locale } from '../../types/constructor'
import type { CanvasController } from '../useCanvasController'

// ── Data surface — governed Metric Palette first, raw editors demoted ──────────
//
//  The inversion the vision fights for (spec §2.2): the author's DEFAULT data
//  affordance is the GOVERNED Metric Palette (bind-by-noun), NOT a query editor.
//  The raw source/spec/query modeling lives under a collapsed "Advanced data
//  modeling" disclosure — present so no capability is lost before M2, but never
//  the first thing an author hits (no data cliff).
//
//  M1.2 SCAFFOLD NOTE (flagged for M1.3): the Advanced disclosure currently mounts
//  ShowMe (suggest→persist a DataSpec) as a first, real relocated editor. The full
//  source/spec browser + DataSpecEditor + Excel ingest (DataStep's left/right
//  columns) relocate here in M1.3 with their selection state — that is a re-home of
//  existing components, deliberately NOT forked into this scaffold.
export function DataSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  const { selected, selectedBindable, selectedId, bindMetric } = controller

  const handleSuggestionInsert = (spec: DataSpec, panelType: string) => {
    void createDataSpec({ name: `${panelType} (შემოთავაზებული)`, spec })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Primary affordance — the governed metric catalog. */}
      <MetricPalette
        locale={locale}
        canBind={selectedBindable}
        bindHint={selected ? 'არჩეული ბლოკი მეტრიკას არ იღებს' : 'აირჩიეთ მონაცემთა ბლოკი მეტრიკის მისაბმელად'}
        onBind={(metricId) => { if (selectedId) bindMetric(selectedId, metricId) }}
      />

      {/* Demoted — raw modeling, collapsed by default (the Steward's path in M2). */}
      <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="adv-data-modeling" id="adv-data-modeling-header">
          <Typography variant="body2" fontWeight={600}>დამატებითი მოდელირება</Typography>
        </AccordionSummary>
        <AccordionDetails id="adv-data-modeling">
          <ShowMe onInsert={handleSuggestionInsert} />
          <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
            წყაროების/სპეც-ების სრული რედაქტორი გადმოვა M1.3-ში (Steward — M2).
          </Alert>
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
