// @vitest-environment node
//
// ── FF-XF-KPI-RECOMPUTE / MULTI-ANY / OPT-OUT — KPI cross-filter read loop ──
//
//  A regional KPI authored with a `$ctx` filter ref FOLLOWS the selected region(s)
//  and falls back to the national total when nothing is selected. This proves the
//  READ half of cross-filter closes for KPIs (the write half is the adapter):
//
//   • FF-XF-KPI-RECOMPUTE — geo unselected ('' → default '_T') vs geo='R2' yield
//     DIFFERENT values (the KPI is not frozen on the national cell).
//   • FF-XF-MULTI-ANY (KPI) — geo='R2,R3' sums the OR-set (R2+R3) via the store's
//     CSV → `= ANY` matching, the same path panels use.
//   • FF-XF-OPT-OUT — a KPI pinned to a LITERAL '_T' is unaffected by selection.
//
//  withFilter resolves the ref through the SAME path extractKpiRequirements uses,
//  so warm === read (no async drift) — asserted implicitly by sharing withFilter.
//

import { describe, it, expect } from 'vitest'
import { ExternalStore }         from './store-impl'
import { interpretKpi }          from './kpi'
import type { KpiSpec }          from './kpi'
import type { Observation }      from '../sdmx'
import type { SectionContext }   from '../core/context'

// GVA by region at time 2020: national total _T = 1000, R2 = 300, R3 = 200.
const OBS: Observation[] = [
  { measure: 'GVA', geo: '_T', sector: '_T', time: 2020, value: 1000 },
  { measure: 'GVA', geo: 'R2', sector: '_T', time: 2020, value: 300 },
  { measure: 'GVA', geo: 'R3', sector: '_T', time: 2020, value: 200 },
]
const store = new ExternalStore(OBS)

const ctx = (geo: string): SectionContext => ({ dims: { geo, sector: '_T', time: 2020 } })

// A regional KPI that FOLLOWS the selection (default = national total when empty).
const followSpec: KpiSpec = {
  id: 'reg-gva', label: 'GVA', unit: 'mln', color: '#000',
  value: { type: 'point', measure: 'GVA', format: 'mln_gel', filter: { geo: { $ctx: 'geo', default: '_T' }, sector: { $ctx: 'sector', default: '_T' } } },
}

// An opt-out KPI: literal national pin, never follows the selection.
const pinnedSpec: KpiSpec = {
  id: 'nat-gva', label: 'GVA', unit: 'mln', color: '#000',
  value: { type: 'point', measure: 'GVA', format: 'mln_gel', filter: { geo: '_T', sector: '_T' } },
}

describe('FF-XF-KPI-RECOMPUTE', () => {
  it('unselected (default _T) and selected (R2) yield different values', () => {
    const national = interpretKpi(followSpec, ctx(''),   store).value
    const region   = interpretKpi(followSpec, ctx('R2'), store).value
    expect(national).not.toBe(region)
  })

  it('the default is the national total when nothing is selected', () => {
    expect(interpretKpi(followSpec, ctx(''), store).value)
      .toBe(interpretKpi(pinnedSpec, ctx(''), store).value)   // both read the _T cell (1000)
  })
})

describe('FF-XF-MULTI-ANY (KPI)', () => {
  it('a CSV OR-set sums the selected regions (R2 + R3)', () => {
    const two = interpretKpi(followSpec, ctx('R2,R3'), store).value   // 300 + 200 = 500
    const r2  = interpretKpi(followSpec, ctx('R2'),    store).value   // 300
    expect(two).not.toBe(r2)
    // 500 is between the single-region (300) and national (1000) — proves OR-set aggregation.
    expect(two).toBe(interpretKpi(followSpec, ctx('R3,R2'), store).value)  // order-invariant
  })
})

describe('FF-XF-OPT-OUT', () => {
  it('a literal-pinned KPI is unaffected by the selection', () => {
    const a = interpretKpi(pinnedSpec, ctx(''),      store).value
    const b = interpretKpi(pinnedSpec, ctx('R2'),    store).value
    const c = interpretKpi(pinnedSpec, ctx('R2,R3'), store).value
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})
