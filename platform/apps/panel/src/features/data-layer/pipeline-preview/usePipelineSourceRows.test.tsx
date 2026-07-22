// ── usePipelineSourceRows — the read routes to the metric's DECLARED store (M1) ──
//
//  Regression gate for the WIRE-PROVEN defect (card 0082, debugger leg): the workbench
//  preview read grabbed the FIRST live-map store (the PAGE's store) instead of the store
//  the governed head's metric declares (`dataSource`). A `gdp`-sourced metric browsed on
//  a regional page then read the REGIONAL store — 0 (or foreign) live rows — while every
//  engine fixture, which resolves against the metric's OWN store, stayed green (the exact
//  gap that let it slip). The hook must route through the SAME SSOT the renderer uses
//  (renderNode → effectiveStoreKey → specDataSource → resolveStore), never a second
//  routing rule, so warm ≡ read against the right cube.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Observation, SourceStep } from '@statdash/engine'
import { ExternalStore, registerMetric } from '@statdash/engine'
import { usePipelineSourceRows } from './usePipelineSourceRows'

// Two DISTINGUISHABLE stores under DIFFERENT keys. Both answer the SAME measure code but
// with DIFFERENT values — so the assertion proves ROUTING, not mere presence: the wrong
// (page) store yields 999, the metric's own store yields 500.
const GDP_OBS: Observation[]      = [{ measure: 'GDPCODE', value: 500, time: 2020, geo: 'GE' }]
const REGIONAL_OBS: Observation[] = [{ measure: 'GDPCODE', value: 999, time: 2020, geo: 'GE' }]
const gdpStore      = new ExternalStore(GDP_OBS)
const regionalStore = new ExternalStore(REGIONAL_OBS)

// The live map is keyed { REGIONAL_GVA (the page store — FIRST), gdp } — REGIONAL_GVA is
// the Object.keys()[0] the old code grabbed. status 'live' so the hook reads it. Same
// relative specifiers the hook itself imports (test co-located with the hook).
vi.mock('../../../canvas/useLivePreviewStores', () => ({
  useLivePreviewStores: () => ({
    stores: { REGIONAL_GVA: regionalStore, gdp: gdpStore },
    status: 'live',
  }),
}))
vi.mock('../../../inspector/useActiveLocales', () => ({
  useActiveLocales: () => ['en'],
}))

// The active page's declared store home (`config.storeKey` — 'gdp' on the live gdp page,
// confirmed live via GET /api/config/pages/:id). Mocked per-test via `mockPageStoreKey`.
let mockPageStoreKey: string | undefined
vi.mock('../../../store/constructor.store', () => ({
  useActivePage: () => (mockPageStoreKey ? { meta: { storeKey: mockPageStoreKey } } : null),
}))

beforeEach(() => {
  mockPageStoreKey = undefined
  // A GOVERNED base metric that DECLARES its own cube (dataSource 'gdp') — the exact M1
  // shape the renderer routes by; its components live in the gdp cube, not the page's.
  registerMetric('metric:m-gdp', { code: 'GDPCODE', label: { en: 'GDP' }, dataSource: 'gdp' })
})

describe('usePipelineSourceRows — routes to the metric-declared store, not the page store', () => {
  it('a gdp-sourced head on a regional page reads the gdp store (500), never the first/page store (999)', () => {
    const head: SourceStep = { op: 'source', metrics: ['metric:m-gdp'] }
    const { result } = renderHook(() => usePipelineSourceRows(head, { label: 'geo' }))

    expect(result.current.status).toBe('ok')
    const values = result.current.sourceRows.map((r) => (r as { value?: number }).value)
    expect(values).toContain(500)      // the metric's OWN store (routed by dataSource)
    expect(values).not.toContain(999)  // NOT the first live-map (page) store
  })

  it('an unbound head is the honest `unbound` state (no store read at all)', () => {
    const { result } = renderHook(() => usePipelineSourceRows(undefined, { label: 'geo' }))
    expect(result.current.status).toBe('unbound')
  })
})

// ── Residual (0122 R1 recheck): a RAW/ungoverned wildcard head has NO metric to route
// by — specDataSource(sourceSpec) is undefined for `measure:'*'` — so the ONLY thing
// standing between the read and the manifest's blind first-key fallback is the ACTIVE
// PAGE's own declared storeKey (mirrors SiteRenderer.tsx's `page.storeKey` cascade tier).
// Live proof: the gdp page's "expenditure" section (`query:{measure:'*',
// filter:{approach:'EXP',geo:'GE',time:{$ctx:'time'}}}`) read REGIONAL_GVA (the
// manifest's first-inserted key, session/DB-row-order dependent) instead of GDP_ANNUAL
// (the page's declared 'gdp' store) — a dimension-mismatched cube, 0 rows, while canvas
// (which threads page.storeKey) rendered full data.
describe('usePipelineSourceRows — a raw wildcard head (no metric) routes via the PAGE storeKey, never the blind first-key', () => {
  it('measure:"*" with no dataSource reads the page-declared store (500), never the manifest first-key store (999)', () => {
    mockPageStoreKey = 'gdp'
    const head: SourceStep = { op: 'source', query: { measure: '*' } }
    const { result } = renderHook(() => usePipelineSourceRows(head, { label: 'geo' }))

    expect(result.current.status).toBe('ok')
    const values = result.current.sourceRows.map((r) => (r as { value?: number }).value)
    expect(values).toContain(500)      // the page's OWN declared store ('gdp')
    expect(values).not.toContain(999)  // NOT the manifest's first-inserted (REGIONAL_GVA) key
  })

  it('with no page storeKey declared either, falls back to the manifest first-key (byte-identical pre-fix behaviour)', () => {
    mockPageStoreKey = undefined
    const head: SourceStep = { op: 'source', query: { measure: '*' } }
    const { result } = renderHook(() => usePipelineSourceRows(head, { label: 'geo' }))

    expect(result.current.status).toBe('ok')
    const values = result.current.sourceRows.map((r) => (r as { value?: number }).value)
    expect(values).toContain(999) // no routing signal at all ⇒ first-key fallback, unchanged
  })
})
