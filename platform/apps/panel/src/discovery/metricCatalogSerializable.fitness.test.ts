// ── FF-METRIC-CATALOG-SERIALIZABLE — the catalog + bound config stay pure data ─
//
//  AR-49 M0 (SPEC-authoring-reconception-M0.md §7, item 11 panel seam) × Law 2:
//  "a function in config is not Constructor-ready." Everything the authoring surface
//  reads (the governed catalog, the resolved options) and everything it WRITES (the
//  bound block props that become persisted config) must be plain serializable data —
//  no functions, no class instances, no non-JSON values (Date/Map/Set). The proof is
//  a JSON round-trip: `JSON.parse(JSON.stringify(x))` deep-equals `x`. Anything that
//  is not pure data changes shape (functions vanish, Dates stringify) and the
//  round-trip fails — plus an explicit deep scan asserts no function leaks anywhere.
//
//  Load-bearing because a metric-id in a measure field lowers via resolveMeasureRef
//  with no new runtime (spec §3): the ONLY thing the Constructor persists is the id,
//  a string — so the bind result must round-trip byte-for-byte.
//
import { describe, it, expect, beforeAll } from 'vitest'
import type { MetricDef } from '@statdash/engine'
import {
  metricOptions, dimensionOptions,
  type CatalogDimension,
} from './semanticCatalogOptions'
import { bindMetricToProps } from './metricBinding'
import { useMetricCatalogStore } from './metricCatalog.store'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'

/** JSON round-trip: the serialize→deserialize identity for pure data. */
function roundTrip<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Deep scan: the paths at which a function value appears (empty ⇒ pure data). */
function functionPaths(value: unknown, path = '$'): string[] {
  if (typeof value === 'function') return [path]
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([k, v]) => functionPaths(v, `${path}.${k}`))
  }
  return []
}

// A representative catalog: a plain metric, a unit-bearing metric, a CALC (derived)
// metric — whose `calc` is an expr AST held as DATA — and a curated dimension with a
// member whitelist. If any facet smuggled a function, the scan/round-trip would fail.
const metrics: Record<string, MetricDef> = {
  'gdp.level':      { code: 'B1GQ', label: { en: 'GDP', ka: 'მშპ' }, unit: { en: 'mln GEL', ka: 'მლნ ₾' }, agg: 'last' },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { en: 'GDP · growth', ka: 'ზრდა' }, unit: { en: '%', ka: '%' } },
  'gdp.perCapita':  {
    label: { en: 'GDP per capita', ka: 'ერთ სულზე' },
    // A derived metric: its value is a declarative expr AST held as DATA (Law 2).
    calc:  {
      inputs: { num: { measure: 'gdp.level' }, denom: { measure: 'pop.total' } },
      expr:   { op: 'div', left: { $derived: 'num' }, right: { $derived: 'denom' } },
    },
    methodology: 'sna2008',
  },
}
const dimensions: Record<string, CatalogDimension> = {
  region: { code: 'REGION', label: { en: 'Region', ka: 'რეგიონი' }, conceptRole: 'geo', defaultMember: '_T', members: ['GE', 'TB'] },
}

describe('FF-METRIC-CATALOG-SERIALIZABLE — the catalog round-trips as pure data', () => {
  it('the metric catalog is function-free and JSON round-trips unchanged', () => {
    expect(functionPaths(metrics)).toEqual([])
    expect(roundTrip(metrics)).toEqual(metrics)
  })

  it('the dimension catalog is function-free and JSON round-trips unchanged', () => {
    expect(functionPaths(dimensions)).toEqual([])
    expect(roundTrip(dimensions)).toEqual(dimensions)
  })

  it('resolved options (metric + dimension) round-trip unchanged', () => {
    const mo = metricOptions(metrics, 'en')
    const dimOpts = dimensionOptions(dimensions, 'en')
    expect(roundTrip(mo)).toEqual(mo)
    expect(roundTrip(dimOpts)).toEqual(dimOpts)
    expect(functionPaths(mo)).toEqual([])
    expect(functionPaths(dimOpts)).toEqual([])
  })
})

describe('FF-METRIC-CATALOG-SERIALIZABLE — bound config round-trips (Law 2)', () => {
  it('bound block props are function-free and JSON round-trip unchanged', () => {
    const before = { chartType: 'bar', data: { query: { measure: '' } } }
    const bound  = bindMetricToProps(before, 'data.query.measure', 'gdp.realGrowth')

    expect(functionPaths(bound)).toEqual([])          // no function leaked into config
    expect(roundTrip(bound)).toEqual(bound)           // persists byte-for-byte
    // The written value is a bare string id — the whole point of §3 lowering.
    expect((bound.data as { query: { measure: unknown } }).query.measure).toBe('gdp.realGrowth')
  })

  it('binding onto an already-serialized props object stays serializable (idempotent shape)', () => {
    const seed  = roundTrip({ data: { query: { measure: 'OLD' }, encoding: { x: 'time' } } })
    const bound = bindMetricToProps(seed, 'data.query.measure', 'gdp.level')
    expect(roundTrip(bound)).toEqual(bound)
    expect(functionPaths(bound)).toEqual([])
  })
})

describe('FF-METRIC-CATALOG-SERIALIZABLE — the LIVE store catalog is serializable', () => {
  beforeAll(() => { setupCanvasRegistry() })

  it('the catalog read from describeApp() via the store round-trips as pure data', () => {
    useMetricCatalogStore.getState().invalidate()
    useMetricCatalogStore.getState().load()
    const catalog = useMetricCatalogStore.getState().catalog
    expect(catalog.status).toBe('ready')             // never idle/error after load
    if (catalog.status === 'ready') {
      // Tolerant of an empty registry (an empty catalog is trivially serializable);
      // whatever is registered must be function-free pure data.
      expect(functionPaths(catalog.metrics)).toEqual([])
      expect(functionPaths(catalog.dimensions)).toEqual([])
      expect(roundTrip(catalog.metrics)).toEqual(catalog.metrics)
      expect(roundTrip(catalog.dimensions)).toEqual(catalog.dimensions)
    }
  })
})
