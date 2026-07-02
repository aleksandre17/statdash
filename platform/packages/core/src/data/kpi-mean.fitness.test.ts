// ── FF-KPI-MEAN-AGGREGATES — a first-class arithmetic-mean KPI reduction ──
//
//  Guards the DRIFT-3 bug (board item 0019 / C5): "average real growth" rendered
//  0.0%. Root cause — `kpi.ts` had NO mean reduction, so an "average" of a RATE
//  series was mis-authored as `cagr` (a LEVEL operator). CAGR reads the baseline
//  (vFrom); for real-gdp-growth-rates the start-year rate is 0 → the falsy-baseline
//  guard `vFrom && … : 0` SILENTLY returned 0.0%.
//
//  Two faults, two locks:
//    • `mean` (Σ v(t)/N over [from,to]) is the correct reducer — it returns the
//      arithmetic mean of the rate series (≈ +5%), NOT 0.
//    • BOTH cagr sites — value (`resolveValue`) AND trend (`resolveTrend`) — now
//      emit KPI_CAGR_ZERO_BASELINE on a falsy baseline instead of a silent 0, so a
//      mis-authored cagr-on-rate is LOUD (numeric 0 fallback retained for prod).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { interpretKpi, extractKpiRequirements, KPI_CAGR_ZERO_BASELINE } from './kpi'
import type { KpiSpec }         from './kpi'
import type { DataStore, StoreQuery } from './store'
import { TIME_DIM }             from '../core/context'
import type { SectionContext }  from '../core/context'
import type { EngineRow }       from './encoding'

// ── A synthetic real-growth RATE series ────────────────────────────────
//
//  The 2010 baseline is 0 (the live defect's trigger). The per-year rates
//  average to EXACTLY 5.0 — the golden mean — while a cagr over the same window
//  divides by that 0 baseline and (before the fix) silently yields 0.0%.
const SERIES: Record<number, number> = { 2010: 0, 2011: 5, 2012: 5, 2013: 10 } // Σ=20, N=4 → mean 5.0

const store: DataStore = {
  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    if (q.type === 'val' && q.code === 'real-gdp-growth-rates') {
      const t = ctx.dims[TIME_DIM] as number
      return [{ value: SERIES[t] ?? 0 } as unknown as EngineRow]
    }
    return []
  },
  caps: { queryTypes: ['val'], batching: false, streaming: false, sync: true },
}

const ctx: SectionContext = { dims: { [TIME_DIM]: 2013, geo: 'GE', approach: '_Z' } }

// Parse the numeric content out of a formatted KPI string (e.g. '+5.0%' → 5).
const num = (s: string): number => Number(s.replace(/[^\d.-]/g, ''))

let savedWarn: typeof console.warn
beforeEach(() => { savedWarn = console.warn })
afterEach(()  => { console.warn = savedWarn; vi.restoreAllMocks() })

// ── C5-a — the mean reduction returns the arithmetic mean, not 0 ───────

describe('FF-KPI-MEAN-AGGREGATES · mean reduction', () => {
  const meanKpi: KpiSpec = {
    id: 'avg-real-growth', label: 'Average real growth', unit: '%', color: '#000',
    value: { type: 'mean', measure: 'real-gdp-growth-rates', from: 2010, to: 2013, format: 'sign_pct' },
  }

  it('mean over the real-growth series ≈ +5% (the golden mean), NOT 0.0%', () => {
    const v = num(interpretKpi(meanKpi, ctx, store).value)
    expect(v).toBe(5)                    // Σ(0,5,5,10)/4 = 5.0 — the golden value
    expect(v).toBeGreaterThan(4)         // in the ~4–6%/yr band the item specifies
    expect(v).toBeLessThan(6)
    expect(v).not.toBe(0)                // the DRIFT-3 symptom must be gone
  })

  it('absent `format` ⇒ fmtKpiPct default (byte-identical to share/metric)', () => {
    const bare: KpiSpec = { ...meanKpi, value: { type: 'mean', measure: 'real-gdp-growth-rates', from: 2010, to: 2013 } }
    expect(interpretKpi(bare, ctx, store).value).toBe('5.0')
  })

  it('warm contributes one requirement PER YEAR in [from,to] (warm === render)', () => {
    const reqs = extractKpiRequirements([meanKpi], ctx)
    const years = reqs.filter((r) => r.code === 'real-gdp-growth-rates').map((r) => r.dims[TIME_DIM])
    expect(years).toEqual([2010, 2011, 2012, 2013])   // every read the mean will issue
  })
})

// ── C5-c — a falsy-baseline cagr diagnoses at BOTH sites (not silent 0) ─

describe('FF-KPI-MEAN-AGGREGATES · cagr-on-rate fails loud (KPI_CAGR_ZERO_BASELINE)', () => {
  it('VALUE site (:resolveValue) emits the diagnostic + keeps the 0 fallback', () => {
    const warn = vi.fn()
    console.warn = warn
    const kpi: KpiSpec = {
      id: 'bad-cagr', label: 'x', unit: '%', color: '#000',
      value: { type: 'cagr', measure: 'real-gdp-growth-rates', from: 2010, to: 2013 },
    }
    const out = interpretKpi(kpi, ctx, store)
    expect(num(out.value)).toBe(0)                                        // prod-resilient numeric fallback
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(KPI_CAGR_ZERO_BASELINE))
  })

  it('TREND site (:resolveTrend) emits the diagnostic — exercises the :220 path', () => {
    const warn = vi.fn()
    console.warn = warn
    const kpi: KpiSpec = {
      id: 'bad-cagr-trend', label: 'x', unit: '%', color: '#000',
      value: { type: 'point', measure: 'real-gdp-growth-rates', format: 'sign_pct' },
      trend: { type: 'cagr', measure: 'real-gdp-growth-rates', from: 2010, to: 2013 },
    }
    const out = interpretKpi(kpi, ctx, store)
    expect(num(out.trendValue ?? '')).toBe(0)                             // prod-resilient numeric fallback
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(KPI_CAGR_ZERO_BASELINE))
  })

  it('a NON-zero baseline (level series) stays silent + correct (no false positive)', () => {
    const levelStore: DataStore = {
      querySync(q: StoreQuery, c: SectionContext): EngineRow[] {
        if (q.type === 'val' && q.code === 'lvl') {
          const t = c.dims[TIME_DIM] as number
          return [{ value: t === 2010 ? 100 : t === 2013 ? 133.1 : 0 } as unknown as EngineRow]
        }
        return []
      },
      caps: { queryTypes: ['val'], batching: false, streaming: false, sync: true },
    }
    const warn = vi.fn()
    console.warn = warn
    const kpi: KpiSpec = {
      id: 'good-cagr', label: 'x', unit: '%', color: '#000',
      value: { type: 'cagr', measure: 'lvl', from: 2010, to: 2013 },
    }
    const v = num(interpretKpi(kpi, ctx, levelStore).value)
    expect(v).toBeGreaterThan(9)          // (133.1/100)^(1/3)−1 ≈ 10%/yr
    expect(v).toBeLessThan(11)
    expect(warn).not.toHaveBeenCalled()   // level series → no false diagnostic
  })
})
