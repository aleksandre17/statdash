// ── DataFacetField — the DATA facet control (PropFieldType 'data-pipeline') ───────
//
//  The second FACET control (sibling of StyleField): it authors an element's whole
//  `data: DataSpec` in place — the un-burying of Gap 3 (SPEC-deep-authorability-
//  completion). Registered in FieldControlRegistry under `type:'data-pipeline'`, so the
//  generic Inspector dispatches the DATA facet's `contract` field to it (genericity in
//  the DISPATCH — a rich facet resolves to a rich editor, exactly like Webflow/Builder.io
//  project a fixed Data tab per data-bindable element).
//
//  TWO reconciled modes over ONE `data` value (one onChange → props.data):
//    • BIND (governed, the simple default) — the MetricPalette: pick a governed metric
//      → `bindMeasureToSpec` writes `query.measure`. This is the element.data metric-bind
//      re-homed as ONE MODE of the facet, not a parallel section (SPEC reconciliation).
//    • PIPE (advanced, metric-OPTIONAL) — the existing DataSpecEditor: author a raw
//      query / transform / derive / calc pipeline OVER a governed source, with or without
//      a metric. Lazy-loaded so the editor suite never weighs down the eager inspector
//      chunk (mirrors ModelSurface's lazy DataModelingPanel).
//
//  D-DA1 — the governance LENS, not a wall. This control is the AUTHOR's pipe-over-
//  governed surface: every mode here composes over ALREADY-GOVERNED sources (metrics,
//  cube measures, prior specs). Defining a RAW BASE SOURCE (a brand-new dataset — the
//  SourceAuthoringPanel / Excel upload in DataModelingPanel) stays Steward-gated in
//  ModelSurface and is deliberately NOT mounted here — so the pipe is un-buried for
//  authors WITHOUT dissolving the governance that keeps published numbers trustworthy
//  (Law 9). Encoded + guarded by FF-AUTHOR-NO-QUERY (the lens form).
//
//  Controlled component: value in (the current DataSpec | undefined), onChange out (the
//  next whole spec). WCAG 2.1 AA: labelled regions, keyboard-reachable disclosure.
//
import { lazy, Suspense } from 'react'
import { Box, Typography, Divider, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec } from '@statdash/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import { MetricPalette } from '../../discovery/MetricPalette'
import { bindMeasureToSpec } from './dataFacetModel'

// Lazy: the DataSpec editor suite (+ dnd-kit) loads only when an author expands the
// advanced pipeline — never in the eager inspector chunk. Named import via the direct
// module (NOT the data-layer barrel, which also exports the Steward-only
// DataModelingPanel / source authoring) so the author facet pulls ONLY the pipe editor.
const DataSpecEditor = lazy(() =>
  import('../../features/data-layer/DataSpecEditor').then((m) => ({ default: m.DataSpecEditor })),
)

export function DataFacetField({ value, locale, onChange }: FieldControlProps) {
  const spec = value as DataSpec | undefined
  const en = locale === 'en'

  return (
    <Box className="insp-data" data-testid="data-facet-field" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── BIND mode — the governed metric palette (author-safe default) ─────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <MetricPalette
          locale={locale}
          canBind
          bindHint={en ? 'Bind a governed metric to this element' : 'მიაბით მართული მეტრიკა ამ ელემენტს'}
          onBind={(metricId) => onChange(bindMeasureToSpec(spec, metricId))}
        />
      </Box>

      <Divider textAlign="left">
        <Typography variant="caption" color="text.secondary">
          {en ? 'or author a pipeline' : 'ან ააგეთ პაიპლაინი'}
        </Typography>
      </Divider>

      {/* ── PIPE mode — the full DataSpec editor (metric-OPTIONAL, over governed data) ─ */}
      <Accordion disableGutters variant="outlined" data-testid="data-facet-pipe">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" fontWeight={600}>
            {en ? 'Data pipeline' : 'მონაცემთა პაიპლაინი'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Suspense fallback={<SuspenseFallback label={en ? 'Loading data editors' : 'იტვირთება რედაქტორები'} fill={false} />}>
            <DataSpecEditor value={spec ?? null} onChange={(next) => onChange(next)} />
          </Suspense>
        </AccordionDetails>
      </Accordion>

      {/* Governance orientation (the lens): raw new datasets live in the Steward's Data
          model. Author here = pipe over governed sources (D-DA1). */}
      <Typography variant="caption" color="text.disabled">
        {en
          ? 'Composes over governed sources. Define a new raw dataset in the Data model (Steward).'
          : 'იყენებს მართულ წყაროებს. ახალი ნედლი მონაცემთა ნაკრები განისაზღვრება მონაცემთა მოდელში (სტიუარდი).'}
      </Typography>
    </Box>
  )
}
