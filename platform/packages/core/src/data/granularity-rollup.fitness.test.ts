// ── FF-GRANULARITY-ROLLS-UP — timeDimension.granularity threads to the point read [GRAIN-G4] ─
//
//  THE DECLARED-BUT-DECORATIVE SEAM (time-dimension.ts): `timeDimension.granularity`
//  was carried metadata that "does not affect resolution" — authorable + persisted but
//  folded NOTHING. Lane B opened `TimeGranularity` to an open registry string; GRAIN-G4
//  threads it: the timeseries→point-series desugar forwards a NON-default (sub-annual)
//  grain into the point read's `grain[TIME_DIM]`, so a `valAt` LOD roll-up is requested
//  when a grain-aware store + sub-annual data arrive.
//
//  DATA-GATED (honest): the live data is ANNUAL and no grain-aware store ships yet, so
//  the value roll-up (quarter→year) cannot be exercised against real data. What IS
//  proven here, fully:
//    (1) ANNUAL NO-OP — an absent/`'year'` granularity forwards NO grain ⇒ the read
//        stays on the byte-identical `val` path (no `valAt` port query, warm-key safe).
//    (2) WIRING — a sub-annual granularity ('quarter') threads `grain:{time:'quarter'}`
//        onto the desugared point-series AND reaches the store port as a `valAt` query
//        carrying that grain (a spy store records the exact StoreQuery it receives).
//  The actual finer→coarser aggregation is the grain-aware store's job (the reducer
//  `rollupValues` already exists); this locks the ENGINE half so a sub-annual dataset
//  drops in with zero engine change.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { desugar } from './desugar'
import { interpretSpec } from './spec'
import { DEFAULT_GRANULARITY } from '../core/time-dimension'
import type { DataSpec } from '../config/data-spec'
import type { StoreQuery, DataStore } from './store'
import type { SectionContext } from '../core/context'
import type { EngineRow } from './encoding'

// ── A spy store: records every StoreQuery, sums matched observations for any read ──
class SpyStore implements DataStore {
  seen: StoreQuery[] = []
  constructor(private obs: Array<Record<string, number | string>>) {}
  readonly caps = { queryTypes: ['val', 'valAt', 'obs'] as StoreQuery['type'][], batching: false, streaming: false, sync: true }

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    this.seen.push(q)
    if (q.type === 'obs') {
      return this.obs.filter((o) => o['measure'] === (q as { measure: string }).measure) as EngineRow[]
    }
    if (q.type === 'val' || q.type === 'valAt') {
      const at = q.type === 'valAt' ? { ...ctx.dims, ...(q.at ?? {}) } : ctx.dims
      const sum = this.obs
        .filter((o) => o['measure'] === q.code)
        .filter((o) => Object.entries(at).every(([k, v]) => v === '' || v == null || o[k] === undefined || o[k] === v))
        .reduce((a, o) => a + Number(o['value'] ?? 0), 0)
      return [{ value: sum }]
    }
    return []
  }
}

const OBS = [
  { measure: 'GDP', time: 2020, value: 100 },
  { measure: 'GDP', time: 2021, value: 110 },
  { measure: 'GDP', time: 2022, value: 120 },
]
const ctx: SectionContext = { dims: {} }

// ── (unit) desugar threads granularity → grain[TIME_DIM], NON-default only ─────
describe('FF-GRANULARITY-ROLLS-UP — desugar threads granularity to the value-cell head grain', () => {
  // ONE-PIPE U1: the LIVE switch lowers timeseries onto the spine; the grain the old
  // point-series carried is HOISTED onto the value-cell `source` head (the head
  // reconstitutes the identical point-series in readSource — same LOD semantics).
  const headOf = (spec: DataSpec) => {
    const lowered = desugar(spec)
    expect(lowered.type).toBe('pipeline')
    return (lowered as Extract<DataSpec, { type: 'pipeline' }>).pipe[0]! as Record<string, unknown>
  }

  it('absent timeDimension ⇒ NO grain on the head (annual val path)', () => {
    expect(headOf({ type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022] })['grain']).toBeUndefined()
  })

  it(`default granularity (${DEFAULT_GRANULARITY}) ⇒ NO grain (byte-identical to absent)`, () => {
    expect(headOf({
      type: 'timeseries', code: 'GDP', years: [2020, 2021],
      timeDimension: { dim: 'time', granularity: DEFAULT_GRANULARITY },
    })['grain']).toBeUndefined()
  })

  it("sub-annual granularity ('quarter') ⇒ grain { time: 'quarter' } threaded onto the head", () => {
    expect(headOf({
      type: 'timeseries', code: 'GDP', years: [2020, 2021],
      timeDimension: { dim: 'time', granularity: 'quarter' },
    })['grain']).toEqual({ time: 'quarter' })
  })
})

// ── (1) ANNUAL NO-OP — the read stays on the `val` path (no valAt) ────────────
describe('FF-GRANULARITY-ROLLS-UP — annual is byte-identical (val path, no port change)', () => {
  it('an annual timeseries issues ONLY `val` reads (never `valAt`)', () => {
    const store = new SpyStore(OBS)
    const rows = interpretSpec({ type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022] } as DataSpec, ctx, store)
    expect(rows.map((r) => r['value'])).toEqual([100, 110, 120])
    const kinds = new Set(store.seen.map((q) => q.type))
    expect(kinds.has('valAt')).toBe(false)   // annual ⇒ no LOD port query
    expect(kinds.has('val')).toBe(true)
  })

  it('a default-granularity timeseries is row-identical to a bare one (annual no-op)', () => {
    const bare    = interpretSpec({ type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022] } as DataSpec, ctx, new SpyStore(OBS))
    const withGran = interpretSpec(
      { type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022],
        timeDimension: { dim: 'time', granularity: DEFAULT_GRANULARITY } } as DataSpec,
      ctx, new SpyStore(OBS),
    )
    expect(withGran).toEqual(bare)
  })
})

// ── (2) WIRING — sub-annual grain reaches the store port as a valAt query ─────
describe('FF-GRANULARITY-ROLLS-UP — sub-annual grain reaches the valAt port (wiring)', () => {
  it("a 'quarter' timeseries issues `valAt` reads carrying grain { time: 'quarter' }", () => {
    const store = new SpyStore(OBS)
    interpretSpec(
      { type: 'timeseries', code: 'GDP', years: [2020, 2021, 2022],
        timeDimension: { dim: 'time', granularity: 'quarter' } } as DataSpec,
      ctx, store,
    )
    const valAts = store.seen.filter((q): q is Extract<StoreQuery, { type: 'valAt' }> => q.type === 'valAt')
    // NON-VACUOUS: the point reads routed through the LOD port, one per coordinate.
    expect(valAts.length).toBeGreaterThan(0)
    expect(valAts.every((q) => q.grain?.['time'] === 'quarter')).toBe(true)
  })
})
