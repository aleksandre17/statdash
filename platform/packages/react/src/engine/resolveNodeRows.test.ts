// @vitest-environment node
//
// ── resolveNodeRows characterization tests ──────────────────────────────────
//
//  Regression guard for the storeKey cascade (Phase 0.3 follow-up).
//  Phase 0.3 landed the CASCADE behaviour in renderNode.ts.  These tests pin
//  the resolveStore() contract so a refactor can never silently regress it.
//

import { describe, it, expect }     from 'vitest'
import { resolveStore, _storeCache } from './resolveNodeRows'
import { staticStore }              from '@statdash/engine'
import type { RenderContext }       from './types'

// Minimal DataStore stub — only the fields resolveStore() reads.
// resolveStore() wraps every non-static store in a CachedStore, so the returned
// value is the wrapper, not this object. Routing is verified via the _storeCache
// WeakMap (raw store → wrapper) rather than reading a property off the wrapper —
// this keeps CachedStore's encapsulation intact (no .source leak).
function makeStore(id: string) {
  return {
    ...staticStore,
    _testId: id,
  } as typeof staticStore & { _testId: string }
}

type CtxStub = Pick<RenderContext, 'stores' | 'pageStoreKey'>

describe('resolveStore — storeKey cascade', () => {
  it('returns the store matching pageStoreKey when present', () => {
    const gdp      = makeStore('gdp')
    const accounts = makeStore('accounts')
    const ctx: CtxStub = {
      stores:       { gdp, accounts },
      pageStoreKey: 'accounts',
    }
    const result = resolveStore(ctx)
    // resolveStore wraps `accounts` in a CachedStore — verify routing via the
    // WeakMap: the returned wrapper is the one cached for the `accounts` store.
    expect(_storeCache.get(accounts)).toBe(result)
  })

  it('falls back to the first registered store when pageStoreKey is undefined', () => {
    const gdp  = makeStore('gdp')
    const ctx: CtxStub = {
      stores:       { gdp },
      pageStoreKey: undefined,
    }
    const result = resolveStore(ctx)
    expect(_storeCache.get(gdp)).toBe(result)
  })

  it('falls back to staticStore when stores is empty', () => {
    const ctx: CtxStub = {
      stores:       {},
      pageStoreKey: undefined,
    }
    const result = resolveStore(ctx)
    // staticStore is the canonical fallback — it is a real DataStore object
    expect(result).toBe(staticStore)
  })

  it('pageStoreKey wins over first-registered when the key exists', () => {
    const first  = makeStore('first')
    const second = makeStore('second')
    const ctx: CtxStub = {
      stores:       { first, second },
      pageStoreKey: 'second',
    }
    const result = resolveStore(ctx)
    expect(_storeCache.get(second)).toBe(result)
  })

  it('falls back to first store when pageStoreKey names a missing store', () => {
    // Phase 0.3 regression: a stale storeKey (e.g. after datasource rename)
    // must not crash — it silently falls through to the first registered store.
    const gdp = makeStore('gdp')
    const ctx: CtxStub = {
      stores:       { gdp },
      pageStoreKey: 'nonexistent',
    }
    const result = resolveStore(ctx)
    expect(_storeCache.get(gdp)).toBe(result)
  })
})
