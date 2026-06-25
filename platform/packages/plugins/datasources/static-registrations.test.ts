// @vitest-environment node
//
// ── Fitness: the 'static' source kind (ADR adr_data_source_reference_spectrum) ──
//
//  FF-STATIC-KIND       — a { kind:'static', params:{ values } } descriptor builds
//                         via buildStoreManifest into a DataStore that serves its
//                         values through querySync — identical rows, ZERO network.
//  FF-SOURCE-KIND-CLOSED — the kind-dispatch is OCP: registering a brand-new kind
//                         is one registerStoreBuilder call, reachable through the
//                         same buildStoreManifest registry, with no resolver edit.
//
//  These run in a bare node env (no fetch, no DOM) — so a passing 'static' build
//  proves the offline/round-trip invariant: the store needs no backend at all.

import { describe, it, expect, vi } from 'vitest'
import {
  registeredKinds,
  buildStoreManifest,
  registerStoreBuilder,
  getStoreCapabilities,
  getSourceMetadata,
  testSource,
} from '@statdash/react/engine'
import type { DatasourceInstanceConfig, Observation } from '@statdash/engine'
import {
  registerStoreBuilders, registerStaticStoreBuilder,
  deriveStaticMetadata, testStaticSource, toSourceDescriptor, typeForKind,
} from './index'

