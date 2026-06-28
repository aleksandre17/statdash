// ── FF-CALCULATED-METRIC — measure-algebra in the semantic layer [DC-01] ──────
//
//  Locks the calculated-metric capability AND its real consumer:
//
//    FF-CALCULATED-METRIC        — a calc metric's expression evaluates correctly
//                                  over its component measures at the active
//                                  coordinate (ratio, identity-sum, dim-pinned
//                                  components, div-by-zero → 0).
//    FF-CALC-METRIC-EQUALS-SHARE — THE BYTE-IDENTICAL MIGRATION TWIN. The real
//                                  derived indicator on the geostat regional page —
//                                  "Labour share in value added" = D1 / B1G × 100,
//                                  today a bespoke `share` KpiValueSpec — re-expressed
//                                  as a calculated MetricDef + a `metric` KPI value
//                                  renders a BYTE-IDENTICAL KpiDef AND warms the
//                                  IDENTICAL requirement set. The capability has a
//                                  congregation: the calc metric is exercised through
//                                  the actual KPI render path, not a speculative door.
//    FF-CALC-RESOLVES-VIA-SEAM   — the calc metric stays consumable through the one
//                                  binding seam (resolveMeasureRef → ≥1 code), so
//                                  no-capability-without-consumer (part C) stays green
//                                  and warming a calc metric warms its components.
//
//  registerMetric mutates a process-global registry; every id here is `metric:`-
//  prefixed so it can never collide with a raw SDMX code in any config/fixture.
//
import { describe, it, expect } from 'vitest'

import { registerMetric, resolveMeasureRef } from './metric'
import { resolveMetricValue, isCalculatedMetric } from './metric-calc'
import { interpretKpi, extractKpiRequirements } from './kpi'
import type { KpiSpec } from './kpi'
import { ExternalStore } from './store-impl'
import type { Observation } from '../sdmx'
import type { SectionContext } from '../core/context'

// ── Labour-share-shaped store ──────────────────────────────────────────────────
//  D1 (compensation) under the generation-of-income account; B1G (value added)
//  under the production account — the exact (account, side) slices the geostat
//  labour-share KPI pins. A decoy account/side proves the coordinate pin bites.
const obs: Observation[] = [
  { measure: 'D1',  value: 480,  time: 2023, geo: 'GE', account: 'generation-of-income-account', side: 'U', label: 'Compensation' },
  { measure: 'D1',  value: 999,  time: 2023, geo: 'GE', account: 'production-account',            side: 'U', label: 'Compensation (decoy)' },
  { measure: 'B1G', value: 1200, time: 2023, geo: 'GE', account: 'production-account',            side: 'U', label: 'Value added' },
  { measure: 'B1G', value: 700,  time: 2022, geo: 'GE', account: 'production-account',            side: 'U', label: 'Value added' },
  { measure: 'B5G', value: 50,   time: 2023, geo: 'GE', account: 'allocation-account',            side: 'U', label: 'GNI' },
]
const store = new ExternalStore(obs)

// toYear is a filter-param dim (resolved by {$ctx:'toYear'}); time is the read coord.
const ctx: SectionContext = { dims: { time: 2023, geo: 'GE', toYear: 2023 } }

// The calculated metric: labour share = D1@(gen-income,U) / B1G@(prod,U) × 100.
registerMetric('metric:labor-share', {
  label: { ka: 'შრომის წილი', en: 'Labour share in value added' },
  unit:  { ka: '%', en: '%' },
  calc: {
    inputs: {
      num:   { measure: 'D1',  at: { account: 'generation-of-income-account', side: 'U' } },
      denom: { measure: 'B1G', at: { account: 'production-account',           side: 'U' } },
    },
    // mul(div($num, $denom), 100) — REUSES @statdash/expr, no second dialect.
    expr: { op: 'mul', left: { op: 'div', left: { $derived: 'num' }, right: { $derived: 'denom' } }, right: 100 },
  },
})

// An accounting-identity calc metric (derived = a − b) — proves generality.
registerMetric('metric:net', {
  label: { en: 'Net' },
  calc: {
    inputs: {
      a: { measure: 'B1G', at: { account: 'production-account', side: 'U' } },
      b: { measure: 'D1',  at: { account: 'generation-of-income-account', side: 'U' } },
    },
    expr: { op: 'sub', left: { $derived: 'a' }, right: { $derived: 'b' } },
  },
})

// A decoy-pinned ratio: num pins the PRODUCTION-account D1 (999), proving the
// generic coordinate routes to a different slice than metric:labor-share.
registerMetric('metric:decoy-pin', {
  label: { en: 'Decoy' },
  calc: {
    inputs: {
      num:   { measure: 'D1',  at: { account: 'production-account', side: 'U' } },
      denom: { measure: 'B1G', at: { account: 'production-account', side: 'U' } },
    },
    expr: { op: 'mul', left: { op: 'div', left: { $derived: 'num' }, right: { $derived: 'denom' } }, right: 100 },
  },
})

// A calc metric whose denominator slice has NO observations (div-by-zero → 0).
registerMetric('metric:zero-denom', {
  label: { en: 'Zero' },
  calc: {
    inputs: {
      num:   { measure: 'D1',  at: { account: 'generation-of-income-account', side: 'U' } },
      denom: { measure: 'B1G', at: { account: 'no-such-account', side: 'U' } },
    },
    expr: { op: 'mul', left: { op: 'div', left: { $derived: 'num' }, right: { $derived: 'denom' } }, right: 100 },
  },
})

