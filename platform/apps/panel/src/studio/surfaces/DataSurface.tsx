import { lazy, Suspense, useState } from 'react'
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { MetricPalette } from '../../discovery/MetricPalette'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import type { Locale } from '../../types/constructor'
import type { CanvasController } from '../useCanvasController'

// The raw source/spec/query modeling body — the SAME component the wizard's
// DataStep renders (extracted, not forked). Lazy so the editor suite (DataSpec
// editors + dnd-kit + source authoring) loads only when an author opens the
// Advanced disclosure — it never weighs down the eager StudioShell chunk.
const DataModelingPanel = lazy(() =>
  import('../../features/data-layer').then((m) => ({ default: m.DataModelingPanel })),
)

// ── Data surface — governed Metric Palette first, raw editors demoted ──────────
//
//  The inversion the vision fights for (spec §2.2): the author's DEFAULT data
//  affordance is the GOVERNED Metric Palette (bind-by-noun), NOT a query editor.
//  The full raw source/spec/query modeling (DataStep's body — DataSources with
//  Excel ingest + SourceAuthoringPanel, DataSpecs with the DataSpecEditor suite +
//  Show-Me) lives under a collapsed "Advanced data modeling" disclosure: present so
//  no capability is lost before M2 relocates it behind the Steward role, but never
//  the first thing an author hits (no data cliff). It mounts the SAME
//  DataModelingPanel the wizard uses — byte-identical store writes.
export function DataSurface({ controller, locale }: { controller: CanvasController; locale: Locale }) {
  const { selected, selectedBindable, selectedId, bindMetric } = controller
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Primary affordance — the governed metric catalog. */}
      <MetricPalette
        locale={locale}
        canBind={selectedBindable}
        bindHint={selected ? 'არჩეული ბლოკი მეტრიკას არ იღებს' : 'აირჩიეთ მონაცემთა ბლოკი მეტრიკის მისაბმელად'}
        onBind={(metricId) => { if (selectedId) bindMetric(selectedId, metricId) }}
      />

      {/* Demoted — raw modeling, collapsed by default (the Steward's path in M2).
          The heavy panel mounts only once the disclosure is opened. */}
      <Accordion
        disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider' }}
        expanded={advancedOpen}
        onChange={(_, open) => setAdvancedOpen(open)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="adv-data-modeling" id="adv-data-modeling-header">
          <Typography variant="body2" fontWeight={600}>დამატებითი მოდელირება</Typography>
        </AccordionSummary>
        <AccordionDetails id="adv-data-modeling">
          {advancedOpen && (
            <Suspense fallback={<SuspenseFallback label="Loading data editors" fill={false} />}>
              <DataModelingPanel />
            </Suspense>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
