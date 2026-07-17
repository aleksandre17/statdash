// ── generatedQuery model tests (W-P2 · SPEC §3.3 / §9 E4) ─────────────────────────
//
//  The plane split, provably: the AUTHOR rendering speaks GOVERNED nouns and NEVER a
//  raw code (FF-AUTHOR-NO-QUERY); the STEWARD detail carries the raw wire truth. The
//  governed-vs-raw fixture is the heart of the gate — a spec whose filter pins a raw
//  member code + a raw dim code, asserted absent from the author steps and present in
//  the steward JSON.
//
import { describe, it, expect } from 'vitest'
import type { DataSpec } from '@statdash/engine'
import type { ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import { describeAuthorSteps, describeStewardDetail } from './generatedQuery'

type QuerySpec = Extract<DataSpec, { type: 'query' }>

// A governed resolver fixture: the bound metric's value column → its governed label,
// the raw dim code 'REGION' → its governed label, everything else honest-identity. This
// is exactly the shape buildColumnLabels produces (value→metric label, dim code→label).
const RAW_METRIC_CODE = 'B1GQ'         // the lowered SDMX measure code (steward-only)
const RAW_MEMBER_CODE = 'GE'           // a filter member value (never author-shown)
const govern: ColumnLabelResolver = (field) => {
  if (field === 'value' || field === 'measure') return 'Gross Domestic Product'
  if (field === 'REGION') return 'Region'
  if (field === 'value_growth') return 'value_growth' // a derived field — honest fallback
  return field
}

const spec: QuerySpec = {
  type:  'query',
  query: { measure: 'm.gdp', filter: { REGION: RAW_MEMBER_CODE } },
  pipe:  [
    { op: 'filter', where: { REGION: RAW_MEMBER_CODE } } as never,
    { op: 'sort', by: 'value', dir: 'asc' } as never,
    { op: 'derive', as: 'value_growth', expr: '$prev' } as never,
  ],
  encoding: { label: 'label' },
}

describe('describeAuthorSteps — the GOVERNED author rendering (FF-AUTHOR-NO-QUERY)', () => {
  const steps = describeAuthorSteps(spec, govern, 'en')

  it('the head is a Get step naming the bound metric by its GOVERNED label', () => {
    expect(steps[0].op).toBe('source')
    expect(steps[0].verb).toBe('Get: Gross Domestic Product')
    // the pinned dim shows its governed label, never the raw dim code
    expect(steps[0].nouns).toContain('Region')
    expect(steps[0].nouns).not.toContain('REGION')
  })

  it('each tail step gets a friendly verb (never the raw op tag alone)', () => {
    expect(steps.map((s) => s.verb)).toEqual([
      'Get: Gross Domestic Product', 'Filter', 'Sort', 'Derive',
    ])
    // the op is still carried (stable key / steward detail), but the author reads the verb
    expect(steps.map((s) => s.op)).toEqual(['source', 'filter', 'sort', 'derive'])
  })

  it('NEVER shows a raw SDMX code or a filter MEMBER value in ANY author string', () => {
    const allText = JSON.stringify(steps)
    expect(allText).not.toContain(RAW_METRIC_CODE) // the lowered measure code
    expect(allText).not.toContain(RAW_MEMBER_CODE) // the filter member value
    expect(allText).not.toContain('REGION')        // the raw dim code
  })

  it('resolves field-ref params to governed labels; a derived field falls back honestly', () => {
    const filterStep = steps[1]
    expect(filterStep.nouns).toEqual(['Region'])       // field:'REGION' → governed
    const sortStep = steps[2]
    expect(sortStep.nouns).toEqual(['Gross Domestic Product']) // by:'value' → metric label
    const deriveStep = steps[3]
    expect(deriveStep.nouns).toEqual(['value_growth']) // as: a NEW derived field, honest name
  })

  it('an unbound Get (no metric) declares an honest "pick a metric" prompt, not a raw blank', () => {
    const unbound = describeAuthorSteps(
      { type: 'query', query: { measure: [] }, pipe: [], encoding: { label: 'label' } },
      (f) => f, 'en',
    )
    expect(unbound[0].verb).toBe('Get: (pick a metric)')
  })

  it('is bilingual — Georgian verbs when locale=ka', () => {
    const ka = describeAuthorSteps(spec, govern, 'ka')
    expect(ka[0].verb.startsWith('წყარო:')).toBe(true)
    expect(ka[1].verb).toBe('ფილტრი')
  })
})

describe('describeStewardDetail — the raw wire truth (steward-only)', () => {
  it('carries the raw DataSpec JSON — the member/dim codes the author never sees', () => {
    const detail = describeStewardDetail(spec)
    expect(detail.json).toContain(RAW_MEMBER_CODE) // 'GE' — present for the steward
    expect(detail.json).toContain('REGION')
    expect(detail.json).toContain('m.gdp')
  })

  it('carries the lowered ObsQuery — the wire query the Get read resolves to', () => {
    const detail = describeStewardDetail(spec)
    // queryReadObs echoes the ObsQuery when no registry lowering is present — the wire
    // truth is present as a distinct, parseable block.
    const parsed = JSON.parse(detail.obsQuery)
    expect(parsed).toHaveProperty('measure')
  })
})
