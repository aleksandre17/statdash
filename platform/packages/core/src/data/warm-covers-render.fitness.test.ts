// ── FF-WARM-COVERS-RENDER + FF-NO-EMPTY-REQS-FOR-READING-SPEC (C2, item 0017) ──
//
//  The warm===render contract, ENFORCED not conventional. The async ApiStore
//  throws on a cold querySync (a slice it never warmed). So EVERY store read the
//  render issues MUST have been declared by extractRequirements — otherwise the
//  first render cold-crashes / renders empty (the 5881a5b / ba9d1a9 failure family).
//
//  This guard renders each read-issuing DataSpec against a store that THROWS on any
//  querySync whose code ∉ warmSet, where warmSet is derived from extractRequirements
//  — the SAME static analysis the warm walk uses. A cold read = a thrown build
//  failure. It directly catches the two latent gaps this item closes:
//    • pivot / transform returning [] (proven read-free — they issue NO read).
//    • the 'all'/unbounded branches of point-series / timeseries / growth that used
//      to return [] while the resolver DID read the store (now emit an unbounded req).
//
//  A negative control proves the guard has teeth: the SAME reading spec, warmed with
//  an EMPTY set, DOES throw — so a future []-regression is caught, not masked.

import { describe, it, expect }        from 'vitest'
import { interpretSpec, extractRequirements } from './spec'
import { ExternalStore }               from './store-impl'
import type { DataStore, StoreQuery }  from './store'
import type { DataSpec }               from '../config/data-spec'
import type { SectionContext }         from '../core/context'
import type { Observation }            from '../sdmx'

// ── Sample data — GDP + CPI across three years for one geo ────────────────────
const OBS: Observation[] = [
  { measure: 'GDP', time: 2020, geo: 'GE', value: 100, label: 'GDP', color: '#111' },
  { measure: 'GDP', time: 2021, geo: 'GE', value: 110, label: 'GDP', color: '#111' },
  { measure: 'GDP', time: 2022, geo: 'GE', value: 120, label: 'GDP', color: '#111' },
  { measure: 'CPI', time: 2020, geo: 'GE', value: 5 },
  { measure: 'CPI', time: 2021, geo: 'GE', value: 6 },
  { measure: 'CPI', time: 2022, geo: 'GE', value: 7 },
]

// ── The codes a StoreQuery touches — the identity the async store keys cold on ──
function codesOf(q: StoreQuery): string[] {
  switch (q.type) {
    case 'val':
    case 'valAt': return [q.code]
    case 'obs':   return Array.isArray(q.measure) ? q.measure : [q.measure]
    default:      return []   // schema / distinct — metadata, not a warmed data slice
  }
}

/**
 * A store that mirrors the async ApiStore's cold-crash behaviour: it answers a
 * querySync ONLY when every code the query touches was warmed (∈ warmSet); a code
 * outside the set THROWS, exactly as ApiStore.querySync throws on a cache miss.
 */
function coldThrowStore(warmSet: Set<string>): DataStore {
  const inner = new ExternalStore(OBS)
  return {
    caps:        inner.caps,
    classifiers: inner.classifiers,
    display:     inner.display,
    querySync(q: StoreQuery, ctx: SectionContext) {
      for (const code of codesOf(q)) {
        if (!warmSet.has(code)) {
          throw new Error(`cold read: '${code}' ∉ warmSet {${[...warmSet].join(',')}} (q.type=${q.type})`)
        }
      }
      return inner.querySync(q, ctx)
    },
  }
}

// ── The corpus: every DataSpec type × its read/read-free classification ───────
interface Case { name: string; spec: DataSpec; ctx: SectionContext; readFree?: boolean }

