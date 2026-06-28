// ── FF-POINTSERIES — the store-aware lowering primitive (grain G1) ───────────────
//
//  point-series is the engine-internal desugar target: it enumerates a GENERIC `over`
//  dimension and fans out a `valAt` point read per coordinate. This locks its
//  behaviour as a dead-but-tested primitive BEFORE any convenience spec lowers onto it
//  (G2/G3): explicit coords, store-`distinct` enumeration, numeric clamp, generic
//  `over` (Law 1 — geo, not just time), and the `pipe` tail.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { ExternalStore } from '../data/store-impl'
import { defaultRegistry } from './engine'
import './resolvers'                         // side-effect: register PointSeriesResolver
import type { PointSeriesSpec } from '../config/data-spec'
import type { SectionContext } from '../core/context'
import type { EngineRow } from '../data/encoding'
import type { Observation } from '../sdmx'

const obs: Observation[] = [
  { measure: 'GDP', time: 2020, geo: 'GE', value: 60 },
  { measure: 'GDP', time: 2020, geo: 'AM', value: 40 },   // 2020 annual = 100
  { measure: 'GDP', time: 2021, geo: 'GE', value: 70 },
  { measure: 'GDP', time: 2021, geo: 'AM', value: 40 },   // 2021 annual = 110
  { measure: 'GDP', time: 2022, geo: 'GE', value: 80 },
  { measure: 'GDP', time: 2022, geo: 'AM', value: 40 },   // 2022 annual = 120
]
const store = new ExternalStore(obs)
const ctx: SectionContext = { dims: {} }

function run(spec: PointSeriesSpec): EngineRow[] {
  return defaultRegistry.spec('point-series')!.resolve(spec, ctx, store)
}

describe('FF-POINTSERIES — registration + core behaviour', () => {
  it('point-series is a registered resolver', () => {
    expect(defaultRegistry.hasSpec('point-series')).toBe(true)
  })

  it('explicit coords over time: annual grain-sum per coord + pct normalization', () => {
    const rows = run({ type: 'point-series', code: 'GDP', over: 'time', coords: [2020, 2021, 2022] })
    expect(rows.map((r) => [r['id'], r['value']])).toEqual([
      ['2020', 100], ['2021', 110], ['2022', 120],
    ])
    // pct = |value| / max(|value|, 1) × 100 ; max = 120
    expect(rows.map((r) => Math.round((r['pct'] as number) * 100) / 100)).toEqual([83.33, 91.67, 100])
    expect(rows.map((r) => r['label'])).toEqual(['2020', '2021', '2022'])
  })

  it("coords:'all' enumerates the store's distinct(over), ascending", () => {
    const all      = run({ type: 'point-series', code: 'GDP', over: 'time', coords: 'all' })
    const explicit = run({ type: 'point-series', code: 'GDP', over: 'time', coords: [2020, 2021, 2022] })
    expect(all).toEqual(explicit)
  })

  it('absent coords ≡ coords:"all"', () => {
    const absent = run({ type: 'point-series', code: 'GDP', over: 'time' })
    const all    = run({ type: 'point-series', code: 'GDP', over: 'time', coords: 'all' })
    expect(absent).toEqual(all)
  })
})

describe('FF-POINTSERIES — Law 1: generic over any dimension (not time-privileged)', () => {
  it('over:"geo" enumerates geo coords and reads each (time summed away)', () => {
    const rows = run({ type: 'point-series', code: 'GDP', over: 'geo' })
    // geo coords: AM, GE (lexical ascending — non-numeric). GE = 60+70+80 = 210, AM = 120.
    expect(rows.map((r) => [r['id'], r['value']])).toEqual([['AM', 120], ['GE', 210]])
  })

  it('a fixed base coordinate (at) narrows every read', () => {
    const rows = run({ type: 'point-series', code: 'GDP', over: 'time', coords: [2020, 2021], at: { geo: 'GE' } })
    expect(rows.map((r) => [r['id'], r['value']])).toEqual([['2020', 60], ['2021', 70]])
  })
})

describe('FF-POINTSERIES — numeric clamp + pipe tail', () => {
  it('clamp folds fromDim/toDim against ctx (filters enumerated coords)', () => {
    const clampedCtx: SectionContext = { dims: { lo: 2021, hi: 2022 } }
    const rows = defaultRegistry.spec('point-series')!.resolve(
      { type: 'point-series', code: 'GDP', over: 'time', clamp: { fromDim: 'lo', toDim: 'hi' } },
      clampedCtx, store,
    )
    expect(rows.map((r) => r['id'])).toEqual(['2021', '2022'])
  })

  it('pipe tail runs over the emitted rows (e.g. a descending sort)', () => {
    const rows = run({
      type: 'point-series', code: 'GDP', over: 'time', coords: [2020, 2021, 2022],
      pipe: [{ op: 'sort', by: 'value', dir: 'desc' }],
    })
    expect(rows.map((r) => r['id'])).toEqual(['2022', '2021', '2020'])
  })
})
