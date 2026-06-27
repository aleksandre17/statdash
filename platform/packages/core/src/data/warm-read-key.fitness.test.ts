// ── FF-WARM-READ-KEY-EQ — warm-derived keys ≡ read-issued keys (GAP 4) ────────
//
//  The highest-value guard for the async live store. The Cache-Aside warm step
//  (useNodeRows) and the sync READ (QueryResolver → storeObs) MUST derive the
//  IDENTICAL (measure, filter, orderBy) + dims cache identity, or warm-key ≠
//  read-key → cold cache → empty charts. This held in YEAR mode but broke in
//  RANGE mode (the read is unbounded; the warm pinned a spurious time:0).
//
//  This pins the SSOT key-derivation path in BOTH modes:
//    • obs identity: queryReadObs(spec.query) — the EXACT query the read issues
//      (storeObs uses resolveQueryMeasures(spec.query), so they are identical).
//    • dims identity: extractRequirements yields NO spurious time pin in range
//      mode (one unbounded req), matching the unbounded read; in year mode it
//      yields the per-year pin the read uses.

import { describe, it, expect } from 'vitest'
import { queryReadObs }         from '../registry/resolvers'
import { resolveQueryMeasures } from '../registry/resolvers'
import { extractRequirements }  from './spec'
import { storeObs }             from './store'
import type { DataSpec }        from '../config/data-spec'
import type { SectionContext }  from '../core/context'
import type { DataStore, StoreQuery } from './store'
import type { ObsQuery }        from '../sdmx'

/** Narrow a query DataSpec to its ObsQuery (the tests only use `query` specs). */
const q = (spec: DataSpec): ObsQuery => (spec as Extract<DataSpec, { type: 'query' }>).query

// A query spec in RANGE mode: no `time` filter; bounds via fromDim/toDim.
const rangeSpec: DataSpec = {
  type:  'query',
  query: { measure: 'GDP', filter: { geo: { $ctx: 'geo' } }, orderBy: { field: 'time', dir: 'asc' } },
  fromDim: 'fromYear',
  toDim:   'toYear',
  encoding: {} as never,
}

// The same query spec in YEAR mode (time pinned in ctx).
const yearSpec: DataSpec = {
  type:  'query',
  query: { measure: 'GDP', filter: { geo: { $ctx: 'geo' } } },
  encoding: {} as never,
}

/** A spy store that records the EXACT obs StoreQuery the read issues. */
function spyStore(): { store: DataStore; lastObs: () => StoreQuery | undefined } {
  let last: StoreQuery | undefined
  const store: DataStore = {
    caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: true },
    querySync(q: StoreQuery) {
      if (q.type === 'obs') last = q
      return []
    },
  }
  return { store, lastObs: () => last }
}

describe('FF-WARM-READ-KEY-EQ — warm obs query ≡ read obs query', () => {
  it('RANGE mode: the read issues exactly queryReadObs(spec.query)', () => {
    const ctx: SectionContext = { dims: { geo: 'GE', fromYear: 2015, toYear: 2024 } }
    const { store, lastObs } = spyStore()

    // The READ (mirrors QueryResolver.resolve's storeObs call).
    storeObs(store, resolveQueryMeasures(q(rangeSpec)), ctx)
    const read = lastObs()!

    // The WARM (mirrors useNodeRows' query-obs warm).
    const warm = queryReadObs(q(rangeSpec))

    expect(warm.type).toBe('obs')
    expect((read as { measure: unknown }).measure).toEqual((warm as { measure: unknown }).measure)
    expect((read as { filter: unknown }).filter).toEqual((warm as { filter: unknown }).filter)
    expect((read as { orderBy: unknown }).orderBy).toEqual((warm as { orderBy: unknown }).orderBy)
  })

  it('YEAR mode: the read issues exactly queryReadObs(spec.query)', () => {
    const ctx: SectionContext = { dims: { geo: 'GE', time: 2023 } }
    const { store, lastObs } = spyStore()

    storeObs(store, resolveQueryMeasures(q(yearSpec)), ctx)
    const read = lastObs()!
    const warm = queryReadObs(q(yearSpec))

    expect((read as { measure: unknown }).measure).toEqual((warm as { measure: unknown }).measure)
    expect((read as { filter: unknown }).filter).toEqual((warm as { filter: unknown }).filter)
  })

  it('RANGE mode: extractRequirements yields NO spurious time pin (matches unbounded read)', () => {
    const ctx: SectionContext = { dims: { geo: 'GE', fromYear: 2015, toYear: 2024 } }
    const reqs = extractRequirements(rangeSpec, ctx)

    expect(reqs.length).toBeGreaterThan(0)
    for (const r of reqs) {
      // The unbounded read carries no single year — the warm must not pin time:0.
      expect('time' in r.dims).toBe(false)
      expect(r.dims['geo']).toBe('GE')
    }
  })

  it('YEAR mode: extractRequirements pins the real year (byte-identical to read)', () => {
    const ctx: SectionContext = { dims: { geo: 'GE', time: 2023 } }
    const reqs = extractRequirements(yearSpec, ctx)

    expect(reqs.length).toBeGreaterThan(0)
    for (const r of reqs) expect(r.dims['time']).toBe(2023)
  })
})
