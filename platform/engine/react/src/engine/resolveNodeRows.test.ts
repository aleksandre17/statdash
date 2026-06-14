// @vitest-environment node
//
// ── resolveNodeRows characterization tests ──────────────────────────────────
//
//  Regression guard for the storeKey cascade (Phase 0.3 follow-up).
//  Phase 0.3 landed the CASCADE behaviour in renderNode.ts.  These tests pin
//  the resolveStore() contract so a refactor can never silently regress it.
//

import { describe, it, expect } from 'vitest'
import { resolveStore }          from './resolveNodeRows'
import { staticStore }           from '@geostat/engine'
import type { RenderContext }    from './types'

// Minimal DataStore stub — only the fields resolveStore() reads.
function makeStore(id: string) {
  return {
    ...staticStore,
    // add an id field so we can assert which store was returned
    _testId: id,
  } as ReturnType<typeof staticStore.clone> & { _testId: string }
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
    const result = resolveStore(ctx) as typeof accounts
    expect(result._testId).toBe('accounts')
  })

  it('falls back to the first registered store when pageStoreKey is undefined', () => {
    const gdp  = makeStore('gdp')
    const ctx: CtxStub = {
      stores:       { gdp },
      pageStoreKey: undefined,
    }
    const result = resolveStore(ctx) as typeof gdp
    expect(result._testId).toBe('gdp')
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
    const result = resolveStore(ctx) as typeof second
    expect(result._testId).toBe('second')
  })

  it('falls back to first store when pageStoreKey names a missing store', () => {
    // Phase 0.3 regression: a stale storeKey (e.g. after datasource rename)
    // must not crash — it silently falls through to the first registered store.
    const gdp = makeStore('gdp')
    const ctx: CtxStub = {
      stores:       { gdp },
      pageStoreKey: 'nonexistent',
    }
    const result = resolveStore(ctx) as typeof gdp
    expect(result._testId).toBe('gdp')
  })
})