describe("'static' source kind — FF-STATIC-KIND", () => {
  it('registers a reachable static kind via the shared boot fn', () => {
    registerStoreBuilders()
    expect(registeredKinds()).toContain('static')
  })

  it('builds a zero-network DataStore that serves its inline values', async () => {
    registerStaticStoreBuilder()

    const values: Observation[] = [
      { measure: 'GDP', time: 2020, value: 100 },
      { measure: 'GDP', time: 2021, value: 110 },
      { measure: 'CPI', time: 2021, value: 5 },
    ]
    const cfg: DatasourceInstanceConfig = {
      id:     'demo',
      kind:   'static',
      params: { values },
    }

    // Guard: building a static store must touch NO network.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const stores = await buildStoreManifest([cfg])
    const store  = stores['demo']!
    expect(store).toBeDefined()

    // OLAP point read sums the matching cell — proves values flow through querySync.
    const ctx = { timeMode: 'year' as const, dims: { time: 2020 } }
    expect(store.querySync({ type: 'val', code: 'GDP' }, ctx)[0]?.['value']).toBe(100)

    // Multi-dim obs query returns the matching literal rows.
    const obs = store.querySync(
      { type: 'obs', measure: 'GDP' },
      { timeMode: 'year', dims: {} },
    )
    expect(obs).toHaveLength(2)

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('an absent values array yields an empty (but valid) store', async () => {
    registerStaticStoreBuilder()
    const stores = await buildStoreManifest([{ id: 'empty', kind: 'static' }])
    const rows = stores['empty']!.querySync(
      { type: 'obs', measure: '*' },
      { timeMode: 'year', dims: {} },
    )
    expect(rows).toEqual([])
  })
})

describe('config is declarative — FF-NO-FETCH-IN-CONFIG', () => {
  // Deep scan: no value anywhere in a datasource config may be a function (a
  // function in config is not Constructor-ready — Law 2). 'static' data is
  // literal `values`; it never smuggles a fetch/loader/getRows.
  function hasFunctionValue(v: unknown): boolean {
    if (typeof v === 'function') return true
    if (Array.isArray(v)) return v.some(hasFunctionValue)
    if (v && typeof v === 'object') return Object.values(v).some(hasFunctionValue)
    return false
  }

  it('a static datasource descriptor carries no functions — only literal values', () => {
    const cfg: DatasourceInstanceConfig = {
      id:     'demo',
      kind:   'static',
      params: {
        values: [
          { measure: 'GDP', time: 2020, value: 100 },
          { measure: 'GDP', time: 2021, value: 110 },
        ],
      },
    }
    expect(hasFunctionValue(cfg)).toBe(false)
    // A static config must JSON-round-trip — the executable proof it is pure data.
    expect(JSON.parse(JSON.stringify(cfg))).toEqual(cfg)
  })

  it('node-local inline-static (transform.source / pivot.rows) are literal arrays', () => {
    // The bounded node-level exception: literal rows the author typed, never a
    // url/loader. Typed as Record<string, DimVal>[] — a function cannot appear.
    const transformSpec = {
      type:     'transform' as const,
      source:   [{ region: 'GE', value: 1 }],
      steps:    [],
      encoding: {},
    }
    const pivotSpec = {
      type:        'pivot' as const,
      rows:        [{ region: 'GE', metric: 'pop', value: 1 }],
      keyField:    'region',
      valueFields: ['value'],
    }
    expect(hasFunctionValue(transformSpec)).toBe(false)
    expect(hasFunctionValue(pivotSpec)).toBe(false)
  })
})

// ── M2 — source authoring (getMetadata / testConnection) ──────────────────────
describe("'static' authoring capabilities — FF-SOURCE-AUTHORABLE", () => {
  const VALUES: Observation[] = [
    { measure: 'GDP', geo: 'GE', time: 2020, value: 100 },
    { measure: 'GDP', geo: 'AB', time: 2021, value: 110 },
    { measure: 'CPI', geo: 'GE', time: 2021, value: 5 },
  ]

  it('registers getMetadata + testConnection alongside the static builder', () => {
    registerStaticStoreBuilder()
    const caps = getStoreCapabilities('static')
    expect(typeof caps.getMetadata).toBe('function')
    expect(typeof caps.testConnection).toBe('function')
  })

  it('deriveStaticMetadata splits inline keys into dims + the value measure (pure)', () => {
    const md = deriveStaticMetadata(VALUES)
    expect(md.kind).toBe('static')
    expect(md.dimensions.map((d) => d.code).sort()).toEqual(['geo', 'measure'])
    expect(md.measures.map((m) => m.code)).toEqual(['value'])
    // `time`/`obsStatus` are reserved obs columns — neither dim nor measure.
    expect(md.dimensions.find((d) => d.code === 'time')).toBeUndefined()
  })

  it('getSourceMetadata dispatches to the static capability (no network)', async () => {
    registerStaticStoreBuilder()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const md = await getSourceMetadata({ id: 's', kind: 'static', params: { values: VALUES } })
    expect(md?.measures.map((m) => m.code)).toEqual(['value'])
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('testStaticSource validates well-formed rows + rejects the error cases', () => {
    expect(testStaticSource(VALUES).ok).toBe(true)
    expect(testStaticSource([]).ok).toBe(false)
    expect(testStaticSource('nope').ok).toBe(false)
    expect(testStaticSource([1, 2, 3]).ok).toBe(false)
  })

  it('testSource dispatches to the static capability', async () => {
    registerStaticStoreBuilder()
    expect((await testSource({ id: 's', kind: 'static', params: { values: VALUES } }))?.ok).toBe(true)
    expect((await testSource({ id: 's', kind: 'static', params: { values: [] } }))?.ok).toBe(false)
  })

  it('FF-SOURCE-AUTHORABLE — an authored static row builds a live store, zero code', async () => {
    registerStaticStoreBuilder()
    // Simulate exactly what the Constructor persists: a wire row (type+config),
    // then the shared row→descriptor mapping (toSourceDescriptor) the runner boot
    // uses. The same path a non-programmer drives through the UI.
    const persistedRow = {
      name:   'authored-gdp',
      type:   typeForKind('static')!,           // 'static' wire type
      url:    null,
      config: { values: VALUES },               // the inline rows authored in the panel
    }
    expect(persistedRow.type).toBe('static')

    const descriptor = toSourceDescriptor(persistedRow)!
    expect(descriptor).toMatchObject({ id: 'authored-gdp', kind: 'static' })

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const stores = await buildStoreManifest([descriptor])
    const store  = stores['authored-gdp']!
    expect(store).toBeDefined()

    // The live store serves the authored rows — the success test of the vision.
    expect(store.querySync({ type: 'val', code: 'GDP' }, { timeMode: 'year', dims: { time: 2020 } })[0]?.['value'])
      .toBe(100)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('toSourceDescriptor skips a type with no registered kind (open for extension)', () => {
    // An unknown wire type (no row in SOURCE_KIND_BY_TYPE) is skipped, not failed.
    expect(toSourceDescriptor({ name: 'x', type: 'no-such-type', config: {} })).toBeUndefined()
    // round-trip the kind↔type table — all three modes now have a live kind.
    expect(typeForKind('stats')).toBe('rest')
    expect(typeForKind('static')).toBe('static')
    expect(typeForKind('href')).toBe('sdmx-json')
  })

  it("the 'sdmx-json' wire type maps to the live 'href' kind, carrying the url", () => {
    const descriptor = toSourceDescriptor({
      name: 'remote', type: 'sdmx-json', url: 'https://example.org/data.json', config: { format: 'json' },
    })
    expect(descriptor).toMatchObject({
      id: 'remote', kind: 'href', url: 'https://example.org/data.json', params: { format: 'json' },
    })
  })
})

describe('kind-dispatch is OCP — FF-SOURCE-KIND-CLOSED', () => {
  it('a brand-new kind = one registration, reachable through the same registry', async () => {
    // No engine/resolver edit — just a registerStoreBuilder call. The store is a
    // minimal hand-rolled DataStore proving the dispatch is kind-blind (no
    // hardcoded `kind === 'stats'` gate anywhere in buildStoreManifest).
    const SENTINEL = [{ value: 42 }]
    registerStoreBuilder('fitness-probe', async () => ({
      querySync: () => SENTINEL,
      caps: { queryTypes: [], batching: false, streaming: false, sync: true },
    }))

    expect(registeredKinds()).toContain('fitness-probe')

    const stores = await buildStoreManifest([{ id: 'p', kind: 'fitness-probe' }])
    expect(stores['p']!.querySync({ type: 'val', code: 'x' }, { timeMode: 'year', dims: {} }))
      .toBe(SENTINEL)
  })
})
