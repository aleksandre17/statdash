// ── generatedQuery model tests (W-P2/W-P5b · SPEC §3.3 / §9 E4) ───────────────────
//
//  The plane split, provably, over the canonical PIPELINE view (WorkbenchModel): the
//  AUTHOR rendering speaks GOVERNED nouns and NEVER a raw code (FF-AUTHOR-NO-QUERY); the
//  STEWARD detail carries the raw wire truth. The governed-vs-raw fixture is the heart of
//  the gate — a governed source head + a filter pinning a raw member code, asserted
//  absent from the author steps and present in the steward JSON.
//
import { describe, it, expect } from 'vitest'
import type { SourceStep, TransformStep } from '@statdash/engine'
import type { ColumnLabelResolver } from '../pipeline-preview/columnLabels'
import { describeAuthorSteps, describeStewardDetail } from './generatedQuery'
import type { WorkbenchModel } from './workbenchModel'

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

// A GOVERNED source head (the emission-flip shape) that pins a raw member code via `where`.
const govHead: SourceStep = { op: 'source', metrics: ['m.gdp'], where: { REGION: RAW_MEMBER_CODE } }
const tail: TransformStep[] = [
  { op: 'filter', where: { REGION: RAW_MEMBER_CODE } } as never,
  { op: 'sort', by: 'value', dir: 'asc' } as never,
  { op: 'derive', as: 'value_growth', expr: '$prev' } as never,
]
const model: WorkbenchModel = { head: govHead, tail, encoding: { label: 'label' } }

describe('describeAuthorSteps — the GOVERNED author rendering (FF-AUTHOR-NO-QUERY)', () => {
  const steps = describeAuthorSteps(model, govern, 'en')

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
    expect(steps.map((s) => s.op)).toEqual(['source', 'filter', 'sort', 'derive'])
  })

  it('NEVER shows a raw SDMX code or a filter MEMBER value in ANY author string', () => {
    const allText = JSON.stringify(steps)
    expect(allText).not.toContain(RAW_METRIC_CODE) // the lowered measure code
    expect(allText).not.toContain(RAW_MEMBER_CODE) // the filter member value
    expect(allText).not.toContain('REGION')        // the raw dim code
  })

  it('resolves field-ref params to governed labels; a derived field falls back honestly', () => {
    expect(steps[1].nouns).toEqual(['Region'])                    // filter field:'REGION' → governed
    expect(steps[2].nouns).toEqual(['Gross Domestic Product'])    // sort by:'value' → metric label
    expect(steps[3].nouns).toEqual(['value_growth'])              // derive as: a NEW derived field
  })

  it('a truly-empty pipeline (no metric, no steps) renders NOTHING — no vestigial Get one-liner', () => {
    // SPEC §9 / Law 11: an empty pipe must not paint a lonely "Get: (pick a metric)" line.
    const empty = describeAuthorSteps(
      { head: { op: 'source', metrics: [] }, tail: [], encoding: { label: 'label' } },
      (f) => f, 'en',
    )
    expect(empty).toEqual([])
  })

  it('an unbound Get WITH steps still declares an honest "pick a metric" Get prompt', () => {
    const withSteps = describeAuthorSteps(
      { head: { op: 'source', metrics: [] }, tail: [{ op: 'sort', by: 'value', dir: 'asc' } as never], encoding: { label: 'label' } },
      (f) => f, 'en',
    )
    expect(withSteps[0].verb).toBe('Get: (pick a metric)')
  })

  it('is bilingual — Georgian verbs when locale=ka', () => {
    const ka = describeAuthorSteps(model, govern, 'ka')
    expect(ka[0].verb.startsWith('წყარო:')).toBe(true)
    expect(ka[1].verb).toBe('ფილტრი')
  })
})

describe('describeStewardDetail — the raw wire truth (steward-only)', () => {
  it('carries the raw pipeline DataSpec JSON — the member/dim codes the author never sees', () => {
    const detail = describeStewardDetail(model)
    expect(detail.json).toContain(RAW_MEMBER_CODE) // 'GE' — present for the steward
    expect(detail.json).toContain('REGION')
    expect(detail.json).toContain('m.gdp')
    expect(detail.json).toContain('"type": "pipeline"') // the emitted spine
  })

  it('a steward query head carries the lowered ObsQuery — the wire query the Get read resolves to', () => {
    const stewardModel: WorkbenchModel = {
      head: { op: 'source', query: { measure: 'm.gdp', filter: { REGION: RAW_MEMBER_CODE } } },
      tail: [], encoding: { label: 'label' },
    }
    const detail = describeStewardDetail(stewardModel)
    const parsed = JSON.parse(detail.obsQuery)
    expect(parsed).toHaveProperty('measure')
  })

  it('a governed head declares its metric-resolver lowering honestly (no faked ObsQuery)', () => {
    const detail = describeStewardDetail(model)
    expect(detail.obsQuery).toContain('governed source')
  })
})
