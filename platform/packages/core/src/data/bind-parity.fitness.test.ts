// ── FF-BIND-PARITY — bind-via-metric ≡ hand-authored DataSpec [AR-49 / M0 · item 11] ──
//
//  THE load-bearing compatibility contract of the whole M0 milestone (SPEC
//  `SPEC-authoring-reconception-M0.md` §3): a block whose measure is a METRIC-ID
//  (bound via the Metric Palette) must interpret to output that is DEEP-EQUAL to the
//  SAME block HAND-AUTHORED with the metric's underlying raw code(s) + its governance
//  applied as DataSpec defaults. "Bind block to metric" writes a metric-id into the
//  block's EXISTING measure field — there is NO new runtime lowering; the metric-id →
//  code+governance expansion is the already-live resolveMeasureRef seam (ADR R1). If
//  this parity ever breaks, binding would silently diverge from the steward's
//  hand-authored config, and the milestone's "breaks nothing" guarantee falls.
//
//  Scope here = the CORE seams named in item 11: interpretSpec (a chart/query
//  DataSpec) and interpretKpi (a KPI). The panel-side FFs (governed picker, palette,
//  catalog discovery) are a later step — they wait for the palette.
//
//  resolveMeasureRef mutates a process-global registry; every metric below uses a
//  `metric:`-prefixed id that can NEVER collide with a raw SDMX code in a fixture, so
//  the raw-code (hand-authored) side is never contaminated.
//
import { describe, it, expect, beforeEach } from 'vitest'

import { interpretSpec }              from './spec'
import { interpretKpi }              from './kpi'
import { resolveMeasureRef, registerMetric } from './metric'
import { ExternalStore }             from './store-impl'
import type { SectionContext }       from '../core/context'
import type { Observation }          from '../sdmx'
import type { KpiSpec, DimFilter }   from './kpi'

const ctx: SectionContext = { dims: { time: 2023, geo: 'GE' } }

// A dataset with BOTH an S (seasonally-adjusted) and N slice of the same code, so a
// metric whose governance pins { adjustment: 'S' } demonstrably selects a DIFFERENT
// slice than the unfiltered code — the parity is over a real governance effect, not a
// no-op.
const obs: Observation[] = [
  { measure: 'B1G', value: 1000, time: 2023, geo: 'GE', adjustment: 'S', label: 'GDP' },
  { measure: 'B1G', value: 1100, time: 2023, geo: 'GE', adjustment: 'N', label: 'GDP' },
  { measure: 'B1G', value:  900, time: 2022, geo: 'GE', adjustment: 'S', label: 'GDP' },
]
const store = new ExternalStore(obs)

// The governed metric an author binds to. Its underlying code is 'B1G'; its governance
// (a default dim { adjustment: 'S' }) is what a hand-author would have to spell out.
beforeEach(() => {
  registerMetric('metric:gdp-real', {
    code:        'B1G',
    label:       { en: 'GDP · real' },
    unit:        { en: 'million GEL' },
    format:      'mln_gel',
    methodology: 'https://example.org/methodology/gdp',
    dims:        { adjustment: 'S' },
  })
})

// A tiny guard against a FALSE green: prove the metric-id genuinely lowers to code +
// governance while the raw code carries none, so the two specs under test really are
// different INPUTS that resolution folds to the same OUTPUT (not two identical strings).
describe('FF-BIND-PARITY — the resolution is non-trivial (guards a false green)', () => {
  it('the metric-id expands to code + default dims; the raw code carries neither', () => {
    expect(resolveMeasureRef('metric:gdp-real').codes).toEqual(['B1G'])
    expect(resolveMeasureRef('metric:gdp-real').dims).toEqual({ adjustment: 'S' })
    expect(resolveMeasureRef('B1G').codes).toEqual(['B1G'])
    expect(resolveMeasureRef('B1G').dims).toBeUndefined()
  })
})

// ── Chart parity — interpretSpec(metric-id) ≡ interpretSpec(raw code + governance) ──
//
//  A `query` DataSpec routes its measure through resolveQueryMeasures → resolveMeasureRef
//  (QueryResolver), which substitutes the underlying code AND merges the metric's default
//  dims into the query filter as DEFAULTS (explicit filter wins). So the hand-authored
//  equivalent of a metric-bound chart is the raw code with the metric's dims spelled out
//  as an explicit filter.
describe('FF-BIND-PARITY — chart: a metric-bound query ≡ the hand-authored raw-code query', () => {
  const boundSpec = {
    type: 'query', query: { measure: 'metric:gdp-real' },
    encoding: { label: 'label', value: 'value' },
  } as const
  const handAuthoredSpec = {
    type: 'query', query: { measure: 'B1G', filter: { adjustment: 'S' } },
    encoding: { label: 'label', value: 'value' },
  } as const

  it('interpretSpec output is deep-equal', () => {
    const bound        = interpretSpec(boundSpec, ctx, store)
    const handAuthored = interpretSpec(handAuthoredSpec, ctx, store)
    expect(bound).toEqual(handAuthored)
  })

  it('the parity is over REAL rows — the governed S-slice, never the N slice', () => {
    const bound = interpretSpec(boundSpec, ctx, store)
    expect(bound.length).toBeGreaterThan(0)
    expect(bound.map((r) => r.value)).toEqual([1000, 900])   // the two S rows
    expect(bound.map((r) => r.value)).not.toContain(1100)    // N excluded by the metric default
  })
})

