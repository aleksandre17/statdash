// ── AR-40 fitness nets — the featured collection resolves THROUGH the KPI seam ──
//
//  Locks the AR-40 invariants for the featured slider's engine spine:
//    FF-FEATURED-THROUGH-KPI-SEAM — interpretFeatured produces each card's value
//                                   via interpretKpi/storeVal (the LIVE governed
//                                   number at the coordinate), never inline/hardcoded.
//    FF-FEATURED-NO-HARDCODE       — a lowered item's value is a metric-REF
//                                   (measure:<metric-id>), never a literal number.
//    FF-METRIC-FORMAT-GOVERNED     — a card with no explicit format inherits the
//                                   metric's format; an explicit item.format wins.
//    FF-FEATURED-LABEL-CURATION    — item.label (region-name curation) wins over
//                                   the shared metric's label.
//    FF-FEATURED-PRELIMINARY       — preliminary falls out of OBS_STATUS 'p' at the
//                                   read coordinate (Law 9), for free via interpretKpi.
//    FF-FEATURED-WARM-ROUTED       — extractFeaturedRequirements tags each req with
//                                   the metric's dataSource (cross-dataset warm).
//
import { describe, it, expect, beforeEach } from 'vitest'

import {
  interpretFeatured, extractFeaturedRequirements, featuredToKpiSpec,
  type FeaturedItemSpec,
} from './featured'
import { registerMetric }      from './metric'
import { getFormatter }        from './transform'
import { ExternalStore }       from './store-impl'
import type { SectionContext } from '../core/context'
import type { Observation }    from '../sdmx'

// GVA at three regions (2024) + a preliminary GDP figure (2025, obsStatus 'p').
const obs: Observation[] = [
  { measure: 'GVA', value: 49374.72, time: 2024, geo: 'R2', sector: '_T', label: 'GVA' },
  { measure: 'GVA', value:  8634.02, time: 2024, geo: 'R3', sector: '_T', label: 'GVA' },
  { measure: 'GDP', value: 104598.14, time: 2025, geo: 'GE', obsStatus: 'P', label: 'GDP' },
]
const store = new ExternalStore(obs)
const ctx: SectionContext = { dims: {} }

// Single-store resolver for the unit level (react supplies the real per-dataSource one).
const resolveStore = () => store

beforeEach(() => {
  registerMetric('feat:gva', {
    code: 'GVA', label: { en: 'Gross Value Added', ka: 'დღ' },
    unit: { en: 'GEL mn', ka: 'მლნ ₾' }, format: 'mln_gel', dataSource: 'regional',
  })
  registerMetric('feat:gdp', {
    code: 'GDP', label: { en: 'GDP at current prices', ka: 'მშპ' },
    unit: { en: 'GEL mn', ka: 'მლნ ₾' }, format: 'mln_gel', dataSource: 'gdp',
  })
})

