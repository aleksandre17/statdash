// ── FF-RAW-CODE-IDENTICAL (KPI path) — render == warm == today [AR-40 U1] ──────
//
//  The permanent lock for AR-40 P0/U1: the KPI RENDER path is now metric-aware — it
//  resolves a measure ref through the SAME resolveMeasureRef seam the WARM path
//  (extractKpiRequirements) already used. Before U1, warm resolved a metric-id to its
//  underlying code but render passed the raw ref to storeVal → a metric-id KPI warmed
//  one key yet rendered another (cache-miss → 0 value + a DEAD preliminary badge).
//
//  This net asserts the invariant in BOTH directions, Law-1 generic (no privileged
//  dim/measure name — the fixtures pick arbitrary codes):
//    1. RAW CODE IS BYTE-IDENTICAL TO TODAY — a raw-code KPI's rendered value equals
//       a direct storeVal read through the legacy formatter (the Postel guarantee:
//       resolveMeasureRef('X').codes === ['X'], so readMeasure reduces to storeVal).
//    2. RENDER == WARM — a metric-id KPI and the raw-code KPI it aliases produce the
//       IDENTICAL KpiDef (value, trend, AND preliminary badge) and the IDENTICAL warm
//       requirement set. This is the render/warm split U1 closes.
//
//  Registered metric ids use a `metric:` prefix so they can never collide with a raw
//  SDMX code used as a measure in any config fixture.

import { describe, it, expect, beforeEach } from 'vitest'

import { interpretKpi, extractKpiRequirements } from './kpi'
import type { KpiSpec }        from './kpi'
import { ExternalStore }       from './store-impl'
import { storeVal }            from './store'
import { getFormatter }        from './transform'
import { registerMetric }      from './metric'
import { atTime }              from '../core/context'
import type { SectionContext } from '../core/context'
import type { Observation }    from '../sdmx'

// A single measure code `ACC_X`, over two years, at a generic (geo) coordinate. The
// latest year carries OBS_STATUS 'p' so the displayed-slice preliminary badge lights —
// the exact signal that died when a metric-id was passed straight to the obs read.
const obs: Observation[] = [
  { measure: 'ACC_X', value: 1000, time: 2023, geo: 'GE', obsStatus: 'p' },
  { measure: 'ACC_X', value:  800, time: 2022, geo: 'GE', obsStatus: 'A' },
  // A second underlying code for the multi-code metric case.
  { measure: 'ACC_Y', value:  250, time: 2023, geo: 'GE', obsStatus: 'A' },
]
const store = new ExternalStore(obs)

const ctx: SectionContext = { dims: { time: 2023, geo: 'GE' } }

// Identical KPI shape; only the measure ref differs (raw code ⇄ metric-id).
const mkKpi = (measure: string): KpiSpec => ({
  id: 'k', label: { en: 'Value added' }, unit: { en: 'mln' }, color: '#000',
  value: { type: 'point', measure, format: 'mln_gel', filter: { geo: 'GE' } },
  trend: { type: 'yoy',   measure,                     filter: { geo: 'GE' } },
})

beforeEach(() => {
  // A BASE metric that is a pure alias of the raw code (no governance dims) — the
  // safest demonstrable migration: it resolves to the same code, so render + warm +
  // preliminary are byte-identical to the raw-code KPI.
  registerMetric('metric:value-added', {
    code:  'ACC_X',
    label: { en: 'Value added' },
    unit:  { en: 'mln' },
  })
  // A MULTI-code metric — proves the additive-measure reading (sum) on render mirrors
  // the warm path (one requirement per underlying code).
  registerMetric('metric:va-plus', {
    code:  ['ACC_X', 'ACC_Y'],
    label: { en: 'VA + Y' },
  })
})

describe('FF-RAW-CODE-IDENTICAL (KPI) · raw code == today', () => {
  it('a raw-code KPI value equals a direct storeVal read through the legacy formatter', () => {
    const kpi = interpretKpi(mkKpi('ACC_X'), ctx, store)
    const direct = getFormatter('mln_gel')(storeVal(store, 'ACC_X', atTime(2023, ctx)))
    expect(kpi.value).toBe(direct)
  })

  it('a raw-code KPI still lights its preliminary badge from the displayed slice', () => {
    expect(interpretKpi(mkKpi('ACC_X'), ctx, store).preliminary).toBe(true)
  })
})

describe('FF-RAW-CODE-IDENTICAL (KPI) · render == warm (metric-id aliases a raw code)', () => {
  it('interpretKpi is IDENTICAL for the raw code and the metric-id alias (value+trend+badge)', () => {
    const raw    = interpretKpi(mkKpi('ACC_X'),              ctx, store)
    const metric = interpretKpi(mkKpi('metric:value-added'), ctx, store)
    expect(metric).toEqual(raw)
    // Non-vacuous: the shared KpiDef actually carries the resolved value, trend, badge.
    expect(metric.value).toBe(getFormatter('mln_gel')(1000))
    expect(metric.trend).toBe('up')                 // yoy 1000/800 − 1 = +25%
    expect(metric.trendValue).toBe(getFormatter('sign_pct')(25))
    expect(metric.preliminary).toBe(true)           // the badge U1 rescued
  })

  it('extractKpiRequirements is IDENTICAL for the raw code and the metric-id alias', () => {
    const rawReqs    = extractKpiRequirements([mkKpi('ACC_X')],              ctx)
    const metricReqs = extractKpiRequirements([mkKpi('metric:value-added')], ctx)
    expect(metricReqs).toEqual(rawReqs)
    // Non-vacuous: warm covers the point + BOTH yoy periods, all on the underlying code.
    expect(metricReqs).toEqual([
      { code: 'ACC_X', dims: { time: 2023, geo: 'GE' } }, // point
      { code: 'ACC_X', dims: { time: 2023, geo: 'GE' } }, // yoy t
      { code: 'ACC_X', dims: { time: 2022, geo: 'GE' } }, // yoy t-1 (the crash year)
    ])
  })

  it('the BADGE bites: a metric-id KPI reading no preliminary obs shows NO badge', () => {
    // Read 2022 (OBS_STATUS 'A') — proves the metric-aware preliminary path is
    // year-aware, not a blanket true.
    const kpi = interpretKpi(mkKpi('metric:value-added'), { dims: { time: 2022, geo: 'GE' } }, store)
    expect(kpi.preliminary).toBe(false)
  })
})

describe('FF-RAW-CODE-IDENTICAL (KPI) · multi-code metric — render sums, warm enumerates', () => {
  it('render sums the underlying codes (additive measure) and warm enumerates each', () => {
    const kpi  = interpretKpi(mkKpi('metric:va-plus'), ctx, store)
    // ACC_X (1000) + ACC_Y (250) at (time 2023, geo GE).
    expect(kpi.value).toBe(getFormatter('mln_gel')(1250))
    const reqs = extractKpiRequirements([mkKpi('metric:va-plus')], ctx)
    expect(reqs.map((r) => r.code)).toEqual(['ACC_X', 'ACC_Y', 'ACC_X', 'ACC_Y', 'ACC_X', 'ACC_Y'])
  })
})
