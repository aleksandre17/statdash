// ── PipelineStepGrid — the live per-step grid, wired (SPEC §3.2 · W-P1) ────────
//
//  The container that binds the pure grid to live data: it resolves the SOURCE
//  rows off the cube (usePipelineSourceRows), derives the rows AT THE SELECTED
//  step by pure prefix-run (deriveStepRows — the ONE engine seam, no cache), caps
//  them honestly (E3), and speaks governed column headers (buildColumnLabels off
//  describeApp). Selecting a different step re-slices already-resolved rows — no
//  re-fetch. Composable: W-P2 re-homes this verbatim into the three-pane shell.
//
import type { DataSpec } from '@statdash/engine'
import { useMetricCatalog } from '../../../discovery/useMetricCatalog'
import { useActiveProfile, profileOrNull } from '../../../discovery/useActiveProfile'
import { useActiveLocales } from '../../../inspector/useActiveLocales'
import { useRole } from '../../../studio/useRole'
import type { Locale } from '../../../types/constructor'
import { usePipelineSourceRows } from './usePipelineSourceRows'
import { deriveStepRows, capRows, deriveColumns, AS_OF_SOURCE } from './pipelinePreview'
import { buildColumnLabels, type ColumnLabelResolver } from './columnLabels'
import { buildMemberLabels, rawMemberLabels, type MemberLabelResolver } from './memberLabels'
import { PipelineDataGrid } from './PipelineDataGrid'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

/** SDMX plumbing echoes hidden from the AUTHOR plane (SPEC §3.4 — no plumbing tokens):
 *  `measure` is the flow-code column that duplicates the metric label (the value column
 *  already carries it — dedupe), `obsStatus` is data-quality provenance for the steward.
 *  The steward plane sees them RAW. Law 1: named by their reserved obs-column keys, not
 *  by any business dimension. */
const AUTHOR_HIDDEN_FIELDS = new Set(['measure', 'obsStatus'])

export interface PipelineStepGridProps {
  spec:     QuerySpec
  /** The "as-of" step the grid shows the output of: AS_OF_SOURCE (-1) = the Get
   *  read; 0..pipe.length-1 = after that pipe step. */
  asOfStep: number
}

export function PipelineStepGrid({ spec, asOfStep }: PipelineStepGridProps) {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const en = locale === 'en'
  const catalog = useMetricCatalog()
  const profile = profileOrNull(useActiveProfile())
  const role = useRole()
  const source = usePipelineSourceRows(spec)

  const pipe = spec.pipe ?? []

  // Prefix-run the pipe to the selected step (pure — no re-fetch on step change).
  // Plain consts: the React Compiler memoizes these; a manual useMemo returning a
  // closure trips "could not preserve memoization" (a known compiler seam).
  // Fail-soft: an incomplete step mid-authoring (e.g. a half-typed derive expr) can
  // throw in the engine op — surface the HONEST error state, never crash the editor
  // (the canvas fail-soft law); the same throw is caught by NodeErrorBoundary at
  // render time on the published path.
  let derivationError = false
  let stepRows: ReturnType<typeof deriveStepRows> = source.sourceRows
  try {
    stepRows = deriveStepRows(source.sourceRows, pipe, asOfStep, source.pipeCtx)
  } catch {
    derivationError = true
  }
  const capped   = capRows(stepRows)
  const status   = source.status === 'ok' && derivationError ? 'error' : source.status

  // The author plane hides the SDMX plumbing echoes (measure dedup + obsStatus); the
  // steward plane keeps every column. Law 11: an author never sees a raw flow code.
  const isAuthor = role !== 'steward'
  const columns  = deriveColumns(capped.rows)
    .filter((c) => !(isAuthor && AUTHOR_HIDDEN_FIELDS.has(c)))

  const columnLabel: ColumnLabelResolver = catalog.status !== 'ready'
    ? (field: string) => field
    : buildColumnLabels({
        metrics:    catalog.metrics,
        dimensions: catalog.dimensions,
        query:      spec.query,
        locale,
      })

  // The CELL resolver: governed member labels in the author plane (adjara→აჭარა, _T→
  // Total), raw codes in the steward plane / before the profile is ready.
  const cellLabel: MemberLabelResolver = isAuthor && profile
    ? buildMemberLabels(profile, locale)
    : rawMemberLabels

  const metricName = columnLabel('value')
  const caption = asOfStep <= AS_OF_SOURCE
    ? (en ? `Get: ${metricName}` : `წყარო: ${metricName}`)
    : (en ? `Step ${asOfStep + 1}: ${pipe[asOfStep]?.op ?? ''}` : `ნაბიჯი ${asOfStep + 1}: ${pipe[asOfStep]?.op ?? ''}`)

  return (
    <PipelineDataGrid
      status={status}
      rows={capped.rows}
      total={capped.total}
      capped={capped.capped}
      columns={columns}
      columnLabel={columnLabel}
      cellLabel={cellLabel}
      caption={caption}
      locale={locale}
    />
  )
}
