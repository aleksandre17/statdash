// @vitest-environment jsdom
//
// ── useKpiRows × async store — THROUGH-renderNode KPI warm test ─────────────
//
//  The missing regression test for the kpi-strip year-1 cold-throw (ADR-STORE-001).
//  A 'yoy' KPI reads BOTH atTime(year) AND atTime(year-1); the year-1 read is a
//  real store query the DataSpec warm path (useNodeRows / extractRequirements)
//  never saw — the kpi-strip is a SEPARATE read surface (interpretKpis → storeVal).
//
//  Pre-fix: interpretKpis runs synchronously against an async (cold) CachedStore →
//  ApiStore.querySync throws cold for the year-1 cacheKey → NodeErrorBoundary
//  renders 'Failed to load component'.
//  Post-fix: useKpiRows warms every extractKpiRequirements req (INCLUDING year-1),
//  suspends until warm, then interpretKpis reads the warm cache synchronously.
//
//  Also covers the in-flight dedup: a duplicated/concurrent queryAsync for the
//  same key reuses ONE promise (StrictMode double-invoke resilience).
//
//  Engine-agnostic (Law 3): registers its own minimal kpi shell on the singleton
//  registry renderNode reads; the store is a real ApiStore with a mocked fetch.
//

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup }            from '@testing-library/react'
import { createElement, type ReactNode }   from 'react'
import { ApiStore, CachedStore }           from '@statdash/engine'
import type { RawObsRow, EngineRow, DataStore, KpiSpec } from '@statdash/engine'
import { renderNode }                      from './renderNode'
import { nodeRegistry }                    from './register-all'
import { useKpiRows, __kpiPromiseCacheForTest } from './useKpiRows'
import type { RenderContext, NodeBase, NodeDef } from './types'

// ── A leaf KPI shell — renders one marker per resolved KpiDef ───────────────
// Uppercase name: it calls a hook (useKpiRows), so rules-of-hooks requires a
// component/hook name. renderNode invokes it as a React component, so this is sound.
function KpiAsyncShell(def: NodeBase, ctx: RenderContext): ReactNode {
  const items = (def as unknown as { items: KpiSpec[] }).items
  const kpis  = useKpiRows(items, ctx)
  return createElement(
    'ul',
    { 'data-testid': 'kpi-shell' },
    ...kpis.map((k, i) =>
      createElement('li', { key: i, 'data-testid': `kpi-${i}` }, `${k.value}|${k.trendValue}`),
    ),
  )
}

// ── Build a real ApiStore wrapped in CachedStore (mirrors stats-registrations) ─
const BASE = 'https://api.test'
const mapRow = (raw: RawObsRow): EngineRow => ({ ...raw.dim_key, measure: 'GDP', value: raw.obs_value ?? 0 })

function makeLiveStore(): DataStore {
  const api = new ApiStore(BASE, 'GDP_ANNUAL', [], {}, mapRow)
  return new CachedStore(api) as unknown as DataStore
}

