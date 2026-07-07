// ── FF-SHARE-NATIONAL-BASE — a region's share is region / national-total ───────
//
//  Guards the ADMINISTRATION-review "637%" defect (image6, regional page): the
//  "share in GDP" KPI printed an impossible 637%. Two authoring bugs combined:
//    1. the NUMERATOR was hardcoded to R2 (Tbilisi) — a privileged dimension
//       (Law 1), so every region showed Tbilisi's number; and
//    2. the DENOMINATOR followed the SELECTED region (`{$ctx:geo, $ne:_T}`)
//       instead of an INVARIANT national base — a share's denominator must be the
//       whole, not the same slice as the numerator.
//
//  The fix (geostat.provisioning.json · reg-share):
//    • num.geo   = { $ctx:'geo', $ne:'_T' }  → FOLLOWS the selection; unselected ⇒
//      wildcard leaf-sum (= the national total), so the share is 100% (Georgia).
//    • denom.geo = { $ne:'_T' }              → ALWAYS the national leaf-sum, never
//      the selected region.
//
//  Data model = the canonical REGIONAL_GVA store (DATA/canonical, golden-canonical-
//  alias.ts): geo `_T` is the materialised national grand-total; R2..R12 are the
//  regions; `_T` sector is the sector-total. Σ(leaf regions) === the `_T` row.
//  Values are the real 2024 published observations (Tbilisi R2 ⇒ 53.1% of national).

import { describe, it, expect } from 'vitest'
import { ExternalStore }        from './store-impl'
import { interpretKpi }         from './kpi'
import type { KpiSpec }         from './kpi'
import type { Observation }     from '../sdmx'
import type { SectionContext }  from '../core/context'

// Real 2024 REGIONAL_GVA figures (sector=_T), from DATA/canonical/REGIONAL_GVA.xlsx.
const REGION_GVA_2024: Record<string, number> = {
  R2: 49374.72, R3: 8634.02, R5: 7203.15, R11: 6638.04, R9: 5102.44,
  R6: 4639.03, R12: 3922.78, R10: 2855.44, R7: 2545.79, R4: 1559.32, R8: 547.68,
}
const NATIONAL_2024 = Object.values(REGION_GVA_2024).reduce((a, b) => a + b, 0)

function buildStore(): ExternalStore {
  const obs: Observation[] = []
  // The materialised national grand-total row (geo=_T) the real store carries —
  // it MUST be excluded from the leaf-sum, else the denominator double-counts.
  obs.push({ measure: 'GVA', geo: '_T', sector: '_T', time: 2024, value: NATIONAL_2024 })
  for (const [geo, value] of Object.entries(REGION_GVA_2024)) {
    obs.push({ measure: 'GVA', geo, sector: '_T', time: 2024, value })
  }
  return new ExternalStore(obs)
}

// The reg-share value spec AS SHIPPED (mirrors geostat.provisioning.json).
const shareValue: KpiSpec['value'] = {
  type: 'share',
  num:   { measure: 'GVA', filter: { geo: { $ctx: 'geo', $ne: '_T' }, sector: { $ctx: 'sector', default: '_T' } } },
  denom: { measure: 'GVA', filter: { geo: { $ne: '_T' },              sector: { $ctx: 'sector', default: '_T' } } },
}

const shareKpi = (): KpiSpec => ({ id: 'reg-share', label: 'share', unit: '%', color: '#000', value: shareValue })

const pct = (s: string): number => Number(s.replace(/[^\d.-]/g, ''))

describe('FF-SHARE-NATIONAL-BASE · reg-share value', () => {
  const store = buildStore()

  it('NO region selected ⇒ Georgia = 100% (num leaf-sum === denom leaf-sum)', () => {
    const ctx: SectionContext = { dims: { time: 2024 } }              // geo/sector unset
    expect(pct(interpretKpi(shareKpi(), ctx, store).value)).toBeCloseTo(100, 1)
  })

  it('Tbilisi (R2) selected ⇒ its TRUE share (~53%), never 637%', () => {
    const ctx: SectionContext = { dims: { time: 2024, geo: 'R2' } }
    const v = pct(interpretKpi(shareKpi(), ctx, store).value)
    expect(v).toBeCloseTo((REGION_GVA_2024.R2 / NATIONAL_2024) * 100, 1) // 53.1%
    expect(v).toBeLessThan(100)                                          // a share can NEVER exceed 100%
  })

  it('another region (R3) selected ⇒ its own share, not Tbilisi’s', () => {
    const ctx: SectionContext = { dims: { time: 2024, geo: 'R3' } }
    expect(pct(interpretKpi(shareKpi(), ctx, store).value))
      .toBeCloseTo((REGION_GVA_2024.R3 / NATIONAL_2024) * 100, 1)       // 9.3%
  })

  it('denominator is INVARIANT to the selected region (num changes, denom does not)', () => {
    const share = (geo?: string): number =>
      pct(interpretKpi(shareKpi(), { dims: { time: 2024, ...(geo ? { geo } : {}) } }, store).value)
    // If the denom followed the selection (the bug), R2 and R3 would BOTH be 100%.
    expect(share('R2')).not.toBeCloseTo(share('R3'), 1)
  })
})

// ── The new `share` TREND discriminant (A3 — regional featured % of national) ──
describe('FF-SHARE-NATIONAL-BASE · share TREND type', () => {
  const store = buildStore()

  it('a point card with a share trend surfaces the region’s % of national', () => {
    const spec: KpiSpec = {
      id: 'featured-r2', label: 'Tbilisi', unit: 'GEL mn', color: '#000',
      value: { type: 'point', measure: 'GVA', format: 'mln_gel', filter: { geo: 'R2', sector: '_T' } },
      trend: {
        type: 'share',
        num:   { measure: 'GVA', filter: { geo: 'R2', sector: '_T' } },
        denom: { measure: 'GVA', filter: { geo: { $ne: '_T' }, sector: '_T' } },
      },
    }
    const card = interpretKpi(spec, { dims: { time: 2024 } }, store)
    expect(pct(card.value)).toBeCloseTo(REGION_GVA_2024.R2, 0)          // absolute GEL value
    // A share is a PROPORTION, not a rise/fall — its direction is 'none', so the card
    // renders NO arrow and NO up/down/flat ("stable") label (the false-trend defect).
    expect(card.trend).toBe('none')
    expect(pct(card.trendValue ?? '')).toBeCloseTo(53.1, 1)             // its national share
  })
})
