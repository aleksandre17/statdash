import { describe, it, expect } from 'vitest'
import { interpretSpec }        from './spec'
import { ExternalStore }        from './store-impl'
import type { SectionContext }  from '../core/context'
import type { Observation }     from '../sdmx'

// ── Shared fixtures ───────────────────────────────────────────────────

const ctx: SectionContext = {
  dims:     { time: 2023, geo: 'GE' },
}

const obs: Observation[] = [
  { measure: 'B1G', value: 1000, time: 2023, geo: 'GE', label: 'GDP',   isCarryForward: 0 },
  { measure: 'B1G', value:  900, time: 2022, geo: 'GE', label: 'GDP',   isCarryForward: 0 },
  { measure: 'B1G', value:  800, time: 2021, geo: 'GE', label: 'GDP',   isCarryForward: 0 },
  { measure: 'D1',  value:  500, time: 2023, geo: 'GE', label: 'Wages', isCarryForward: 0 },
]

const store = new ExternalStore(obs)

// ── row-list ──────────────────────────────────────────────────────────

describe('interpretSpec — row-list', () => {
  it('resolves values from the store for each row', () => {
    const rows = interpretSpec(
      { type: 'row-list', rows: [{ code: 'B1G', label: 'GDP' }, { code: 'D1', label: 'Wages' }] },
      ctx, store,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ value: 1000, label: 'GDP' })
    expect(rows[1]).toMatchObject({ value: 500,  label: 'Wages' })
  })

  it('negate flips the sign', () => {
    const [row] = interpretSpec(
      { type: 'row-list', rows: [{ code: 'D1', label: 'Wages', negate: true }] },
      ctx, store,
    )
    expect(row.value).toBe(-500)
  })

  it('pctOf computes percentage of denominator', () => {
    const [row] = interpretSpec(
      { type: 'row-list', rows: [{ code: 'D1', pctOf: 'B1G' }] },
      ctx, store,
    )
    expect(row.pct).toBeCloseTo(50)
  })

  it('returns empty rows when store has no matching data', () => {
    const emptyStore = new ExternalStore([])
    const rows = interpretSpec(
      { type: 'row-list', rows: [{ code: 'B1G' }] },
      ctx, emptyStore,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe(0)
  })

  it('isCarryForward observations are excluded from value sum', () => {
    const storeWithCarry = new ExternalStore([
      ...obs,
      { measure: 'B1G', value: 9999, time: 2023, geo: 'GE', isCarryForward: 1 },
    ])
    const [row] = interpretSpec(
      { type: 'row-list', rows: [{ code: 'B1G' }] },
      ctx, storeWithCarry,
    )
    expect(row.value).toBe(1000)
  })
})

// ── timeseries ────────────────────────────────────────────────────────

describe('interpretSpec — timeseries', () => {
  it('returns one row per year in the order given', () => {
    const rows = interpretSpec(
      { type: 'timeseries', code: 'B1G', years: [2021, 2022, 2023] },
      ctx, store,
    )
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.value)).toEqual([800, 900, 1000])
  })

  it('row id and label equal the year string', () => {
    const [row] = interpretSpec(
      { type: 'timeseries', code: 'B1G', years: [2023] },
      ctx, store,
    )
    expect(row.id).toBe('2023')
    expect(row.label).toBe('2023')
  })

  it('pct is relative to the max absolute value in the series', () => {
    const rows = interpretSpec(
      { type: 'timeseries', code: 'B1G', years: [2022, 2023] },
      ctx, store,
    )
    expect(rows[1].pct).toBeCloseTo(100)
    expect(rows[0].pct).toBeCloseTo(90)
  })

  it('clamps years with fromDim / toDim', () => {
    const clampCtx: SectionContext = { ...ctx, dims: { ...ctx.dims, from: 2022, to: 2023 } }
    const rows = interpretSpec(
      { type: 'timeseries', code: 'B1G', years: [2021, 2022, 2023], fromDim: 'from', toDim: 'to' },
      clampCtx, store,
    )
    expect(rows.map((r) => r.label)).toEqual(['2022', '2023'])
  })
})

// ── growth ────────────────────────────────────────────────────────────

describe('interpretSpec — growth', () => {
  it('computes YoY growth rate — one fewer row than years provided', () => {
    const rows = interpretSpec(
      { type: 'growth', code: 'B1G', years: [2021, 2022, 2023] },
      ctx, store,
    )
    expect(rows).toHaveLength(2)
  })

  it('positive growth when value increases', () => {
    const rows = interpretSpec(
      { type: 'growth', code: 'B1G', years: [2022, 2023] },
      ctx, store,
    )
    // (1000 / 900 − 1) × 100 ≈ 11.11
    expect(rows[0].value).toBeCloseTo(11.11, 1)
  })

  it('negative growth when value decreases', () => {
    const decliningStore = new ExternalStore([
      { measure: 'B1G', value: 1000, time: 2022, geo: 'GE', isCarryForward: 0 },
      { measure: 'B1G', value:  800, time: 2023, geo: 'GE', isCarryForward: 0 },
    ])
    const rows = interpretSpec(
      { type: 'growth', code: 'B1G', years: [2022, 2023] },
      ctx, decliningStore,
    )
    expect(rows[0].value).toBeCloseTo(-20, 1)
  })
})

// ── unregistered type ─────────────────────────────────────────────────

describe('interpretSpec — unknown type', () => {
  it('returns empty array without crashing', () => {
    const rows = interpretSpec({ type: 'nonexistent' } as never, ctx, store)
    expect(rows).toEqual([])
  })
})