// A FRESH Response per call — a Response body reads once; the warm fires several
// fetches (val + obs × year × {year, year-1}).
function okResponse(rows: RawObsRow[]): Response {
  return new Response(JSON.stringify({ data: rows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// The fetch returns rows whose value depends on the requested `from` year — proves
// the year-1 query was actually warmed (and that yoy reads a DIFFERENT value).
function valueForYear(url: string): number {
  const from = new URL(url).searchParams.get('from')
  return from === '2024' ? 100 : 115   // 2024 → 100, 2025 → 115  ⇒ yoy = +15%
}

// ── Minimal RenderContext carrying the live store under key 'main' ──────────
function makeCtx(store: DataStore): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2025 }, timeMode: 'year', perspectiveState: { mode: 'year' } },
    stores:         { main: store },
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    timeModeKey:    'mode',
    mode:           { current: 'year', available: [], set: () => {} },
    effects:        [],
    rows:           [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as unknown as RenderContext
  return holder.ctx
}

const YOY_KPI: KpiSpec = {
  id:    'gdp-yoy',
  label: 'GDP',
  unit:  'mln',
  color: '#000',
  when:  { op: 'perspective-is', perspective: 'year' },
  value: { type: 'point', measure: 'GDP', format: 'mln_gel' },
  trend: { type: 'yoy',   measure: 'GDP' },   // reads atTime(2025) AND atTime(2024)
}

beforeEach(() => {
  __kpiPromiseCacheForTest.clear()
  nodeRegistry.register('kpi-async', 'default', KpiAsyncShell, { category: 'data' })
  vi.spyOn(global, 'fetch')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useKpiRows — async store warms BOTH periods of a yoy KPI', () => {

  it('a yoy KPI resolves its trend with no year-1 cold-throw', async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      okResponse([{ time_period: '2025', dim_key: {}, obs_value: valueForYear(String(input)), obs_status: 'A', obs_attribute: {} }]),
    )

    const node: NodeBase = { type: 'kpi-async', items: [YOY_KPI] } as unknown as NodeBase
    const ctx = makeCtx(makeLiveStore())

    let result!: ReturnType<typeof render>
    await act(async () => {
      result = render(renderNode(node, ctx) as React.ReactElement)
    })

    // The KPI BOUND — NOT the NodeErrorBoundary fallback.
    expect(result.queryByText('Failed to load component')).toBeNull()
    expect(result.getByTestId('kpi-shell')).toBeTruthy()
    // value = 2025 point (115, mln_gel = no decimals); trend = yoy(2025 vs 2024)
    // = (115/100 − 1)×100 = +15% (sign_pct strips the trailing .0).
    expect(result.getByTestId('kpi-0').textContent).toBe('115|+15%')

    // The year-1 (2024) query was actually fetched — the warm covered BOTH periods.
    const urls = vi.mocked(fetch).mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('from=2024&to=2024'))).toBe(true)
    expect(urls.some(u => u.includes('from=2025&to=2025'))).toBe(true)
  })

  it('warms under the EXACT read dims when a KPI filter wildcards a page-pinned dim (no cold-throw)', async () => {
    // REGRESSION (range/dynamics kpi-strip "Failed to load component"): a KPI on a
    // region-pinned page that reads the NATIONAL total wildcards geo (filter geo:'').
    // extractKpiRequirements DELETES geo (withFilter wildcard) so the read's cacheKey
    // carries NO geo. The warm previously rebuilt its ctx as { ...sectionCtx.dims,
    // ...r.dims }, which REINTRODUCED geo='R2' from sectionCtx → warm key had geo,
    // read key did not → cache miss → ApiStore.querySync cold-throw. The fix warms
    // under r.dims VERBATIM.
    vi.mocked(fetch).mockImplementation(async () =>
      okResponse([{ time_period: '2025', dim_key: {}, obs_value: 100, obs_status: 'A', obs_attribute: {} }]),
    )

    const NATIONAL_KPI: KpiSpec = {
      id: 'natl', label: 'GDP (national)', unit: 'mln', color: '#000',
      value: { type: 'point', measure: 'GDP', format: 'mln_gel', filter: { geo: '' } }, // '' = wildcard → drop geo
    }
    const node: NodeBase = { type: 'kpi-async', items: [NATIONAL_KPI] } as unknown as NodeBase

    // A store with `geo` as a non-time dim so a ctx-pinned geo reaches the wire
    // filter — the channel through which the warm/read key could diverge.
    const geoStore = new CachedStore(
      new ApiStore(BASE, 'GDP_ANNUAL', ['geo'], {}, mapRow),
    ) as unknown as DataStore

    // The page pins geo='R2'; the KPI must read across geo (national total).
    const ctx = makeCtx(geoStore)
    ;(ctx.sectionCtx as { dims: Record<string, unknown> }).dims = { time: 2025, geo: 'R2' }

    let result!: ReturnType<typeof render>
    await act(async () => {
      result = render(renderNode(node, ctx) as React.ReactElement)
    })

    // No NodeErrorBoundary fallback — the warm covered the actual (geo-less) read
    // key, so interpretKpis' querySync resolves synchronously instead of cold-throwing.
    expect(result.queryByText('Failed to load component')).toBeNull()
    expect(result.getByTestId('kpi-shell')).toBeTruthy()

    // The warmed request carries NO geo filter (it matches the geo-less read key) —
    // proving the warm used r.dims verbatim, not the geo-reintroducing merge.
    const urls = vi.mocked(fetch).mock.calls.map(c => String(c[0]))
    expect(urls.some(u => u.includes('geo'))).toBe(false)
  })

  it('a duplicated concurrent queryAsync for the same key reuses ONE in-flight promise', async () => {
    // One pending Response — both concurrent calls must share it (no second fetch).
    let resolveFetch!: (r: Response) => void
    const pending = new Promise<Response>((r) => { resolveFetch = r })
    vi.mocked(fetch).mockImplementation(() => pending)

    const store = makeLiveStore()
    const qa    = (store.queryAsync as DataStore['queryAsync'])!.bind(store)
    const ctx2  = { dims: { time: 2025 }, timeMode: 'year' as const }

    // Two concurrent identical val queries — same cacheKey ⇒ one fetch, one promise.
    const p1 = qa({ type: 'val', code: 'GDP' }, ctx2)
    const p2 = qa({ type: 'val', code: 'GDP' }, ctx2)

    expect(fetch).toHaveBeenCalledTimes(1)   // deduped — not 2

    resolveFetch(okResponse([{ time_period: '2025', dim_key: {}, obs_value: 110, obs_status: 'A', obs_attribute: {} }]))
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.state).toBe('done')
    expect(r2.state).toBe('done')
    expect(fetch).toHaveBeenCalledTimes(1)   // still one fetch after settle
  })

})
