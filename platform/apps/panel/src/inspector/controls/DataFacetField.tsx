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
import { Box, Typography, Divider, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TuneIcon from '@mui/icons-material/Tune'
import type { DataSpec } from '@statdash/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import { MetricPalette } from '../../discovery/MetricPalette'
import { useFocusEscalation } from '../focusEscalation'
import { bindMeasureToSpec } from './dataFacetModel'

// Lazy: the DataSpec editor suite (+ dnd-kit) loads only when an author expands the
// advanced pipeline — never in the eager inspector chunk. Named import via the direct
// module (NOT the data-layer barrel, which also exports the Steward-only
// DataModelingPanel / source authoring) so the author facet pulls ONLY the pipe editor.
const DataSpecEditor = lazy(() =>
  import('../../features/data-layer/DataSpecEditor').then((m) => ({ default: m.DataSpecEditor })),
)

// Lazy: the three-pane workbench (+ PipelineBuilder/dnd-kit, live grid, generated-query
// pane) loads only when the author OPENS it (via the focus-view escalation) — never in
// the eager inspector chunk. The escalation render-prop wraps it in Suspense (below).
const DataWorkbench = lazy(() =>
  import('../../features/data-layer/workbench/DataWorkbench').then((m) => ({ default: m.DataWorkbench })),
)

// A fresh, valid-by-default query spec — the browse-first Get + result (E1): opening
// the workbench on an unbound element seeds this, and the grid shows the "pick a metric"
// browse hint until one is chosen. Byte-identical to DataSpecEditor's `query` default.
function freshQuerySpec(): DataSpec {
  return { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } }
}

export function DataFacetField({ field, value, locale, onChange }: FieldControlProps) {
  const spec = value as DataSpec | undefined
  const en = locale === 'en'

  // The overflow-escalation host (StudioShell, around the dock). Null in isolation
  // (unit tests / other mounts) → the workbench door hides, the in-place editors below
  // still serve — fail-soft, zero regression (mirrors NestedItemControl's fallback).
  const escalation = useFocusEscalation()

  // The workbench is QUERY-shaped (Get + pipe + generated query). It opens for a query
  // spec OR an unbound element (seeded fresh, browse-first); a non-query spec is edited
  // through the existing conversion (the advanced accordion below) — pre-note #2.
  const canWorkbench = !!escalation && (!spec || spec.type === 'query')

  const openWorkbench = () => {
    if (!escalation) return
    // Ensure the field carries a query spec BEFORE handing it to the workbench, so the
    // escalation's live binding reads a query spec from the first render (the host binds
    // `props[field.field]` live each render).
    if (!spec || spec.type !== 'query') onChange(freshQuerySpec())
    escalation.escalate({
      source:    'node-field',
      fieldPath: field.field,
      title:     { ka: 'მონაცემთა ვორქბენჩი', en: 'Data workbench' },
      render:    (bind) => (
        <Suspense fallback={<SuspenseFallback label={en ? 'Loading workbench' : 'იტვირთება ვორქბენჩი'} />}>
          <DataWorkbench value={bind.value as DataSpec | undefined} onChange={(next) => bind.onChange(next)} />
        </Suspense>
      ),
    })
  }

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

      {/* ── OPEN THE WORKBENCH — the primary door into the three-pane surface (W-P2).
          Escalates OUT to the wide focus-view: step rail · live grid · generated query.
          The author starts from Get, never from a spec-type Select (SPEC §3.4). ─────── */}
      {canWorkbench && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<TuneIcon />}
          onClick={openWorkbench}
          data-testid="open-data-workbench"
          sx={{ alignSelf: 'flex-start' }}
        >
          {en ? 'Open data workbench' : 'გახსენით მონაცემთა ვორქბენჩი'}
        </Button>
      )}

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
