// ── R1 fitness nets — semantic layer wired into the binding path [N26] ─
//
//  Locks the ADR R1 invariants (adr_data_reference_render_vision):
//    FF-METRIC-FLOWS        — a query referencing a metric-id resolves to the
//                             metric's underlying code AND its unit/methodology/
//                             default-dims flow onto the resolved query/output.
//    FF-ONE-RESOLUTION-PATH — measure references resolve through the single
//                             resolveMeasureRef seam (no parallel re-impl).
//    FF-RAW-CODE-IDENTICAL  — a raw-code query produces byte-identical resolved
//                             rows before/after R1 (the Postel guarantee).
//
//  resolveMeasureRef mutates a process-global registry; every test that
//  registers a metric uses a metric-id that is NOT a raw SDMX code in the
//  fixtures, so raw-code paths are never contaminated.
//
import { readFileSync } from 'fs'
import { resolve }      from 'path'
import { describe, it, expect, beforeEach } from 'vitest'

import { interpretSpec, extractRequirements } from './spec'
import { resolveMeasureRef, registerMetric, withMetricProvenance } from './metric'
import { resolveQueryMeasures }   from '../registry/resolvers'
import { ExternalStore }          from './store-impl'
import type { SectionContext }    from '../core/context'
import type { Observation }       from '../sdmx'
import type { MetadataPort }      from '../core/provenance'

const ctx: SectionContext = { dims: { time: 2023, geo: 'GE' } }

const obs: Observation[] = [
  { measure: 'B1G', value: 1000, time: 2023, geo: 'GE', adjustment: 'S', label: 'GDP' },
  { measure: 'B1G', value: 1100, time: 2023, geo: 'GE', adjustment: 'N', label: 'GDP' },
  { measure: 'B1G', value:  900, time: 2022, geo: 'GE', adjustment: 'S', label: 'GDP' },
  { measure: 'D1',  value:  500, time: 2023, geo: 'GE', label: 'Wages' },
]
const store = new ExternalStore(obs)

// Register the metric fixtures once. Ids deliberately use a `metric:` prefix so
// they can never collide with a raw SDMX code used as a measure in any config.
beforeEach(() => {
  registerMetric('metric:gdp', {
    code:        'B1G',
    label:       { en: 'Gross Domestic Product' },
    unit:        { en: 'million GEL' },
    methodology: 'https://example.org/methodology/gdp',
    agg:         'last',
    dims:        { adjustment: 'S' },
  })
  registerMetric('metric:gdp-raw', {
    code:  'B1G',
    label: { en: 'GDP (no governance)' },
  })
})

// ── FF-RAW-CODE-IDENTICAL ──────────────────────────────────────────────

describe('FF-RAW-CODE-IDENTICAL — raw codes are byte-identical post-R1', () => {
  it('resolveMeasureRef passes an unregistered raw code through unchanged', () => {
    expect(resolveMeasureRef('B1G')).toEqual({ codes: ['B1G'] })
    expect(resolveMeasureRef(['B1G', 'D1'])).toEqual({ codes: ['B1G', 'D1'] })
  })

  it('resolveQueryMeasures returns the SAME object reference for a raw-code query (identity)', () => {
    const q = { measure: 'D1', filter: { geo: { $ctx: 'geo' } } }
    // No metric, no dims to merge ⇒ identity (proves zero allocation / zero mutation).
    expect(resolveQueryMeasures(q)).toBe(q)
  })

  it('a raw-code query spec resolves to identical rows', () => {
    const rows = interpretSpec(
      { type: 'query', query: { measure: 'D1' }, encoding: { label: 'label', value: 'value' } },
      ctx, store,
    )
    expect(rows).toEqual([{ measure: 'D1', value: 500, time: 2023, geo: 'GE', label: 'Wages' }])
  })

  it('raw-code extractRequirements are unchanged', () => {
    const reqs = extractRequirements(
      { type: 'timeseries', code: 'D1', years: [2023] }, ctx,
    )
    expect(reqs).toEqual([{ code: 'D1', dims: { time: 2023, geo: 'GE' } }])
  })
})

// ── FF-METRIC-FLOWS ────────────────────────────────────────────────────