describe('AR-40 — interpretFeatured lowers to interpretKpi (SSOT, no hardcode)', () => {
  it('FF-FEATURED-THROUGH-KPI-SEAM — value is the LIVE store number, governed-formatted', () => {
    const items: FeaturedItemSpec[] = [
      { metric: 'feat:gva', at: { geo: 'R2', sector: '_T' }, time: 2024, href: 'regional', group: { en: 'Regional', ka: 'რეგ' } },
    ]
    const [slide] = interpretFeatured(items, ctx, resolveStore)
    // The exact value the store holds at the coordinate, formatted by the metric format.
    expect(slide.card.value).toBe(getFormatter('mln_gel')(49374.72))
    expect(slide.card.unit).toBe('GEL mn')           // metric unit governs (en locale)
    expect(slide.group).toBe('Regional')
    expect(slide.href).toBe('regional')
  })

  it('FF-FEATURED-NO-HARDCODE — the lowered value is a metric-ref, never a literal', () => {
    const kpi = featuredToKpiSpec({ metric: 'feat:gva', at: { geo: 'R2', sector: '_T' }, time: 2024, href: 'x' })
    expect(kpi.value.type).toBe('point')
    // The measure is the metric-id (a REF resolved live), not a number/string literal value.
    expect((kpi.value as { measure: string }).measure).toBe('feat:gva')
    expect(kpi.value).not.toHaveProperty('value')
  })

  it('FF-METRIC-FORMAT-GOVERNED — metric format inherited; explicit item.format wins', () => {
    const inherited = featuredToKpiSpec({ metric: 'feat:gva', href: 'x' })
    expect((inherited.value as { format: string }).format).toBe('mln_gel')  // from metric
    const override = featuredToKpiSpec({ metric: 'feat:gva', format: 'decimal2', href: 'x' })
    expect((override.value as { format: string }).format).toBe('decimal2')  // explicit wins
  })

  it('FF-FEATURED-LABEL-CURATION — item.label (region name) wins over the shared metric label', () => {
    const kpi = featuredToKpiSpec({ metric: 'feat:gva', label: { en: 'Tbilisi', ka: 'თბილისი' }, href: 'x' })
    expect(kpi.label).toEqual({ en: 'Tbilisi', ka: 'თბილისი' })
    const noLabel = featuredToKpiSpec({ metric: 'feat:gva', href: 'x' })
    expect(noLabel.label).toEqual({ en: 'Gross Value Added', ka: 'დღ' })   // falls back to metric label
  })

  it('FF-FEATURED-PRELIMINARY — OBS_STATUS "p" at the coordinate derives the badge (Law 9)', () => {
    const [slide] = interpretFeatured(
      [{ metric: 'feat:gdp', at: { geo: 'GE' }, time: 2025, href: 'gdp' }],
      ctx, resolveStore,
    )
    expect(slide.card.preliminary).toBe(true)
  })

  it('FF-FEATURED-TREND-TIME-PINNED — a yoy trend with no time inherits the item time (R2)', () => {
    // The AR-2 R2 root cause: a featured yoy trend omitting `time` fell back to the
    // (unpinned) ctx time on the landing slider → cur/prev both 0 → a stuck "→ 0%".
    // featuredToKpiSpec now threads item.time onto the yoy trend so it reads the
    // pinned period, exactly like the value.
    const kpi = featuredToKpiSpec({
      metric: 'feat:gdp', at: { geo: 'GE' }, time: 2025, href: 'gdp',
      trend: { type: 'yoy', measure: 'feat:gdp', filter: { geo: 'GE' } },
    })
    expect(kpi.trend).toMatchObject({ type: 'yoy', time: 2025 })
    // An explicit trend time is NOT overwritten (author wins).
    const explicit = featuredToKpiSpec({
      metric: 'feat:gdp', at: { geo: 'GE' }, time: 2025, href: 'gdp',
      trend: { type: 'yoy', measure: 'feat:gdp', time: 2023, filter: { geo: 'GE' } },
    })
    expect(explicit.trend).toMatchObject({ time: 2023 })
  })

  it('FF-FEATURED-WARM-ROUTED — each requirement is tagged with the metric dataSource', () => {
    const items: FeaturedItemSpec[] = [
      { metric: 'feat:gva', at: { geo: 'R2', sector: '_T' }, time: 2024, href: 'regional' },
      { metric: 'feat:gdp', at: { geo: 'GE' }, time: 2025, href: 'gdp' },
    ]
    const reqs = extractFeaturedRequirements(items, ctx)
    const gva = reqs.find(r => r.req.code === 'GVA')
    const gdp = reqs.find(r => r.req.code === 'GDP')
    expect(gva?.dataSource).toBe('regional')
    expect(gdp?.dataSource).toBe('gdp')
    // The coordinate is pinned onto the requirement dims (warm === render).
    expect(gva?.req.dims).toMatchObject({ geo: 'R2', sector: '_T', time: 2024 })
  })
})
