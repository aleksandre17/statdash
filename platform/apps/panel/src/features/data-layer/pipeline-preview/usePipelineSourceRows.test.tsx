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

beforeEach(() => {
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
