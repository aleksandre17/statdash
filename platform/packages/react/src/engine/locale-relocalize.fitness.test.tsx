// @vitest-environment jsdom
//
// ── FF-LOCALE-RELOCALIZE — data-derived labels re-localize on a CLIENT toggle ─
//
//  Regression lock for the locale-switcher (ქარ↔ENG) bug: config text (nav /
//  section titles) flipped correctly, but DATA-DERIVED labels (map region names,
//  table row labels, KPI card labels/units, chart legend) stayed in the pre-toggle
//  language until a full page reload.
//
//  ROOT: on an ASYNC store (caps.sync === false — the live ApiStore path) the row/
//  KPI resolution is served from a MODULE-LEVEL promise cache. The cache key spanned
//  the covering FETCH (specDimKey ⊕ vars ⊕ store) + client recipe — but NOT the
//  active LOCALE. A locale toggle is React state (useLocale), not a URL reload, so the
//  key was unchanged → the PRE-TOGGLE promise (resolved at the old locale) was re-
//  served → stale labels. The label-localization itself (resolveRowLocales /
//  interpretKpi's resolveTemplate) always used the current locale — but it only re-runs
//  when the memo/promise-cache IDENTITY changes. The SYNC path re-runs resolveNodeRows
//  every render, so a fresh /en|/ka URL load was always correct (this is why the bug was
//  reload-only). The fix folds ctx.locale into depKey (useNodeRows) and the kpi depKey
//  (useKpiRows), so a toggle mints a NEW cache entry that re-resolves at the new locale.
//
//  These tests exercise the REAL async path (caps.sync === false, promise cache +
//  React.use()/Suspense) and assert a rendered DATA label switches ka↔en on a
//  rerender WITHOUT remounting/reloading (result.rerender, not a fresh render).
//

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup }                        from '@testing-library/react'
import { createElement, Suspense, type ReactNode }     from 'react'
import { staticStore, tagLocaleString }                from '@statdash/engine'
import type { DataStore, EngineRow, QueryResult, SectionContext, StoreQuery, KpiSpec } from '@statdash/engine'
import type { NodeBase, RenderContext }                from './types'
import { useNodeRows, __promiseCacheForTest }          from './useNodeRows'
import { useKpiRows, __kpiPromiseCacheForTest }        from './useKpiRows'
import { NodeErrorBoundary }                           from './NodeErrorBoundary'

// ── Shared RenderContext factory — locale threaded onto BOTH ctx.locale (the
//  useNodeRows depKey field) and sectionCtx.locale (the interpretKpi resolveTemplate
//  field), exactly as SiteRenderer wires them. Everything else is stable across the
//  two renders so ONLY the locale axis moves. ──────────────────────────────────────
function makeCtx(store: DataStore, locale: string): RenderContext {
  const sectionCtx = {
    dims:             { time: 2024 },
    perspectiveState: { mode: 'year' },
    locale,
    fallbackLocale:   'en',
  } as unknown as SectionContext
  return {
    sectionCtx,
    stores:         { main: store },
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale,
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:    { current: 'year', available: [], set: () => {} },
    rows:           [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     () => null,
  } as unknown as RenderContext
}

// ── useNodeRows surface — map/table/chart rows ─────────────────────────────────

describe('FF-LOCALE-RELOCALIZE — useNodeRows re-localizes data labels on toggle', () => {

  // Async store: queryAsync warms; querySync obs returns the warmed rows (which carry a
  // TAGGED LocaleString label — the `$d` display-join carrier), val returns a scalar.
  // Mirrors ApiStore's cold-throw contract so the warm-then-read path is exercised.
  function makeAsyncStore(rows: EngineRow[]): DataStore {
    let warm = false
    return {
      ...staticStore,
      caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: false },
      async queryAsync(_q: StoreQuery, _ctx: SectionContext): Promise<QueryResult> {
        warm = true
        return { state: 'done', data: rows }
      },
      querySync(q: StoreQuery, _ctx: SectionContext): EngineRow[] {
        if (!warm) throw new Error('cold cache — caps.sync=false; queryAsync must warm first')
        if (q.type === 'val') return [{ value: rows[0]?.['value'] ?? 0 }]
        return rows
      },
    } as DataStore
  }

  function LabelWrapper({ node, ctx }: { node: NodeBase; ctx: RenderContext }): ReactNode {
    const rows = useNodeRows(node, ctx)
    const first = rows[0] as unknown as Record<string, unknown> | undefined
    return createElement('div', { 'data-testid': 'label' }, String(first?.['geoLabel'] ?? ''))
  }

  function tree(node: NodeBase, ctx: RenderContext): ReactNode {
    return createElement(
      Suspense,
      { fallback: createElement('div', { 'data-testid': 'skeleton' }, '...') },
      createElement(NodeErrorBoundary, { node, children: createElement(LabelWrapper, { node, ctx }) }),
    )
  }

  beforeEach(() => { __promiseCacheForTest.clear(); cleanup() })
  afterEach(cleanup)

  it('a data-derived label switches en→ka on a rerender (no remount, no reload)', async () => {
    // One TAGGED LocaleString label cell — the shape resolveRowLocales localizes.
    const rows: EngineRow[] = [
      { geo: 'GE', value: 111, geoLabel: tagLocaleString({ en: 'Georgia', ka: 'საქართველო' }) } as unknown as EngineRow,
    ]
    const store = makeAsyncStore(rows)
    const node: NodeBase = {
      type: 'panel',
      id:   'n1',
      data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
    } as NodeBase

    let result!: ReturnType<typeof render>
    // Initial load at 'en'.
    await act(async () => { result = render(tree(node, makeCtx(store, 'en'))) })
    expect(result.getByTestId('label').textContent).toBe('Georgia')
    expect(__promiseCacheForTest.size).toBe(1)

    // Client toggle → 'ka'. Same mounted tree (rerender), same store, only locale moves.
    await act(async () => { result.rerender(tree(node, makeCtx(store, 'ka'))) })
    expect(result.getByTestId('label').textContent).toBe('საქართველო')
    // A NEW cache entry proves locale is part of the label-bearing identity (pre-fix: 1).
    expect(__promiseCacheForTest.size).toBe(2)

    // Toggle back → 'en'. Re-serves the first entry; label returns to English.
    await act(async () => { result.rerender(tree(node, makeCtx(store, 'en'))) })
    expect(result.getByTestId('label').textContent).toBe('Georgia')
    expect(__promiseCacheForTest.size).toBe(2)
  })
})

