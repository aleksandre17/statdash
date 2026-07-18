// ── FF-EXPR-SCOPE-SSOT + agnostic offer (card 0087) ────────────────────────────────
//
//  Two invariants of the P-OFFER expr projection:
//   1. FF-EXPR-SCOPE-SSOT — what the expr editor OFFERS as scope equals what the
//      evaluator RESOLVES for that step. Both derive from the SAME StepInputOffer (the
//      input columns), so there is no parallel hand-list and no second interpretation:
//      every offered identifier resolves; the preview uses the ONE evaluator (applyStep).
//   2. AGNOSTIC — the offer (columns + members + scope) comes ONLY from the live input
//      rows. A dimension NEVER seen before appears in the offers with ZERO code change
//      (Law 1) — proven by feeding a fixture with an unseen dim.
//
import { describe, it, expect } from 'vitest'
import type { EngineRow, TransformStep } from '@statdash/engine'
import { buildStepInputOffer } from './stepInput'
import { deriveColumns } from './pipelinePreview'
import { exprScopeSuggestions, previewStep } from './exprStepScope'

const passthru = {
  columnLabel: (f: string) => f,
  cellLabel: (_f: string, v: unknown) => String(v),
  locale: 'en',
}

const ROWS: EngineRow[] = [
  { geo: 'GE', year: 2020, value: 10, total: 100 },
  { geo: 'AB', year: 2021, value: 30, total: 100 },
]

describe('FF-EXPR-SCOPE-SSOT — offered scope == what the evaluator resolves', () => {
  it('the offered identifiers are EXACTLY the evaluator-resolvable input columns', () => {
    const offer = buildStepInputOffer({ rows: ROWS, ...passthru })
    const offered = exprScopeSuggestions(offer.columns, 'en')
      .filter((s) => s.kind === 'var')
      .map((s) => s.insert)
      .sort()
    // The evaluator reads bare identifiers from the row — i.e. the deriveColumns set.
    const resolvable = deriveColumns(ROWS).sort()
    expect(offered).toEqual(resolvable)
    expect(offered).toEqual(offer.columns.map((c) => c.field).sort())
  })

  it('every offered identifier RESOLVES in the live preview (via the ONE evaluator)', () => {
    const offer = buildStepInputOffer({ rows: ROWS, ...passthru })
    for (const col of offer.columns) {
      const step: TransformStep = { op: 'derive', as: '__p__', expr: col.field }
      const preview = previewStep(step, '__p__', offer.sampleRows, 'en')
      expect(preview.error, `offered '${col.field}' must resolve`).toBeUndefined()
      // The derived column equals the row's own value for that field (identity read).
      expect(preview.rows.map((r) => String(r.value)))
        .toEqual(ROWS.map((r) => String(r[col.field])))
    }
  })

  it('a real formula previews the computed value per row through applyStep', () => {
    const offer = buildStepInputOffer({ rows: ROWS, ...passthru })
    const step: TransformStep = { op: 'derive', as: 'share', expr: 'value / total * 100' }
    const preview = previewStep(step, 'share', offer.sampleRows, 'en')
    expect(preview.error).toBeUndefined()
    expect(preview.rows.map((r) => Number(r.value))).toEqual([10, 30])
  })

  it('a malformed formula yields a friendly error, never a raw trace', () => {
    const offer = buildStepInputOffer({ rows: ROWS, ...passthru })
    const step: TransformStep = { op: 'derive', as: 'x', expr: 'value / (' }
    const preview = previewStep(step, 'x', offer.sampleRows, 'en')
    expect(preview.error).toBeTruthy()
    expect(preview.rows).toEqual([])
  })
})

describe('AGNOSTIC — an unseen dimension joins the offers with zero code change (Law 1)', () => {
  it('a brand-new dim in the rows appears in the columns AND the expr scope', () => {
    const unseen: EngineRow[] = [
      { sector: 'A01', occupation: 'X9', metric_never_coded_before: 42 },
    ]
    const offer = buildStepInputOffer({ rows: unseen, ...passthru })
    const cols = offer.columns.map((c) => c.field)
    expect(cols).toContain('sector')
    expect(cols).toContain('occupation')
    expect(cols).toContain('metric_never_coded_before')
    // And they are offered as expr scope — no configured list, purely data-derived.
    const scope = exprScopeSuggestions(offer.columns, 'en').filter((s) => s.kind === 'var').map((s) => s.insert)
    expect(scope).toContain('metric_never_coded_before')
    // Its members are offered too (the AutoFilter list), from the data alone.
    expect(offer.valuesFor('sector').map((v) => v.value)).toEqual(['A01'])
  })
})
