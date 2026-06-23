// @vitest-environment node
//
// ── warmPageStore characterization tests ──────────────────────────────────────
//
//  Pins the behaviour of warmPageStore:
//    - walks the page node tree, collects all DataSpec requirements via
//      extractRequirements (static analysis only),
//    - calls store.warm(reqs) on the resolved CachedStore.
//
//  Implementation note:
//    resolveStore() (called by warmPageStore) wraps non-staticStore sources in
//    CachedStore. CachedStore itself has warm(). The test therefore spies on
//    CachedStore.warm via _storeCache (the test-only WeakMap escape hatch).
//
//  Scenarios:
//    1. Warmable store (CachedStore wrapper) → warm() called.
//    2. Store without .warm (staticStore) → no crash, no-op.
//    3. Page with no data nodes → warm called with empty array.
//    4. Page with a data-bearing node → warm called with non-empty requirements.
//

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { warmPageStore }                          from './warm'
import { staticStore }                            from '@statdash/engine'
import type { StaticRenderContext }               from './html'
import type { NodePageConfig }                    from '../types'
import { _storeCache }                            from '../resolveNodeRows'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a plain object to NodePageConfig for structural mocking. */
function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

/**
 * Minimal StaticRenderContext.
 * warmPageStore only reads: stores, pageStoreKey, sectionCtx.
 * Other fields are present to satisfy the type.
 */
function makeStaticCtx(
  stores: Record<string, import('@statdash/engine').DataStore>,
  pageStoreKey?: string,
): StaticRenderContext {
  return {
    sectionCtx: {
      dims:     { time: 2024 },
      timeMode: 'year' as const,
    },
    stores,
    pageStoreKey,
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    timeModeKey:    'mode',
    mode: {
      current:   'year',
      available: [],
      set:       () => {},
    },
    effects: [],
  }
}

/**
 * Build a raw DataStore (spread of staticStore with a unique marker).
 * resolveStore() wraps it in CachedStore; CachedStore has warm().
 * We spy on warm via _storeCache after warmPageStore runs.
 */
function makeRawStore() {
  return { ...staticStore, _marker: Symbol('test-store') }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('warmPageStore — CachedStore.warm is called', () => {

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls CachedStore.warm() when the resolved store has a warm method', () => {
    const rawStore  = makeRawStore()
    const staticCtx = makeStaticCtx({ main: rawStore }, 'main')
    const page      = asPage({ type: 'inner-page', children: [] })

    // Spy must be set up BEFORE calling warmPageStore so it captures the call.
    // resolveStore() creates the CachedStore on first use — run once to prime.
    warmPageStore(page, staticCtx)

    // Now the CachedStore exists in _storeCache — check warm was invoked.
    const cached = _storeCache.get(rawStore)
    expect(cached).toBeDefined()
    // warm() called with the requirements array (empty for an empty page).
    // We verify by running again with a spy.
    const warmSpy = vi.spyOn(cached!, 'warm')
    warmPageStore(page, staticCtx)
    expect(warmSpy).toHaveBeenCalledTimes(1)
  })

  it('warm() receives a non-empty requirements array for a data-bearing node', () => {
    const rawStore  = makeRawStore()
    const staticCtx = makeStaticCtx({ main: rawStore }, 'main')

    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: {
            type: 'row-list',
            rows: [{ code: 'GDP' }],
          },
        },
      ],
    })

    // Prime the CachedStore.
    warmPageStore(page, staticCtx)

    const cached   = _storeCache.get(rawStore)!
    const warmSpy  = vi.spyOn(cached, 'warm')
    warmPageStore(page, staticCtx)

    expect(warmSpy).toHaveBeenCalledTimes(1)
    const [reqs] = warmSpy.mock.calls[0]
    expect(Array.isArray(reqs)).toBe(true)
    expect(reqs.length).toBeGreaterThan(0)
    expect(reqs[0]).toMatchObject({ code: 'GDP' })
  })

  it('page with no data nodes → warm called with empty array', () => {
    const rawStore  = makeRawStore()
    const staticCtx = makeStaticCtx({ main: rawStore }, 'main')

    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', children: [] },
      ],
    })

    warmPageStore(page, staticCtx)

    const cached  = _storeCache.get(rawStore)!
    const warmSpy = vi.spyOn(cached, 'warm')
    warmPageStore(page, staticCtx)

    expect(warmSpy).toHaveBeenCalledTimes(1)
    const [reqs] = warmSpy.mock.calls[0]
    expect(reqs).toEqual([])
  })

  it('collects requirements from nested children', () => {
    const rawStore  = makeRawStore()
    const staticCtx = makeStaticCtx({ main: rawStore }, 'main')

    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type:     'section',
          children: [
            {
              type: 'chart',
              data: {
                type: 'row-list',
                rows: [{ code: 'B1G' }, { code: 'D1' }],
              },
            },
          ],
        },
      ],
    })

    warmPageStore(page, staticCtx)

    const cached  = _storeCache.get(rawStore)!
    const warmSpy = vi.spyOn(cached, 'warm')
    warmPageStore(page, staticCtx)

    const [reqs] = warmSpy.mock.calls[0]
    expect(reqs).toHaveLength(2)
    const codes = (reqs as { code: string }[]).map(r => r.code)
    expect(codes).toContain('B1G')
    expect(codes).toContain('D1')
  })

  it('uses the store registered at pageStoreKey', () => {
    const targetRaw = makeRawStore()
    const otherRaw  = makeRawStore()

    const staticCtx = makeStaticCtx(
      { other: otherRaw, target: targetRaw },
      'target',
    )
    const page = asPage({ type: 'inner-page', children: [] })

    // Prime both stores in the cache by calling once each.
    warmPageStore(page, staticCtx)
    warmPageStore(page, makeStaticCtx({ other: otherRaw }, 'other'))

    const targetCached = _storeCache.get(targetRaw)!
    const otherCached  = _storeCache.get(otherRaw)!
    const targetSpy    = vi.spyOn(targetCached, 'warm')
    const otherSpy     = vi.spyOn(otherCached,  'warm')

    warmPageStore(page, staticCtx)

    expect(targetSpy).toHaveBeenCalledTimes(1)
    expect(otherSpy).not.toHaveBeenCalled()
  })

})

describe('warmPageStore — store without warm method (staticStore)', () => {

  it('does not crash when the resolved store has no warm method', () => {
    const staticCtx = makeStaticCtx({ main: staticStore }, 'main')
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })

    // staticStore is returned as-is (not wrapped in CachedStore) — no warm method.
    expect(() => warmPageStore(page, staticCtx)).not.toThrow()
  })

  it('no-op when store has no warm — returns undefined', () => {
    const staticCtx = makeStaticCtx({ main: staticStore })
    const page      = asPage({ type: 'inner-page', children: [] })

    const result = warmPageStore(page, staticCtx)

    expect(result).toBeUndefined()
  })

})
