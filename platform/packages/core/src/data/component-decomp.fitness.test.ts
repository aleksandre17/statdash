// ── FF — component decomposition rollup + declarative contribution_role (C6) ──
//
//  Guards the render-pipeline-parity contract for the GDP approach charts
//  (expenditure bridge · production donut · income treemap) and the per-capita
//  KPI unit/format. These are the ENGINE-level proofs behind the declarative
//  provisioning pipes (apps/api/provisioning/geostat.provisioning.json):
//
//   • FF-COMPONENT-ROLLUP  — a component query rolls the component dimension up
//     to exactly one row per member (≥2 members), so a donut/bridge/treemap can
//     never degenerate to a 2-bar / 1-slice artefact from an unrolled dim.
//   • FF-BRIDGE-CLOSES     — the expenditure components, SIGNED by their declared
//     `contribution_role` (add/subtract), sum to the `total`-role closing bar
//     (C + I + X − M = GDP). The sign + total are read from the attribute, never
//     hardcoded to a measure code.
//   • Per-capita 2014      — the USD per-capita measure renders 4829.9 (gold),
//     not the GEL-millions integer scale, through the KPI point/decimal1 path.
//
//  The pipes below are the EXACT step sequences the provisioning config authors
//  declaratively; encoding them here makes the declarative behaviour a build gate.

import { describe, it, expect }   from 'vitest'
import { applyPipeline }          from './transform'
import type { RawRow, TransformStep } from './transform'
import { ExternalStore }          from './store-impl'
import { interpretKpi }           from './kpi'
import type { KpiSpec }           from './kpi'
import type { SectionContext }    from '../core/context'

// ── The expenditure bridge pipe (declarative, from provisioning) ───────────────
//  aggregate rolls the component dim up; the sign + the total flag are derived
//  from `contributionRole` — the SSOT attribute, never a hardcoded measure code.
const EXP_PIPE: TransformStep[] = [
  { op: 'aggregate', by: ['measure', 'time', 'contributionRole'], measure: 'value', agg: 'sum' },
  { op: 'derive', as: 'value',   expr: "contributionRole == 'subtract' ? value * -1 : value" },
  { op: 'derive', as: 'isTotal', expr: "contributionRole == 'total' ? 1 : 0" },
]

// A faithful EXP slice (approach=EXP, geo=GE, one year). final-consumption is
// SPLIT into two rows so the rollup has something to collapse — a real read never
// guarantees one row per measure, and the aggregate is what makes it so.
const EXP_ROWS: RawRow[] = [
  { measure: 'final-consumption-expenditure', time: 2014, contributionRole: 'add',      value: 30000 },
  { measure: 'final-consumption-expenditure', time: 2014, contributionRole: 'add',      value: 30000 },
  { measure: 'gross-capital-formation',       time: 2014, contributionRole: 'add',      value: 20000 },
  { measure: 'exports-of-goods-and-services', time: 2014, contributionRole: 'add',      value: 25000 },
  { measure: 'imports-of-goods-and-services', time: 2014, contributionRole: 'subtract', value: 24117.2 },
  { measure: 'gross-domestic-product-at-current-prices', time: 2014, contributionRole: 'total', value: 80882.8 },
]

describe('FF-COMPONENT-ROLLUP — the component dimension is rolled up to one row per member', () => {
  it('collapses split rows to exactly one row per measure (≥2 components, no degeneracy)', () => {
    const out = applyPipeline(EXP_ROWS, EXP_PIPE)
    // 5 distinct measures (4 components + 1 total), never the 2-bar artefact.
    const byMeasure = new Set(out.map((r) => String(r['measure'])))
    expect(byMeasure.size).toBe(5)

    const components = out.filter((r) => r['isTotal'] !== 1)
    expect(components.length).toBe(4)              // C, I, X, M — all present
    expect(components.length).toBeGreaterThanOrEqual(2)

    // The split final-consumption rows were summed into ONE row (rollup proof).
    const fc = out.filter((r) => r['measure'] === 'final-consumption-expenditure')
    expect(fc.length).toBe(1)
    expect(fc[0]['value']).toBe(60000)
  })

  it('production donut rolls up + appends a computed GDP total (no total member in PROD data)', () => {
    // PROD carries 5 add-components and NO total row; the donut center total is
    // COMPUTED via rollup (mirrors the sectoral donut), classified by dim value.
    const PROD_PIPE: TransformStep[] = [
      { op: 'aggregate', by: ['measure', 'time'], measure: 'value', agg: 'sum' },
      { op: 'rollup', dim: 'measure', as: '__total__', of: '*', agg: 'sum' },
      { op: 'derive', as: 'isTotal', expr: "measure == '__total__' ? 1 : 0" },
    ]
    const PROD_ROWS: RawRow[] = [
      { measure: 'agriculture-forestry-and-fishing', time: 2014, value: 4000 },
      { measure: 'agriculture-forestry-and-fishing', time: 2014, value: 1000 }, // split → rollup
      { measure: 'manufacturing',                    time: 2014, value: 12000 },
      { measure: 'construction',                     time: 2014, value: 8000 },
      { measure: 'services',                         time: 2014, value: 40000 },
      { measure: 'net-taxes',                        time: 2014, value: 15882.8 },
    ]
    const out        = applyPipeline(PROD_ROWS, PROD_PIPE)
    const components = out.filter((r) => r['isTotal'] !== 1)
    const totals     = out.filter((r) => r['isTotal'] === 1)

    expect(components.length).toBe(5)                    // all sectors shown (≥2)
    expect(totals.length).toBe(1)                        // exactly one center total
    const sum = components.reduce((a, r) => a + Number(r['value']), 0)
    expect(Number(totals[0]['value'])).toBeCloseTo(sum, 6)
  })
})

describe('FF-BRIDGE-CLOSES — signed components (from contribution_role) sum to the total', () => {
  it('C + I + X − M equals the total-role closing bar', () => {
    const out        = applyPipeline(EXP_ROWS, EXP_PIPE)
    const total      = out.find((r) => r['isTotal'] === 1)!
    const components = out.filter((r) => r['isTotal'] !== 1)

    // imports (subtract) must be NEGATIVE after the declarative sign derive.
    const imports = components.find((r) => r['measure'] === 'imports-of-goods-and-services')!
    expect(Number(imports['value'])).toBeLessThan(0)

    const bridge = components.reduce((a, r) => a + Number(r['value']), 0)
    expect(bridge).toBeCloseTo(Number(total['value']), 6)  // 80 882.8 = GDP
  })
})

describe('per-capita 2014 renders the USD value (gold 4829.9), not the GEL-mn scale', () => {
  it('interpretKpi point/decimal1 over the 2014 obs yields 4829.9', () => {
    // The real seeded value (GDP_ANNUAL DATA, approach=_Z, GE, 2014).
    const store = new ExternalStore([
      { measure: 'gdp-per-capita-usd', geo: 'GE', approach: '_Z', time: 2014, value: 4829.876570127809 },
    ])
    const spec: KpiSpec = {
      id: 'gdp-per-capita', label: 'GDP per capita', unit: '$', color: '#4ECDC4',
      value: { type: 'point', measure: 'gdp-per-capita-usd', format: 'decimal1',
               filter: { geo: 'GE', approach: '_Z' } },
    }
    const ctx: SectionContext = { dims: { time: 2014 } }
    const def = interpretKpi(spec, ctx, store)

    // Numeric content is 4829.9 (locale separators stripped) — NOT 483, NOT 4830.
    const num = Number(def.value.replace(/[^\d.-]/g, ''))
    expect(num).toBe(4829.9)
  })
})