// ── KPI parity — interpretKpi(metric-id) ≡ interpretKpi(raw code + governed filter) ──
//
//  CORRECTED SEMANTICS (AR-49 M0 QC fix — the "one governed number on every surface" DoD):
//  a KPI point/yoy read now routes its measure's GOVERNED default dims into the read
//  coordinate — the KPI read-path twin of the query path (both compose metric defaults via
//  the SHARED mergeMetricDims). So the faithful hand-authored equivalent of a metric-bound
//  KPI is the underlying code with the metric's default dims spelled out as the KPI's
//  explicit `filter`. The KPI's OWN filter WINS on collision (metric dims FILL only the
//  dims the author left unpinned) — proven by the override case below. The load-bearing
//  contract: a metric-bound KPI and its hand-authored governed equivalent render the SAME
//  number, and that number is the metric's governed slice — never the ungoverned raw sum.
describe('FF-BIND-PARITY — kpi: a metric-bound KPI ≡ the hand-authored raw-code + governed-filter KPI', () => {
  const pointKpi = (measure: string, filter?: DimFilter): KpiSpec => ({
    id: 'gdp', label: { en: 'GDP' }, color: '#000',
    value: { type: 'point', measure, format: 'mln_gel', ...(filter ? { filter } : {}) },
  })
  const yoyKpi = (measure: string, filter?: DimFilter): KpiSpec => ({
    id: 'gdp-yoy', label: { en: 'GDP growth' }, color: '#000',
    value: { type: 'yoy', measure, ...(filter ? { filter } : {}) },
  })

  it('a point KPI: interpretKpi(metric-id) deep-equals interpretKpi(code + {adjustment:S})', () => {
    const bound        = interpretKpi(pointKpi('metric:gdp-real'),               ctx, store)
    const handAuthored = interpretKpi(pointKpi('B1G', { adjustment: 'S' }),      ctx, store)
    expect(bound).toEqual(handAuthored)
  })

  it('the KPI FOLDS the metric default — reads the governed S slice (1000), NOT the raw S+N sum (2100)', () => {
    // The teeth of the fix: a bare raw-code KPI (no filter) sums BOTH the S and N slices;
    // the metric-bound KPI honors the metric default {adjustment:'S'} and reads S only.
    // If the metric default were dropped (the pre-fix asymmetry), these would be EQUAL.
    const bound  = interpretKpi(pointKpi('metric:gdp-real'), ctx, store)
    const rawAll = interpretKpi(pointKpi('B1G'),             ctx, store)
    const govHand = interpretKpi(pointKpi('B1G', { adjustment: 'S' }), ctx, store)
    expect(bound.value).toEqual(govHand.value)
    expect(bound.value).not.toEqual(rawAll.value)
  })

  it('a yoy KPI (reads t AND t-1): interpretKpi(metric-id) deep-equals interpretKpi(code + {adjustment:S})', () => {
    const bound        = interpretKpi(yoyKpi('metric:gdp-real'),           ctx, store)
    const handAuthored = interpretKpi(yoyKpi('B1G', { adjustment: 'S' }),  ctx, store)
    expect(bound).toEqual(handAuthored)
  })

  it('explicit KPI filter WINS over a conflicting metric default (metric pins S, KPI pins N)', () => {
    const boundN       = interpretKpi(pointKpi('metric:gdp-real', { adjustment: 'N' }), ctx, store)
    const handAuthored = interpretKpi(pointKpi('B1G',             { adjustment: 'N' }), ctx, store)
    expect(boundN).toEqual(handAuthored)
    // and it really is the N slice (1100), NOT the metric's S default (1000)
    const boundDefault = interpretKpi(pointKpi('metric:gdp-real'), ctx, store)
    expect(boundN.value).not.toEqual(boundDefault.value)
  })

  it('the parity is over a REAL read (non-zero) — not a degenerate empty/zero value', () => {
    // A KPI on an UNREGISTERED, dataless code resolves to 0; the metric-bound KPI reads
    // real data — so equality above is a substantive value match, not "0 === 0".
    const bound = interpretKpi(pointKpi('metric:gdp-real'), ctx, store)
    const empty = interpretKpi(pointKpi('NO_SUCH_CODE'),    ctx, store)
    expect(bound.value).not.toBe(empty.value)
  })
})
