import { Box } from '@mui/material'
import { MetricPalette } from '../../discovery/MetricPalette'
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