// ── useKpiRows surface — KPI card labels ───────────────────────────────────────

describe('FF-LOCALE-RELOCALIZE — useKpiRows re-localizes card labels on toggle', () => {

  // Async KPI store: queryAsync warms; querySync val returns a scalar so interpretKpis'
  // storeVal read resolves synchronously post-warm.
  function makeKpiAsyncStore(): DataStore {
    let warm = false
    return {
      ...staticStore,
      caps: { queryTypes: ['val', 'obs'], batching: false, streaming: false, sync: false },
      async queryAsync(_q: StoreQuery, _ctx: SectionContext): Promise<QueryResult> {
        warm = true
        return { state: 'done', data: [{ value: 100 } as EngineRow] }
      },
      querySync(_q: StoreQuery, _ctx: SectionContext): EngineRow[] {
        if (!warm) throw new Error('cold cache — caps.sync=false')
        return [{ value: 100 } as EngineRow]
      },
    } as DataStore
  }

  // label is a LocaleString — interpretKpi resolves it to sectionCtx.locale (resolveTemplate).
  const KPI: KpiSpec = {
    id:    'gdp',
    label: { en: 'GDP', ka: 'მშპ' } as unknown as KpiSpec['label'],
    unit:  '',
    color: '#000',
    value: { type: 'point', measure: 'GDP', format: 'mln_gel' },
  } as unknown as KpiSpec

  function KpiWrapper({ ctx }: { ctx: RenderContext }): ReactNode {
    const kpis = useKpiRows([KPI], ctx)
    return createElement('div', { 'data-testid': 'kpi-label' }, String(kpis[0]?.label ?? ''))
  }

  function tree(ctx: RenderContext): ReactNode {
    const node = { type: 'kpi-strip' } as unknown as NodeBase
    return createElement(
      Suspense,
      { fallback: createElement('div', { 'data-testid': 'skeleton' }, '...') },
      createElement(NodeErrorBoundary, { node, children: createElement(KpiWrapper, { ctx }) }),
    )
  }

  beforeEach(() => { __kpiPromiseCacheForTest.clear(); cleanup() })
  afterEach(cleanup)

  it('a KPI card label switches en→ka on a rerender (no remount, no reload)', async () => {
    const store = makeKpiAsyncStore()

    let result!: ReturnType<typeof render>
    await act(async () => { result = render(tree(makeCtx(store, 'en'))) })
    expect(result.getByTestId('kpi-label').textContent).toBe('GDP')
    expect(__kpiPromiseCacheForTest.size).toBe(1)

    await act(async () => { result.rerender(tree(makeCtx(store, 'ka'))) })
    expect(result.getByTestId('kpi-label').textContent).toBe('მშპ')
    expect(__kpiPromiseCacheForTest.size).toBe(2)
  })
})
