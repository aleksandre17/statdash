// @vitest-environment node
//
// ── resolveNodeRows characterization tests ──────────────────────────────────
//
//  Regression guard for the storeKey cascade (Phase 0.3 follow-up).
//  Phase 0.3 landed the CASCADE behaviour in renderNode.ts.  These tests pin
//  the resolveStore() contract so a refactor can never silently regress it.
//

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveStore, _storeCache, effectiveStoreKey } from './resolveNodeRows'
import { staticStore, registerMetric }   from '@statdash/engine'
import type { RenderContext, NodeBase }  from './types'

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

// ── FF-MULTISTORE-ROUTES — three real cubes are distinctly routable [M0] ─
//
//  Uses the three SEEDED cube keys (gdp / accounts / regional — see
//  apps/api/scripts/seed-data-sources.ts). A page binding two storeKeys with a
//  node-level override must resolve each to its OWN distinct store, never the
//  page default. Guards renderNode.ts:252 + resolveStore against silent
//  cross-cube regression.

describe('FF-MULTISTORE-ROUTES — distinct cubes route to distinct stores', () => {
  it('a page default + a node-level override resolve to two DIFFERENT real cubes', () => {
    const gdp      = makeStore('gdp')
    const accounts = makeStore('accounts')
    const regional = makeStore('regional')
    const stores   = { gdp, accounts, regional }

    // Page default = gdp.
    const pageResult = resolveStore({ stores, pageStoreKey: 'gdp' })
    // Node override = regional (renderNode threads node.storeKey → pageStoreKey).
    const nodeResult = resolveStore({ stores, pageStoreKey: 'regional' })

    expect(_storeCache.get(gdp)).toBe(pageResult)
    expect(_storeCache.get(regional)).toBe(nodeResult)
    // Distinct stores — the override did NOT bleed into the page default.
    expect(pageResult).not.toBe(nodeResult)
  })

  it('all three seeded cube keys are independently addressable', () => {
    const gdp      = makeStore('gdp')
    const accounts = makeStore('accounts')
    const regional = makeStore('regional')
    const stores   = { gdp, accounts, regional }

    // resolveStore caches on first call — run it before reading the WeakMap.
    const gdpResult      = resolveStore({ stores, pageStoreKey: 'gdp' })
    const accountsResult = resolveStore({ stores, pageStoreKey: 'accounts' })
    const regionalResult = resolveStore({ stores, pageStoreKey: 'regional' })

    expect(_storeCache.get(gdp)).toBe(gdpResult)
    expect(_storeCache.get(accounts)).toBe(accountsResult)
    expect(_storeCache.get(regional)).toBe(regionalResult)
  })
})

// ── FF-METRIC-NAMES-STORE (react half) — the effective-store precedence ─
//
//  PRECEDENCE: explicit node storeKey > metric dataSource > page > 'default'.
//  effectiveStoreKey derives the storeKey renderNode sets as pageStoreKey for a
//  node + its descendants. Locks that a metric's dataSource routes a node, and
//  an explicit node storeKey overrides it.

describe('FF-METRIC-NAMES-STORE — node effective-store precedence', () => {
  beforeEach(() => {
    registerMetric('metric:m-regional', {
      code: 'B1G', label: { en: 'Regional GVA' }, dataSource: 'regional',
    })
    registerMetric('metric:m-nostore', { code: 'D1', label: { en: 'Wages' } })
  })

  const node = (over: Partial<NodeBase>): NodeBase =>
    ({ type: 'kpi', ...over } as NodeBase)

  it('a node whose spec references a metric routes to the metric dataSource', () => {
    const n = node({ data: { type: 'timeseries', code: 'metric:m-regional', years: [2023] } })
    expect(effectiveStoreKey(n)).toBe('regional')
  })

  it('an explicit node storeKey OVERRIDES the metric dataSource', () => {
    const n = node({
      storeKey: 'gdp',
      data:     { type: 'timeseries', code: 'metric:m-regional', years: [2023] },
    })
    expect(effectiveStoreKey(n)).toBe('gdp')
  })

  it('a metric without dataSource falls through (undefined ⇒ page/default kept)', () => {
    const n = node({ data: { type: 'timeseries', code: 'metric:m-nostore', years: [2023] } })
    expect(effectiveStoreKey(n)).toBeUndefined()
  })

  it('a raw-code spec falls through — byte-identical single-store behaviour', () => {
    const n = node({ data: { type: 'timeseries', code: 'B1G', years: [2023] } })
    expect(effectiveStoreKey(n)).toBeUndefined()
  })

  it('a node with no data and no storeKey yields undefined (inherits parent cascade)', () => {
    expect(effectiveStoreKey(node({}))).toBeUndefined()
  })

  it('an explicit storeKey with no data still wins (parent-section override)', () => {
    expect(effectiveStoreKey(node({ storeKey: 'accounts' }))).toBe('accounts')
  })
})
