// ── DataFacetField — the DATA facet control (PropFieldType 'data-pipeline') ───────
//
//  ONE MODEL, TWO ZOOMS (card 0086, owner-caught duality). The inspector DATA facet is a
//  compact READ-ONLY *summary* of the element's data + ONE prominent door into the
//  workbench — never a SECOND parallel editor beside it. This closes the owner's
//  «workbench-ს თუ ააგეთ-პაიპლაინს ვეღარ ვარჩევ» confusion: the workbench is THE editor
//  (Power BI's Power Query Editor = the editor; the report view = compact wells · Figma:
//  inspector = projection, advanced = escalation). Progressive disclosure with ONE editing
//  model, never two.
//
//  What the facet shows (author plane):
//    • SUMMARY (read-only) — governed source name · step count · row count/state, all
//      derived from the SAME `toWorkbenchModel` the workbench operates on (one derivation,
//      no second interpretation). Honest states incl. unbound-as-affordance (AR-52 «the
//      canvas never lies»: no-data / loading / error are DECLARED, never faked).
//    • THE DOOR — one prominent «გახსენი ვორქბენჩი» primary action into the three-pane
//      surface (this also closes the owner's discoverability complaint).
//    • QUICK-BIND — for an UNBOUND element only, the MetricPalette one-gesture bind (a
//      Power BI fields-well equivalent — a quick action, not an editor).
//
//  The full inline DataSpec editor LEFT the author plane (its components live re-homed in
//  the workbench). The Steward-advanced LENS retains the raw editor (the plane law: raw
//  spec authoring is a steward concern; the formal ⛔ demotion is gated on ADR-047 Wave B
//  and is deliberately NOT fired here).
//
//  D-DA1 — the governance LENS, not a wall: every mode here composes over ALREADY-GOVERNED
//  sources. Defining a RAW BASE SOURCE stays Steward-gated in ModelSurface, NOT here
//  (FF-AUTHOR-NO-QUERY, the lens form).
//
//  Controlled component: value in (the current DataSpec | undefined), onChange out (the
//  next whole spec). WCAG 2.1 AA: labelled summary group, keyboard-reachable door + editor.
//
import { lazy, Suspense } from 'react'
import { Box, Typography, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LaunchIcon from '@mui/icons-material/Launch'
import type { DataSpec, EncodingSpec } from '@statdash/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { SuspenseFallback } from '../../shared/SuspenseFallback'
import { MetricPalette } from '../../discovery/MetricPalette'
import { useFocusEscalation } from '../focusEscalation'
import { useRole } from '../../studio/useRole'
import { bindMeasureToSpec, adoptOnOpen } from './dataFacetModel'
import { toWorkbenchModel, isHeadBound } from '../../features/data-layer/workbench/workbenchModel'
import { usePipelineSourceRows, type PreviewStatus } from '../../features/data-layer/pipeline-preview/usePipelineSourceRows'
import { useGridLabels } from '../../features/data-layer/pipeline-preview/useGridLabels'

// Lazy: the raw DataSpec editor suite (+ dnd-kit) loads only when a STEWARD expands the
// advanced editor — never in the eager inspector chunk / never for an author. Named import
// via the direct module (NOT the data-layer barrel, which also exports the Steward-only
// DataModelingPanel / source authoring) so the facet pulls ONLY the pipe editor.
const DataSpecEditor = lazy(() =>
  import('../../features/data-layer/DataSpecEditor').then((m) => ({ default: m.DataSpecEditor })),
)

// Lazy: the three-pane workbench (+ PipelineBuilder/dnd-kit, live grid, generated-query
// pane) loads only when the author OPENS it (via the focus-view escalation) — never in
// the eager inspector chunk. The escalation render-prop wraps it in Suspense (below).
const DataWorkbench = lazy(() =>
  import('../../features/data-layer/workbench/DataWorkbench').then((m) => ({ default: m.DataWorkbench })),
)

/** A neutral encoding for the summary's source read when the model is absent (its result
 *  is 'unbound' in that branch — the hook must still be called unconditionally). */
const EMPTY_ENCODING: EncodingSpec = { label: '' }

/** The honest, bilingual row-count/state line (AR-52 — a declared state, never a fake 0). */
function rowStateLabel(status: PreviewStatus, count: number, en: boolean): string {
  switch (status) {
    case 'ok':          return en ? `${count} rows`       : `${count} სტრიქონი`
    case 'loading':     return en ? 'loading…'            : 'იტვირთება…'
    case 'error':       return en ? 'read error'          : 'წაკითხვის შეცდომა'
    case 'unavailable': return en ? 'live unavailable'    : 'ცოცხალი მიუწვდომელია'
    case 'unbound':     return en ? 'not bound'           : 'მიუბმელი'
  }
}

function SummaryRow({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} data-testid={testid} sx={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  )
}

export function DataFacetField({ value, field, locale, onChange }: FieldControlProps) {
  const spec = value as DataSpec | undefined
  const en = locale === 'en'

  // The overflow-escalation host (StudioShell, around the dock). Null in isolation
  // (unit tests / other mounts) → the workbench door hides, the summary still serves —
  // fail-soft, zero regression (mirrors NestedItemControl's fallback).
  const escalation = useFocusEscalation()
  const role = useRole()
  const isSteward = role === 'steward'

  // The ONE model the workbench operates on (W-P5b) — the summary derives from THIS, not a
  // second interpretation. `null` for a spec the workbench does not shape (row-list/…).
  const model = toWorkbenchModel(spec)
  const bound = !!model && isHeadBound(model.head)
  const stepCount = model?.tail.length ?? 0
  const nonShaped = !!spec && !model

  // The live source read — the honest row-count/state for the summary (the SAME read the
  // canvas & workbench issue; unbound/loading/error/no-data are DECLARED, never faked).
  const source = usePipelineSourceRows(model?.head, model?.encoding ?? EMPTY_ENCODING)
  const { columnLabel } = useGridLabels(model?.head)
  const sourceName = bound ? columnLabel('value') : ''

  // ADR-049 P2a Lane 1 — the workbench door is KIND-AGNOSTIC (FF-WORKBENCH-KIND-AGNOSTIC).
  // EVERY bind-kind reaches the workbench (no `spec.type` literal gate): the buried surface
  // is no longer denied to a row-list / timeseries / growth / ratio-list element. The only
  // gate is the escalation host (null in isolation → the door fail-soft hides).
  const canWorkbench = !!escalation

  const openWorkbench = () => {
    if (!escalation) return
    // ADOPT, never discard (adoptOnOpen): a bound spec of ANY kind is handed to the workbench
    // INTACT — only a truly unbound element is seeded a fresh browse-first pipeline. The
    // workbench declares an honest empty state for a kind it cannot yet shape and offers a
    // governed metric bind to start (Law 11 — the door is a live path, never a lossy wipe).
    const seed = adoptOnOpen(spec)
    if (seed) onChange(seed)
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
      {/* ── SUMMARY (read-only) — the ONE model, honest state (never a fake 0) ────────── */}
      <Box
        role="group"
        aria-label={en ? 'Data summary' : 'მონაცემთა შეჯამება'}
        data-testid="data-facet-summary"
        sx={{
          display: 'flex', flexDirection: 'column', gap: 0.75,
          p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover',
        }}
      >
        <Typography variant="overline" color="text.secondary">{en ? 'Data' : 'მონაცემები'}</Typography>
        {bound ? (
          <>
            <SummaryRow label={en ? 'Source' : 'წყარო'} value={sourceName} testid="summary-source" />
            <SummaryRow label={en ? 'Steps' : 'ნაბიჯები'} value={String(stepCount)} testid="summary-steps" />
            <SummaryRow label={en ? 'Rows' : 'სტრიქონები'} value={rowStateLabel(source.status, source.sourceRows.length, en)} testid="summary-rows" />
          </>
        ) : nonShaped ? (
          <Typography variant="body2" color="text.secondary" data-testid="summary-nonpipeline">
            {en
              ? `This element uses a "${spec!.type}" data spec — open the steward raw editor below to change it.`
              : `ამ ელემენტს აქვს "${spec!.type}" ტიპის მონაცემები — შესაცვლელად გახსენით ნედლი რედაქტორი ქვემოთ.`}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" data-testid="summary-unbound">
            {en
              ? 'No data bound yet — bind a governed metric, or open the workbench to build a pipeline.'
              : 'მონაცემები ჯერ მიბმული არ არის — მიაბით მართული მეტრიკა, ან გახსენით ვორქბენჩი პაიპლაინის ასაგებად.'}
          </Typography>
        )}
      </Box>

      {/* ── THE DOOR — the ONE prominent primary action into the three-pane surface ──── */}
      {canWorkbench && (
        <Button
          variant="contained"
          startIcon={<LaunchIcon />}
          onClick={openWorkbench}
          data-testid="open-data-workbench"
          fullWidth
        >
          {en ? 'Open data workbench' : 'გახსენი ვორქბენჩი'}
        </Button>
      )}

      {/* ── QUICK-BIND — the one-gesture governed metric bind, UNBOUND elements only
          (Power BI fields-well class: a quick action, not an editor). ───────────────── */}
      {!bound && !nonShaped && (
        <MetricPalette
          locale={locale}
          canBind
          bindHint={en ? 'Or bind a governed metric directly' : 'ან პირდაპირ მიაბით მართული მეტრიკა'}
          onBind={(metricId) => onChange(bindMeasureToSpec(spec, metricId))}
        />
      )}

      {/* ── STEWARD lens — the raw DataSpec editor, retained (plane law; the ⛔ demotion
          is gated on ADR-047 Wave B and NOT fired here). Absent for the author plane. ── */}
      {isSteward && (
        <Accordion disableGutters variant="outlined" data-testid="data-facet-pipe">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" fontWeight={600}>
              {en ? 'Raw editor (steward)' : 'ნედლი რედაქტორი (სტიუარდი)'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Suspense fallback={<SuspenseFallback label={en ? 'Loading data editors' : 'იტვირთება რედაქტორები'} fill={false} />}>
              <DataSpecEditor value={spec ?? null} onChange={(next) => onChange(next)} />
            </Suspense>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}
