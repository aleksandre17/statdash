// ── PipelineStepGrid — the live per-step grid, wired (SPEC §3.2 · W-P1) ────────
//
//  The container that binds the pure grid to live data: it resolves the SOURCE
//  rows off the cube (usePipelineSourceRows), derives the rows AT THE SELECTED
//  step by pure prefix-run (deriveStepRows — the ONE engine seam, no cache), caps
//  them honestly (E3), and speaks governed column headers (buildColumnLabels off
//  describeApp). Selecting a different step re-slices already-resolved rows — no
//  re-fetch.
//
//  Two forms share ONE view:
//    • PipelineStepGrid     — self-resolving (calls usePipelineSourceRows). The
//                             standalone form (QuerySpecEditor, the journey gate).
//    • PipelineStepGridView — the source rows passed IN. The workbench lifts the
//                             ONE source read to DataWorkbench (so the step-editor
//                             OFFERS derive from the SAME rows — never a 2nd fetch)
//                             and hands them here.
//
import type { WorkbenchModel } from '../workbench/workbenchModel'
import { usePipelineSourceRows, type PipelineSource } from './usePipelineSourceRows'
import { useGridLabels } from './useGridLabels'
import { deriveStepRows, capRows, deriveColumns, AS_OF_SOURCE, AUTHOR_HIDDEN_FIELDS } from './pipelinePreview'
import { PipelineDataGrid } from './PipelineDataGrid'

export interface PipelineStepGridProps {
  /** The canonical pipeline view — the source HEAD + the pure TAIL (spine-agnostic:
   *  a legacy `query` and a native `pipeline` both arrive here as ONE model). */
  model:    WorkbenchModel
  /** The "as-of" step the grid shows the output of: AS_OF_SOURCE (-1) = the Get
   *  read; 0..tail.length-1 = after that tail step. */
  asOfStep: number
}

export interface PipelineStepGridViewProps extends PipelineStepGridProps {
  /** The resolved SOURCE read — lifted out so the workbench shares ONE derivation
   *  path between the grid and the step-editor offers. */
  source:   PipelineSource
}

// ── PipelineStepGridView — the pure view (source rows passed in) ────────────────
export function PipelineStepGridView({ model, asOfStep, source }: PipelineStepGridViewProps) {
  const { locale, en, isAuthor, columnLabel, cellLabel } = useGridLabels(model.head)
  const tail = model.tail

  // Prefix-run the tail to the selected step (pure — no re-fetch on step change).
  // Fail-soft: an incomplete step mid-authoring (e.g. a half-typed derive expr) can
  // throw in the engine op — surface the HONEST error state, never crash the editor
  // (the canvas fail-soft law); the same throw is caught by NodeErrorBoundary at
  // render time on the published path.
  let derivationError = false
  let stepRows: ReturnType<typeof deriveStepRows> = source.sourceRows
  try {
    stepRows = deriveStepRows(source.sourceRows, tail, asOfStep, source.pipeCtx)
  } catch {
    derivationError = true
  }
  const capped = capRows(stepRows)
  const status = source.status === 'ok' && derivationError ? 'error' : source.status

  // The author plane hides the SDMX plumbing echoes (measure dedup + obsStatus); the
  // steward plane keeps every column. Law 11: an author never sees a raw flow code.
  const columns = deriveColumns(capped.rows)
    .filter((c) => !(isAuthor && AUTHOR_HIDDEN_FIELDS.has(c)))

  const metricName = columnLabel('value')
  const caption = asOfStep <= AS_OF_SOURCE
    ? (en ? `Get: ${metricName}` : `წყარო: ${metricName}`)
    : (en ? `Step ${asOfStep + 1}: ${tail[asOfStep]?.op ?? ''}` : `ნაბიჯი ${asOfStep + 1}: ${tail[asOfStep]?.op ?? ''}`)

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

// ── PipelineStepGrid — the self-resolving form (standalone) ─────────────────────
export function PipelineStepGrid({ model, asOfStep }: PipelineStepGridProps) {
  const source = usePipelineSourceRows(model.head, model.encoding)
  return <PipelineStepGridView model={model} asOfStep={asOfStep} source={source} />
}