const CASES: Case[] = [
  { name: 'query (year mode)',
    spec: { type: 'query', query: { measure: 'GDP' }, encoding: {} as never },
    ctx:  { dims: { time: 2021, geo: 'GE' } } },
  { name: 'query (range mode — unbounded)',
    spec: { type: 'query', query: { measure: 'GDP', orderBy: { field: 'time', dir: 'asc' } },
            fromDim: 'fromYear', toDim: 'toYear', encoding: {} as never },
    ctx:  { dims: { geo: 'GE', fromYear: 2020, toYear: 2022 } } },
  { name: 'row-list',
    spec: { type: 'row-list', rows: [{ code: 'GDP' }, { code: 'CPI' }] },
    ctx:  { dims: { time: 2021, geo: 'GE' } } },
  { name: 'ratio-list',
    spec: { type: 'ratio-list', pairs: [{ code: 'GDP', denom: 'CPI' }] },
    ctx:  { dims: { time: 2021, geo: 'GE' } } },
  { name: 'timeseries (explicit years)',
    spec: { type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022] },
    ctx:  { dims: { geo: 'GE' } } },
  { name: 'timeseries (all — unbounded)',
    spec: { type: 'timeseries', code: 'GDP', years: 'all' },
    ctx:  { dims: { geo: 'GE' } } },
  { name: 'growth (all — unbounded)',
    spec: { type: 'growth', code: 'GDP', years: 'all' },
    ctx:  { dims: { geo: 'GE' } } },
  { name: 'pivot (inline source — read-free)',
    spec: { type: 'pivot', rows: [{ region: 'GE', a: 1, b: 2 }], keyField: 'region', valueFields: ['a', 'b'] },
    ctx:  { dims: {} }, readFree: true },
  { name: 'transform (inline source — read-free)',
    spec: { type: 'transform', source: [{ region: 'GE', value: 1 }], steps: [], encoding: {} as never },
    ctx:  { dims: {} }, readFree: true },
]

describe('FF-WARM-COVERS-RENDER — render never issues a read outside the warm set', () => {
  it.each(CASES)('$name', ({ spec, ctx }) => {
    const warmSet = new Set(extractRequirements(spec, ctx).map((r) => r.code))
    const store   = coldThrowStore(warmSet)
    // The render (interpretSpec — the SAME path the live DOM drives) must not read
    // cold: every storeObs/storeVal/valAt code was declared by extractRequirements.
    expect(() => interpretSpec(spec, ctx, store)).not.toThrow()
  })
})

describe('FF-NO-EMPTY-REQS-FOR-READING-SPEC — a reading spec never warms []', () => {
  it.each(CASES.filter((c) => !c.readFree))('$name declares ≥1 requirement', ({ spec, ctx }) => {
    expect(extractRequirements(spec, ctx).length).toBeGreaterThan(0)
  })

  it.each(CASES.filter((c) => c.readFree))('$name is PROVABLY read-free (renders with an empty warm set)', ({ spec, ctx }) => {
    // Read-free ⇒ [] is CORRECT. Proof: render against a store warmed with NOTHING
    // still never reads (inline source), so it cannot cold-crash.
    expect(extractRequirements(spec, ctx)).toEqual([])
    expect(() => interpretSpec(spec, ctx, coldThrowStore(new Set()))).not.toThrow()
  })
})

describe('FF-WARM-COVERS-RENDER — negative control (the guard has teeth)', () => {
  // A reading spec warmed with an EMPTY set MUST cold-crash — proving a future
  // extractRequirements []-regression is caught, not silently masked.
  it.each([
    ['timeseries (all)', { type: 'timeseries', code: 'GDP', years: 'all' } as DataSpec],
    ['growth (all)',     { type: 'growth',     code: 'GDP', years: 'all' } as DataSpec],
    ['query (year)',     { type: 'query', query: { measure: 'GDP' }, encoding: {} as never } as DataSpec],
  ])('%s cold-crashes against an empty warm set', (_name, spec) => {
    const ctx: SectionContext = { dims: { time: 2021, geo: 'GE' } }
    expect(() => interpretSpec(spec, ctx, coldThrowStore(new Set()))).toThrow(/cold read/)
  })
})
