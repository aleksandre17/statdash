// ── pipelinePreview unit tests (W-P1 · SPEC §3.2 / §9 E3, E5) ──────────────────
//
//  Proves the honest core: prefix-run correctness (the ONE engine seam), the
//  capped-count honesty, column derivation, and the honest-cell grammar (0 is ok,
//  null is a declared '—', never a fabricated 0).
//
import { describe, it, expect } from 'vitest'
import type { EngineRow, TransformStep } from '@statdash/engine'
import {
  deriveStepRows, capRows, deriveColumns, toGridCell,
  AS_OF_SOURCE, PREVIEW_CAP, MISSING_GLYPH,
} from './pipelinePreview'

const SOURCE: EngineRow[] = [
  { time: 2019, geo: 'GE', value: 10 },
  { time: 2020, geo: 'GE', value: 20 },
  { time: 2019, geo: 'AB', value: 5 },
  { time: 2020, geo: 'AB', value: 7 },
]

// A two-step pipe: keep geo=GE, then sum value → one row.
const PIPE: TransformStep[] = [
  { op: 'filter', where: { geo: 'GE' } } as TransformStep,
  { op: 'aggregate', by: ['geo'], measure: 'value', agg: 'sum', as: 'value' } as TransformStep,
]

describe('deriveStepRows — prefix run over the engine seam (SPEC §9 E5)', () => {
  it('AS_OF_SOURCE returns the source rows untouched (browse-first, E1)', () => {
    expect(deriveStepRows(SOURCE, PIPE, AS_OF_SOURCE)).toEqual(SOURCE)
  })

  it('empty pipe returns the source rows regardless of index', () => {
    expect(deriveStepRows(SOURCE, [], 3)).toEqual(SOURCE)
  })

  it('step 0 output = after the filter step only (2 GE rows)', () => {
    const rows = deriveStepRows(SOURCE, PIPE, 0)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.geo === 'GE')).toBe(true)
  })

  it('step 1 output = after filter + aggregate (one summed row)', () => {
    const rows = deriveStepRows(SOURCE, PIPE, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe(30) // 10 + 20
  })

  it('an index past the pipe end clamps to the full pipe (no over-run)', () => {
    expect(deriveStepRows(SOURCE, PIPE, 99)).toEqual(deriveStepRows(SOURCE, PIPE, 1))
  })

  it('selecting a step is a PURE re-slice — the same source object yields each output', () => {
    // No mutation of SOURCE across successive step selections (no hidden cache).
    const s0 = deriveStepRows(SOURCE, PIPE, AS_OF_SOURCE)
    const s1 = deriveStepRows(SOURCE, PIPE, 0)
    expect(s0).toEqual(SOURCE)
    expect(s1).toHaveLength(2)
    expect(SOURCE).toHaveLength(4) // source never mutated
  })
})

describe('capRows — honest capped preview (SPEC §9 E3)', () => {
  it('under the cap: all rows, not capped, honest total', () => {
    const r = capRows(SOURCE)
    expect(r.rows).toHaveLength(4)
    expect(r.total).toBe(4)
    expect(r.capped).toBe(false)
  })

  it('over the cap: first N rows, capped flag, TRUE total (never silent)', () => {
    const many: EngineRow[] = Array.from({ length: PREVIEW_CAP + 12 }, (_, i) => ({ i }))
    const r = capRows(many)
    expect(r.rows).toHaveLength(PREVIEW_CAP)
    expect(r.total).toBe(PREVIEW_CAP + 12)
    expect(r.capped).toBe(true)
  })

  it('respects a custom cap', () => {
    const r = capRows(SOURCE, 2)
    expect(r.rows).toHaveLength(2)
    expect(r.total).toBe(4)
    expect(r.capped).toBe(true)
  })
})

describe('deriveColumns — first-seen field order across rows', () => {
  it('unions fields in stable first-seen order', () => {
    expect(deriveColumns(SOURCE)).toEqual(['time', 'geo', 'value'])
  })

  it('picks up fields that appear only in later rows', () => {
    const rows: EngineRow[] = [{ a: 1 }, { a: 2, b: 3 }]
    expect(deriveColumns(rows)).toEqual(['a', 'b'])
  })

  it('empty rows → no columns', () => {
    expect(deriveColumns([])).toEqual([])
  })
})

describe('toGridCell — honest-cell grammar (Law 11 / FF-CANVAS-NEVER-LIES)', () => {
  it('a genuine 0 is OK and renders the honest text "0" (never blank)', () => {
    expect(toGridCell(0)).toEqual({ state: 'ok', text: '0' })
  })

  it('null → a declared no-data "—", never a fabricated 0', () => {
    expect(toGridCell(null)).toEqual({ state: 'no-data', text: MISSING_GLYPH })
  })

  it('undefined (missing field) → no-data "—"', () => {
    expect(toGridCell(undefined)).toEqual({ state: 'no-data', text: MISSING_GLYPH })
  })

  it('empty string → no-data "—" (blank is not information)', () => {
    expect(toGridCell('')).toEqual({ state: 'no-data', text: MISSING_GLYPH })
  })

  it('a string dim value passes through as ok', () => {
    expect(toGridCell('GE')).toEqual({ state: 'ok', text: 'GE' })
  })

  it('a tagged/bilingual LocaleString cell localizes (never "[object Object]")', () => {
    const cell = toGridCell({ ka: 'საქართველო', en: 'Georgia' } as never, 'en')
    expect(cell).toEqual({ state: 'ok', text: 'Georgia' })
  })
})
