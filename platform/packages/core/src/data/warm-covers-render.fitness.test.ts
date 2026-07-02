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

import { describe, it, expect, vi, afterEach } from 'vitest'
import { interpretSpec, extractRequirements } from './spec'
import { ExternalStore }               from './store-impl'
import { ApiStore }                    from './store-api'
import type { RawObsRow }              from './store-api'
import type { DataStore, StoreQuery }  from './store'
import type { EngineRow }              from './encoding'
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

// ── FF-WARM-COVERS-RENDER — ApiStore superset-resolution parity (LIVE deploy) ──
//
//  The code-level guard above proves warm===render by CODE, but the LIVE regression
//  is KEY-level: for timeseries/growth `'all'`, C2 warms ONE UNBOUNDED slice per code
//  (the enumerated `time` dim stripped), while the render fans out ONE per-coordinate
//  `val` read (time:yearᵢ) whose wire key folds in from=yearᵢ&to=yearᵢ — a DISTINCT
//  key from the warmed unbounded slice. The old ApiStore.querySync threw cold on that
//  exact-key miss (it returned raw rows, did NO OLAP matching), so the chart never
//  rendered live even though every needed row was already cached.
//
//  This block drives a REAL ApiStore (backed by a fake server), warms ONLY the
//  unbounded slices the useNodeRows warm walk issues (val + obs at the time-stripped
//  ctx — NEVER the per-coordinate keys), then renders via interpretSpec (the SAME sync
//  read the live DOM drives). It must NOT throw, and the rows must EQUAL the
//  ExternalStore result over the same data — proving the two store paths resolve a
//  point read identically (both through matchedValues). A negative control (nothing
//  warmed) proves the guard has teeth: with no covering slice, the read cold-crashes.

// The same three years of GDP, as the raw wire shape ApiStore's mapRow ingests.
const RAW_OBS: RawObsRow[] = OBS.map((o) => ({
  time_period:   String(o['time']),
  dim_key:       { measure: String(o['measure']), geo: String(o['geo']) },
  obs_value:     String(o['value']),
  obs_status:    'A',
  obs_attribute: {},
}))

const mapRow = (raw: RawObsRow): EngineRow => ({
  ...raw.dim_key,
  time:  Number(raw.time_period),
  value: raw.obs_value === null ? null : Number(raw.obs_value),
})

/** A fake /api/stats/observations that scopes RAW_OBS by the wire params (server-side). */
function fakeFetch(raw: RawObsRow[]) {
  return vi.fn(async (url: string) => {
    const qs     = new URL(url, 'http://api.test').searchParams
    const from   = qs.get('from')
    const to     = qs.get('to')
    const filter = qs.get('filter') ? (JSON.parse(qs.get('filter')!) as Record<string, unknown>) : {}
    const data   = raw.filter((r) => {
      if (from && Number(r.time_period) < Number(from)) return false
      if (to   && Number(r.time_period) > Number(to))   return false
      for (const [dim, val] of Object.entries(filter)) {
        const rv = r.dim_key[dim]
        if (Array.isArray(val)) { if (!val.map(String).includes(String(rv))) return false }
        else if (String(rv) !== String(val)) return false
      }
      return true
    })
    return {
      ok: true, status: 200,
      headers: { get: () => null },
      json:    async () => ({ data }),
      text:    async () => '',
    } as unknown as Response
  })
}

function makeApiStore(): ApiStore {
  // nonTimeDims = ['geo']: geo flows into the wire filter; measure is pinned per-val.
  return new ApiStore('http://api.test', 'GDP_DS', ['geo'], {}, mapRow)
}

/** Warm EXACTLY the slices useNodeRows warms: val + obs at each (time-stripped) req ctx. */
async function warmLikeLive(store: ApiStore, spec: DataSpec, ctx: SectionContext): Promise<void> {
  for (const r of extractRequirements(spec, ctx)) {
    const reqCtx: SectionContext = { ...ctx, dims: { ...ctx.dims, ...r.dims } }
    await store.queryAsync({ type: 'val', code: r.code }, reqCtx)
    await store.queryAsync({ type: 'obs', measure: r.code }, reqCtx)
  }
}

describe('FF-WARM-COVERS-RENDER — ApiStore resolves an `all` render from the warmed superset', () => {
  afterEach(() => vi.unstubAllGlobals())

  const ctx: SectionContext = { dims: { geo: 'GE' } }
  const LIVE_CASES: Array<[string, DataSpec]> = [
    ['timeseries (all)', { type: 'timeseries', code: 'GDP', years: 'all' } as DataSpec],
    ['growth (all)',     { type: 'growth',     code: 'GDP', years: 'all' } as DataSpec],
  ]

  it.each(LIVE_CASES)('%s: no cold throw + rows == ExternalStore', async (_name, spec) => {
    vi.stubGlobal('fetch', fakeFetch(RAW_OBS))
    const api = makeApiStore()
    await warmLikeLive(api, spec, ctx)

    // The per-coordinate keys (from=yearᵢ&to=yearᵢ) were NEVER warmed — only the
    // unbounded slice was. The sync render must resolve from that superset, not throw.
    let apiRows!: ReturnType<typeof interpretSpec>
    expect(() => { apiRows = interpretSpec(spec, ctx, api) }).not.toThrow()

    const extRows = interpretSpec(spec, ctx, new ExternalStore(OBS))
    expect(apiRows).toEqual(extRows)              // live path ≡ in-memory path
    expect(apiRows.length).toBeGreaterThan(0)     // and it actually produced a series
  })

  it.each(LIVE_CASES)('%s: negative control — NOTHING warmed cold-crashes', (_name, spec) => {
    vi.stubGlobal('fetch', fakeFetch(RAW_OBS))
    const api = makeApiStore()                    // cache empty — no covering superset
    expect(() => interpretSpec(spec, ctx, api)).toThrow(/cold|cache miss/)
  })
})