describe('FF-METRIC-FLOWS — a metric-id flows code + governance', () => {
  it('resolveMeasureRef expands a metric-id to its code + governance', () => {
    expect(resolveMeasureRef('metric:gdp')).toEqual({
      codes:       ['B1G'],
      unit:        { en: 'million GEL' },
      methodology: 'https://example.org/methodology/gdp',
      agg:         'last',
      dims:        { adjustment: 'S' },
    })
  })

  it('a query referencing a metric-id resolves to the underlying code', () => {
    const q = resolveQueryMeasures({ measure: 'metric:gdp' })
    expect(q.measure).toBe('B1G')
  })

  it('the metric default dim seeds the query filter (governance flows onto the query)', () => {
    const q = resolveQueryMeasures({ measure: 'metric:gdp' })
    expect(q.filter).toEqual({ adjustment: 'S' })
  })

  it('a metric-id query selects the metric-default slice from the store', () => {
    // adjustment:'S' default ⇒ the two S rows (2023→1000, 2022→900), never the
    // N row (1100). _observe matches on query.filter only, so both years return.
    const rows = interpretSpec(
      { type: 'query', query: { measure: 'metric:gdp' }, encoding: { label: 'label', value: 'value' } },
      ctx, store,
    )
    expect(rows.map((r) => r.value)).toEqual([1000, 900])
    expect(rows.map((r) => r.value)).not.toContain(1100) // N slice excluded by the metric default
  })

  it('a metric-id timeseries resolves to the underlying code', () => {
    const rows = interpretSpec(
      { type: 'timeseries', code: 'metric:gdp', years: [2022, 2023] },
      ctx, store,
    )
    // metric:gdp → B1G; values present for both years (adjustment summed by storeVal).
    expect(rows).toHaveLength(2)
    expect(rows[1].value).toBeGreaterThan(0)
  })

  it('extractRequirements warms the underlying code for a metric-id', () => {
    const reqs = extractRequirements(
      { type: 'timeseries', code: 'metric:gdp', years: [2023] }, ctx,
    )
    expect(reqs).toEqual([{ code: 'B1G', dims: { time: 2023, geo: 'GE' } }])
  })

  it('unit + methodology flow to the panel via withMetricProvenance (by underlying code)', () => {
    const emptyPort: MetadataPort = { provenance: () => undefined }
    const port = withMetricProvenance(emptyPort)
    const prov = port.provenance('B1G', ctx)
    expect(prov?.methodology).toBe('https://example.org/methodology/gdp')
    expect(prov?.unit).toEqual({ en: 'million GEL' })
  })
})

// ── Precedence: explicit config > metric default > cube default ────────

describe('precedence — explicit config wins over metric default', () => {
  it('an explicit query filter overrides the metric default dim', () => {
    const q = resolveQueryMeasures({ measure: 'metric:gdp', filter: { adjustment: 'N' } })
    expect(q.filter).toEqual({ adjustment: 'N' })
  })

  it('explicit filter selects the N slice despite the metric default S', () => {
    const rows = interpretSpec(
      { type: 'query', query: { measure: 'metric:gdp', filter: { adjustment: 'N' } },
        encoding: { label: 'label', value: 'value' } },
      ctx, store,
    )
    expect(rows.map((r) => r.value)).toEqual([1100]) // only the single N row exists
  })

  it('runtime/cube provenance wins over the metric-default methodology', () => {
    const runtimePort: MetadataPort = {
      provenance: () => ({ methodology: 'https://cube/runtime', source: 'cube' }),
    }
    const prov = withMetricProvenance(runtimePort).provenance('B1G', ctx)
    expect(prov?.methodology).toBe('https://cube/runtime') // cube wins
    expect(prov?.source).toBe('cube')
  })

  it('a metric with no governance contributes only its code (no dims merged)', () => {
    const q = resolveQueryMeasures({ measure: 'metric:gdp-raw' })
    expect(q.measure).toBe('B1G')
    expect(q.filter).toBeUndefined()
  })
})

// ── FF-ONE-RESOLUTION-PATH ─────────────────────────────────────────────

describe('FF-ONE-RESOLUTION-PATH — one seam, no parallel resolution', () => {
  const resolversSrc = readFileSync(resolve(__dirname, '../registry/resolvers.ts'), 'utf8')
  const specSrc      = readFileSync(resolve(__dirname, './spec.ts'), 'utf8')

  it('resolvers.ts resolves measures only via resolveMeasureRef (no getMetric re-impl)', () => {
    // The binding path must route through the seam, never read the registry map
    // directly (that would be a parallel resolution path).
    expect(resolversSrc).toMatch(/resolveMeasureRef/)
    expect(resolversSrc).not.toMatch(/\bgetMetric\b/)
  })

  it('extractRequirements (spec.ts) resolves through the same seam', () => {
    expect(specSrc).toMatch(/resolveMeasureRef/)
    expect(specSrc).not.toMatch(/\bgetMetric\b/)
  })
})