// ── FF-CALCULATED-METRIC ───────────────────────────────────────────────────────

describe('FF-CALCULATED-METRIC — the expression evaluates over its components', () => {
  it('a ratio metric evaluates num/denom × 100 at the active coordinate', () => {
    // 480 / 1200 × 100 = 40 — and the gen-income/U decoy (999) is NOT picked up.
    expect(resolveMetricValue('metric:labor-share', ctx, store)).toBe(40)
  })

  it('the component coordinate (account, side) is honoured — a generic Law-1 pin', () => {
    // Same codes (D1/B1G), DIFFERENT num coordinate ⇒ a different value: the
    // production-account D1 slice (999), not the generation-of-income one (480).
    expect(resolveMetricValue('metric:decoy-pin', ctx, store)).toBe((999 / 1200) * 100)
    expect(resolveMetricValue('metric:labor-share', ctx, store)).toBe((480 / 1200) * 100)
  })

  it('a derived (identity-sum) metric evaluates a − b', () => {
    expect(resolveMetricValue('metric:net', ctx, store)).toBe(1200 - 480)
  })

  it('div-by-zero folds to 0 (byte-identical to the legacy `denom ? n/d : 0` guard)', () => {
    expect(resolveMetricValue('metric:zero-denom', ctx, store)).toBe(0)
  })

  it('a non-calc ref returns undefined (caller falls back to a raw read)', () => {
    expect(resolveMetricValue('B1G', ctx, store)).toBeUndefined()
    expect(isCalculatedMetric('B1G')).toBe(false)
    expect(isCalculatedMetric('metric:labor-share')).toBe(true)
  })
})

// ── FF-CALC-RESOLVES-VIA-SEAM ────────────────────────────────────────────────────

describe('FF-CALC-RESOLVES-VIA-SEAM — a calc metric is consumable via resolveMeasureRef', () => {
  it('expands to its components’ underlying codes (≥1 ⇒ no-capability-without-consumer green)', () => {
    expect(resolveMeasureRef('metric:labor-share').codes).toEqual(['D1', 'B1G'])
  })
})

// ── FF-CALC-METRIC-EQUALS-SHARE — the byte-identical migration twin ──────────────

describe('FF-CALC-METRIC-EQUALS-SHARE — `share`→`metric` is byte-identical', () => {
  const common = {
    id:    'labor-share',
    label: { ka: 'შრომის წილი დამატებულ ღირებულებაში', en: 'Labour share in value added' },
    unit:  { ka: '%', en: '%' },
    color: '#4ECDC4',
    when:  { op: 'perspective-is', perspective: 'range' } as const,
    trend: { type: 'static', value: 'სტაბილური', dir: 'flat' } as const,
    trendSub: { ka: '{toYear}', en: '{toYear}' },
  }

  // The LEGACY bespoke derived indicator (today's geostat config).
  const legacyShare: KpiSpec = {
    ...common,
    value: {
      type:  'share',
      num:   { measure: 'D1',  filter: { account: 'generation-of-income-account', side: 'U' }, time: { $ctx: 'toYear' } },
      denom: { measure: 'B1G', filter: { account: 'production-account',           side: 'U' }, time: { $ctx: 'toYear' } },
    },
  }

  // The MIGRATED form — names the calc metric, value-algebra governed once.
  const migrated: KpiSpec = {
    ...common,
    value: { type: 'metric', metric: 'metric:labor-share', time: { $ctx: 'toYear' } },
  }

  // The card is range-only (when: perspective-is range) — warm/render under a
  // range perspective so the visibility gate admits it (interpretKpi itself never
  // filters; extractKpiRequirements does, via the shared kpiVisible predicate).
  const rangeCtx: SectionContext = { ...ctx, perspectiveState: { perspective: 'range' } }

  it('renders a byte-identical KpiDef (the rendered value must not change)', () => {
    const a = interpretKpi(legacyShare, rangeCtx, store)
    const b = interpretKpi(migrated,   rangeCtx, store)
    expect(b).toEqual(a)
    expect(b.value).toBe('40.0')   // fmtKpiPct(40) — share parity, not fmtNum (no separator/strip)
  })

  it('warms the IDENTICAL requirement set (warm === render, no cold component)', () => {
    const a = extractKpiRequirements([legacyShare], rangeCtx)
    const b = extractKpiRequirements([migrated],   rangeCtx)
    expect(b).toEqual(a)
    // Both read D1 and B1G at their pinned (account, side, time) slices.
    expect(b).toEqual([
      { code: 'D1',  dims: { time: 2023, geo: 'GE', toYear: 2023, account: 'generation-of-income-account', side: 'U' } },
      { code: 'B1G', dims: { time: 2023, geo: 'GE', toYear: 2023, account: 'production-account',           side: 'U' } },
    ])
  })

  it('warm requirements are visibility-gated identically (range-only ⇒ none in `year`)', () => {
    const yearCtx: SectionContext = { dims: { ...ctx.dims }, perspectiveState: { perspective: 'year' } }
    expect(extractKpiRequirements([migrated], yearCtx)).toEqual(extractKpiRequirements([legacyShare], yearCtx))
    expect(extractKpiRequirements([migrated], yearCtx)).toEqual([])
  })
})
