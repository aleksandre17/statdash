// @vitest-environment node
//
// ── SSR sync fast-lane fitness test [N34c / risk #1] ────────────────────────
//
//  From docs/plan/N34/09-risk-adr.md risk #1:
//    "If the rename accidentally routes SSR through queryAsync, snapshots break."
//
//  This test spies on the resolved store to assert that renderPageToJSON calls
//  ONLY querySync and NEVER queryAsync. It locks the SSR synchronous fast-lane
//  against accidental async regression.
//
//  Law: interpretSpec stays synchronous over querySync — never changes.
//  Law: SSR (renderPageToJSON / renderPageToHTML) always uses querySync only.
//

import { describe, it, expect, vi } from 'vitest'
import { renderPageToJSON }          from './api'
import type { StaticRenderContext }  from './html'
import { staticStore }               from '@statdash/engine'
import type { DataStore, EngineRow, QueryResult, SectionContext, StoreQuery } from '@statdash/engine'
import type { NodePageConfig }       from '../types'

// ── Helper: a spy store that tracks which methods were called ─────────────

function makeSpyStore(): DataStore & { _syncCalls: number; _asyncCalls: number } {
  const spy = {
    ...staticStore,
    _syncCalls:  0,
    _asyncCalls: 0,

    querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
      spy._syncCalls++
      return staticStore.querySync(q, ctx)
    },

    async queryAsync(_q: StoreQuery, _ctx: SectionContext): Promise<QueryResult> {
      spy._asyncCalls++
      return { state: 'done', data: [] }
    },

    caps: {
      queryTypes: ['obs', 'val'] as const,
      batching:   false,
      streaming:  false,
      // sync: true (default) — this store is sync-capable
      sync:       true,
    },
  }
  return spy
}

function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

// ── SSR spy tests ─────────────────────────────────────────────────────────

describe('SSR fast-lane — renderPageToJSON uses only querySync (N34 risk #1)', () => {

  it('empty page — queryAsync is never called', () => {
    const store = makeSpyStore()
    const ctx: StaticRenderContext = {
      sectionCtx:     { dims: { time: 2024 } },
      stores:         { main: store },
      filterParams:   {},
      vars:           {},
      locale:         'en',
      fallbackLocale: 'en',
      perspectiveKey: 'mode',
      perspective:    { current: 'year', available: [], set: () => {} },
      effects:        [],
    }

    renderPageToJSON(asPage({ type: 'inner-page', children: [] }), ctx)

    expect(store._asyncCalls).toBe(0)
  })

  it('page with data node — queryAsync is never called (querySync may be called or throw, async path is never entered)', () => {
    const store = makeSpyStore()
    const ctx: StaticRenderContext = {
      sectionCtx:     { dims: { time: 2024 } },
      stores:         { main: store },
      filterParams:   {},
      vars:           {},
      locale:         'en',
      fallbackLocale: 'en',
      perspectiveKey: 'mode',
      perspective:    { current: 'year', available: [], set: () => {} },
      effects:        [],
    }

    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', data: { type: 'row-list', rows: [{ code: 'GDP' }] } },
        { type: 'section', data: { type: 'row-list', rows: [{ code: 'INF' }] } },
      ],
    })

    // renderPageToJSON must not throw even if data resolution errors internally
    expect(() => renderPageToJSON(page, ctx)).not.toThrow()
    // The async path MUST NEVER be entered in SSR — this is the N34 risk #1 invariant
    expect(store._asyncCalls).toBe(0)
  })

  it('deeply nested page — queryAsync is never called at any depth', () => {
    const store = makeSpyStore()
    const ctx: StaticRenderContext = {
      sectionCtx:     { dims: { time: 2024 } },
      stores:         { main: store },
      filterParams:   {},
      vars:           {},
      locale:         'en',
      fallbackLocale: 'en',
      perspectiveKey: 'mode',
      perspective:    { current: 'year', available: [], set: () => {} },
      effects:        [],
    }

    const page = asPage({
      type: 'inner-page',
      children: [
        {
          type: 'section',
          children: [
            { type: 'panel', data: { type: 'row-list', rows: [{ code: 'GDP' }] } },
          ],
          data: { type: 'row-list', rows: [{ code: 'TOT' }] },
        },
      ],
    })

    renderPageToJSON(page, ctx)

    expect(store._asyncCalls).toBe(0)
  })

  it('a store with caps.sync === true — queryAsync is never called', () => {
    // Explicit sync: true — same assertion as the default but with explicit flag.
    const store = makeSpyStore()
    expect(store.caps!.sync).toBe(true)  // pre-condition

    const ctx: StaticRenderContext = {
      sectionCtx:     { dims: { time: 2024 } },
      stores:         { main: store },
      filterParams:   {},
      vars:           {},
      locale:         'en',
      fallbackLocale: 'en',
      perspectiveKey: 'mode',
      perspective:    { current: 'year', available: [], set: () => {} },
      effects:        [],
    }

    renderPageToJSON(asPage({
      type: 'inner-page',
      children: [
        { type: 'section', data: { type: 'row-list', rows: [{ code: 'GDP' }] } },
      ],
    }), ctx)

    expect(store._asyncCalls).toBe(0)
  })

  it('vi.spyOn variant — queryAsync spy call count is 0 after renderPageToJSON', () => {
    // Complementary spy using vi.spyOn to assert from the vitest spy perspective.
    const store    = makeSpyStore()
    const asyncSpy = vi.spyOn(store, 'queryAsync')

    const ctx: StaticRenderContext = {
      sectionCtx:     { dims: { time: 2024 } },
      stores:         { main: store },
      filterParams:   {},
      vars:           {},
      locale:         'en',
      fallbackLocale: 'en',
      perspectiveKey: 'mode',
      perspective:    { current: 'year', available: [], set: () => {} },
      effects:        [],
    }

    renderPageToJSON(asPage({
      type:     'inner-page',
      children: [
        { type: 'section', data: { type: 'row-list', rows: [{ code: 'GDP' }] } },
      ],
    }), ctx)

    expect(asyncSpy).not.toHaveBeenCalled()
  })

})
