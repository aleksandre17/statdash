// @vitest-environment node
//
// ── resolveNodeRows characterization tests ──────────────────────────────────
//
//  Regression guard for the storeKey cascade (Phase 0.3 follow-up).
//  Phase 0.3 landed the CASCADE behaviour in renderNode.ts.  These tests pin
//  the resolveStore() contract so a refactor can never silently regress it.
//

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveStore, _storeCache, effectiveStoreKey, resolveNodeRows, _resolveRowLocales } from './resolveNodeRows'
import { staticStore, registerMetric, ExternalStore, tagLocaleString } from '@statdash/engine'
import type { RenderContext, NodeBase }  from './types'
import type { DataStore, SectionContext } from '@statdash/engine'

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

// ── GAP 5b — i18n boundary: LocaleString labels resolve to ctx.locale ─────────
//
//  Display labels are carried END-TO-END as LocaleString `{ en, ka }` (the store
//  builder runs at boot with no user locale). They enter rows via the `$d` lookup
//  join. resolveNodeRows is the React render boundary that resolves them to the
//  active locale so a locale-agnostic chart/table never sees `[object Object]`.

function makeRowCtx(store: DataStore, locale: string): RenderContext {
  const sectionCtx: SectionContext = { dims: { time: 2024 } }
  return {
    sectionCtx,
    stores:         { main: store },
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale,
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:           { current: 'year', available: [], set: () => {} },
    effects:        [],
    rows:           [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     () => null,
  } as unknown as RenderContext
}

describe('resolveNodeRows — LocaleString resolution at the React boundary', () => {
  // A store whose `geo` display overlay carries LocaleString labels {en,ka}.
  function makeStore(): DataStore {
    return new ExternalStore(
      [{ measure: 'GDP', geo: 'GE', time: 2024, value: 100 }],
      {
        classifiers: { geo: [{ code: 'GE' }] },
        display:     { geo: { GE: { label: { en: 'Georgia', ka: 'საქართველო' } } } },
      },
    )
  }

  // A query node whose pipe joins the `geo` display label onto each row via $d.
  const labelNode: NodeBase = {
    type: 'chart',
    data: {
      type:  'query',
      query: { measure: 'GDP' },
      pipe:  [{ op: 'lookup', from: { $d: 'geo' }, key: 'geo', fields: ['label'] }],
      // encoding.label selects the joined display label as DataRow.label — the
      // LocaleString flows through to the row, then resolveNodeRows resolves it.
      encoding: { label: 'label', value: 'value' } as never,
    },
  } as unknown as NodeBase

  it("resolves a LocaleString label to the active locale ('ka')", () => {
    const rows = resolveNodeRows(labelNode, makeRowCtx(makeStore(), 'ka'))
    expect((rows[0] as { label: unknown }).label).toBe('საქართველო')
  })

  it("resolves the same row to 'en' under an English locale (real i18n end-to-end)", () => {
    const rows = resolveNodeRows(labelNode, makeRowCtx(makeStore(), 'en'))
    expect((rows[0] as { label: unknown }).label).toBe('Georgia')
  })

  it('leaves a plain scalar label untouched (no-op for single-locale stores)', () => {
    const store = new ExternalStore(
      [{ measure: 'GDP', geo: 'GE', time: 2024, value: 100 }],
      { classifiers: { geo: [{ code: 'GE' }] }, display: { geo: { GE: { label: 'Georgia' } } } },
    )
    const rows = resolveNodeRows(labelNode, makeRowCtx(store, 'ka'))
    expect((rows[0] as { label: unknown }).label).toBe('Georgia')
  })
})

describe('resolveRowLocales — positive identification (Protected Variations, Law 9)', () => {
  // POSITIVE identification: resolveRowLocales localizes ONLY a cell TAGGED at its
  // i18n origin (the `$d` join → tagLocaleString). The old structure-only test
  // flattened ANY plain object — collapsing DataRow.provenance (a ProvenanceRecord)
  // to a random scalar via Object.values(s)[0], silently killing
  // resolvePreliminary.rowIsPreliminary (r.provenance?.status → undefined ⇒ no
  // preliminary/last-updated/methodology badge). The Symbol brand removes the
  // shape-guess entirely: an UNTAGGED object — provenance, seriesFormat, or any
  // FUTURE object metadata key a new join might surface — is never touched.

  it('a row with BOTH a $d label LocaleString AND a provenance object: label localized, provenance intact', () => {
    // The label is a tagged LocaleString (exactly what the `$d` display-attr join
    // emits via resolveDisplayRef → tagLocaleString). provenance is an UNTAGGED
    // plain object — structurally identical to a LocaleString, yet must survive.
    const row = {
      id: 'r1', value: 100,
      label:      tagLocaleString({ en: 'GDP', ka: 'მშპ' }),
      provenance: { status: 'p', source: 'StatsOffice', methodology: 'https://x' },
    } as unknown as import('@statdash/engine').DataRow

    const [out] = _resolveRowLocales([row], 'ka')

    // The tagged label → concrete 'ka' string (the i18n boundary still works).
    expect((out as { label: unknown }).label).toBe('მშპ')
    // provenance survives as the ORIGINAL object — never flattened to a scalar.
    expect((out as { provenance: { status?: string } }).provenance).toEqual({
      status: 'p', source: 'StatsOffice', methodology: 'https://x',
    })
    expect((out as { provenance: { status?: string } }).provenance.status).toBe('p')
  })

  it('an UNTAGGED object that happens to look like a LocaleString is left untouched', () => {
    // The Protected-Variations win: a NEW object-valued field (here a fictitious
    // `meta` carrier a future $cl join might surface) is NOT structure-guessed into
    // a label — only the genuinely tagged `label` is resolved.
    const row = {
      id: 'r2', value: 1,
      label: tagLocaleString({ en: 'Wages', ka: 'ხელფასი' }),
      meta:  { en: 'not a label', ka: 'არც ეს' },      // looks like a LocaleString, but UNTAGGED
      seriesFormat: { 'Series A': 'mln_gel', 'Series B': 'pct' },
    } as unknown as import('@statdash/engine').DataRow

    const [out] = _resolveRowLocales([row], 'ka')
    // label (tagged) is resolved …
    expect((out as { label: unknown }).label).toBe('ხელფასი')
    // … while the untagged objects survive structurally intact.
    expect((out as unknown as { meta: unknown }).meta).toEqual({ en: 'not a label', ka: 'არც ეს' })
    expect((out as unknown as { seriesFormat: unknown }).seriesFormat).toEqual({
      'Series A': 'mln_gel', 'Series B': 'pct',
    })
  })
})
