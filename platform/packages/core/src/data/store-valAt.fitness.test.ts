// ── FF-VALAT-COORD-IDENTICAL + FF-GRAIN-GENERIC — the valAt port anchor (G0) ──
//
//  Locks the grain/store-port primitive (DESIGN-grain-store-port G0):
//
//   FF-VALAT-COORD-IDENTICAL — `valAt({code, at:{[dim]:v}})` is BYTE-IDENTICAL to
//     the legacy pinned read `storeVal(code, atTime/at-coordinate)`. The default
//     (rollup 'sum', no grain) IS the implicit `_val` grain-sum at that coordinate —
//     this is the byte-identity anchor every later phase rests on.
//
//   FF-GRAIN-GENERIC (Law 1) — the coordinate + grain path is GENERIC: `at` over a
//     NON-time dim (`geo`) reproduces a geo-pinned read identically. No dimension is
//     privileged; time is just one coordinate the same machinery addresses.
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { ExternalStore, CachedStore } from './store-impl'
import { storeVal, storeValAt } from './store'
import { atTime, TIME_DIM } from '../core/context'
import type { SectionContext } from '../core/context'
import type { Observation } from '../sdmx'

// quarterly-ish multi-cell fixture: a coordinate pinning a coarse grain (a year, or
// "all years") matches MANY finer cells, so the default sum is a real grain-rollup.
const obs: Observation[] = [
  { measure: 'GDP', time: 2020, geo: 'GE', value: 100 },
  { measure: 'GDP', time: 2020, geo: 'AM', value: 40  },
  { measure: 'GDP', time: 2021, geo: 'GE', value: 110 },
  { measure: 'GDP', time: 2021, geo: 'AM', value: 50  },
  { measure: 'GDP', time: 2022, geo: 'GE', value: 120 },
  // a carry-forward row that MUST be excluded by both paths (SNA dedup)
  { measure: 'GDP', time: 2022, geo: 'AM', value: 999, isCarryForward: 1 },
]

const store  = new ExternalStore(obs)
const cached = new CachedStore(store)
const baseCtx: SectionContext = { dims: {} }

/** Raw port read (bypasses the storeValAt sum fast-path) — exercises the valAt impl. */
function portValAt(s: ExternalStore | CachedStore, code: string, at: Record<string, number | string>): number {
  return (s.querySync({ type: 'valAt', code, at }, baseCtx)[0]?.['value'] as number) ?? 0
}

describe('FF-VALAT-COORD-IDENTICAL — valAt({at}) ≡ storeVal at the pinned coordinate', () => {
  for (const y of [2020, 2021, 2022]) {
    it(`time=${y}: port valAt sum ≡ storeVal(atTime)`, () => {
      const legacy = storeVal(store, 'GDP', atTime(y, baseCtx))
      expect(portValAt(store, 'GDP', { [TIME_DIM]: y })).toBe(legacy)
      expect(storeValAt(store, 'GDP', { [TIME_DIM]: y }, baseCtx)).toBe(legacy)
    })
  }

  it('the default sum IS a grain-rollup (annual = Σ finer cells)', () => {
    // 2020 over {GE:100, AM:40} → 140 (the implicit grain-sum made explicit).
    expect(portValAt(store, 'GDP', { [TIME_DIM]: 2020 })).toBe(140)
  })

  it('carry-forward rows are excluded on the valAt path too (2022 = GE only)', () => {
    expect(portValAt(store, 'GDP', { [TIME_DIM]: 2022 })).toBe(120)
  })

  it('CachedStore.valAt default ≡ ExternalStore.valAt (cache-coherent, byte-identical)', () => {
    for (const y of [2020, 2021, 2022]) {
      expect(portValAt(cached, 'GDP', { [TIME_DIM]: y })).toBe(portValAt(store, 'GDP', { [TIME_DIM]: y }))
    }
  })
})

describe('FF-GRAIN-GENERIC (Law 1) — the coordinate path is dimension-blind', () => {
  it('at:{geo} reproduces a geo-pinned read identically (no time privilege)', () => {
    const legacy = storeVal(store, 'GDP', { dims: { geo: 'GE' } })   // 100+110+120 = 330
    expect(legacy).toBe(330)
    expect(portValAt(store, 'GDP', { geo: 'GE' })).toBe(330)
    expect(storeValAt(store, 'GDP', { geo: 'GE' }, baseCtx)).toBe(330)
  })

  it('a compound coordinate (geo × time) reads the single cell', () => {
    expect(portValAt(store, 'GDP', { geo: 'GE', [TIME_DIM]: 2021 })).toBe(110)
  })
})

describe('rollup ops — generic aggregation over the matched cells (default sum byte-identical)', () => {
  // time=2020 matches two cells {100, 40}.
  const cells = (op: 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last') =>
    (store.querySync({ type: 'valAt', code: 'GDP', at: { [TIME_DIM]: 2020 }, rollup: op }, baseCtx)[0]?.['value'] as number)

  it('sum (default) = 140', () => expect(cells('sum')).toBe(140))
  it('avg = 70',         () => expect(cells('avg')).toBe(70))
  it('min = 40',         () => expect(cells('min')).toBe(40))
  it('max = 100',        () => expect(cells('max')).toBe(100))
  it('first = 100',      () => expect(cells('first')).toBe(100))
  it('last = 40',        () => expect(cells('last')).toBe(40))

  it('an absent coordinate cell ⇒ 0 (the OLAP zero cell)', () => {
    expect(portValAt(store, 'GDP', { [TIME_DIM]: 1999 })).toBe(0)
  })
})
