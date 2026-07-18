// ── stepInput — the P-OFFER model over a step's input rows ─────────────────────────
//
//  Pins: (1) a step's INPUT rows = the previous step's OUTPUT (ONE derivation path);
//  (2) the offer's columns/values are GOVERNED (resolved through the same label seams
//  the grid speaks); (3) numeric detection; (4) hidden-field exclusion; (5) distinct,
//  label-sorted values.
//
import { describe, it, expect } from 'vitest'
import type { EngineRow } from '@statdash/engine'
import { buildStepInputOffer, stepInputRows } from './stepInput'
import type { ColumnLabelResolver } from './columnLabels'
import type { MemberLabelResolver } from './memberLabels'

const SOURCE: EngineRow[] = [
  { geo: 'GE', value: 100, measure: 'B1G' },
  { geo: 'AB', value: 200, measure: 'B1G' },
  { geo: 'GE', value: 300, measure: 'B1G' },
]

// governed label seams (the fakes the grid would supply)
const columnLabel: ColumnLabelResolver = (f) =>
  f === 'geo' ? 'გეოგრაფია' : f === 'value' ? 'შრომის ანაზღაურება' : f
const cellLabel: MemberLabelResolver = (f, v) =>
  f === 'geo' ? (v === 'GE' ? 'საქართველო' : v === 'AB' ? 'აფხაზეთი' : v) : v

describe('stepInputRows — a step INPUT is the PREVIOUS step output (ONE derivation path)', () => {
  it('step 0 input = the source (browse) rows', () => {
    expect(stepInputRows(SOURCE, [{ op: 'filter', where: { geo: 'GE' } }], 0)).toEqual(SOURCE)
  })

  it('step 1 input = the output AFTER step 0 (the filter applied)', () => {
    const tail = [{ op: 'filter', where: { geo: 'GE' } }] as never[]
    const input1 = stepInputRows(SOURCE, tail, 1)
    expect(input1).toHaveLength(2) // only the GE rows survive step 0
    expect(input1.every((r) => r.geo === 'GE')).toBe(true)
  })
})

describe('buildStepInputOffer — governed offers over the input rows', () => {
  const offer = buildStepInputOffer({ rows: SOURCE, columnLabel, cellLabel, locale: 'ka' })

  it('offers the columns with GOVERNED labels (option value = field key)', () => {
    expect(offer.columns.map((c) => c.field)).toContain('geo')
    expect(offer.columns.find((c) => c.field === 'geo')?.label).toBe('გეოგრაფია')
  })

  it('offers a column DISTINCT member values, governed-labeled + label-sorted', () => {
    const vals = offer.valuesFor('geo')
    expect(vals.map((v) => v.value)).toEqual(['AB', 'GE'])       // distinct, sorted by label
    expect(vals.map((v) => v.label)).toEqual(['აფხაზეთი', 'საქართველო'])
  })

  it('detects a numeric (value) column vs a categorical one', () => {
    expect(offer.isNumeric('value')).toBe(true)
    expect(offer.isNumeric('geo')).toBe(false)
  })

  it('excludes author-hidden fields (measure) from the offered columns', () => {
    const authored = buildStepInputOffer({
      rows: SOURCE, columnLabel, cellLabel, locale: 'ka', hiddenFields: new Set(['measure']),
    })
    expect(authored.columns.map((c) => c.field)).not.toContain('measure')
    expect(authored.columns.map((c) => c.field)).toEqual(['geo', 'value'])
  })
})
