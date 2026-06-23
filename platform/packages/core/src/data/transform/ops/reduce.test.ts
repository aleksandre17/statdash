import { describe, it, expect } from 'vitest'
import { applyReduce } from './reduce'

const rows = (vals: number[], field = 'value') =>
  vals.map((v) => ({ [field]: v }))

describe('applyReduce — no grouping (all rows → one)', () => {
  it('sum of [1,2,3] → 6', () => {
    const result = applyReduce(rows([1, 2, 3]), { op: 'reduce', fn: 'sum', field: 'value' })
    expect(result).toHaveLength(1)
    expect(result[0]['value_sum']).toBe(6)
  })

  it('mean of [1,2,3] → 2', () => {
    const result = applyReduce(rows([1, 2, 3]), { op: 'reduce', fn: 'mean', field: 'value' })
    expect(result[0]['value_mean']).toBe(2)
  })

  it('min of [3,1,2] → 1', () => {
    const result = applyReduce(rows([3, 1, 2]), { op: 'reduce', fn: 'min', field: 'value' })
    expect(result[0]['value_min']).toBe(1)
  })

  it('max of [3,1,2] → 3', () => {
    const result = applyReduce(rows([3, 1, 2]), { op: 'reduce', fn: 'max', field: 'value' })
    expect(result[0]['value_max']).toBe(3)
  })

  it('count of [1,2,3] → 3', () => {
    const result = applyReduce(rows([1, 2, 3]), { op: 'reduce', fn: 'count', field: 'value' })
    expect(result[0]['value_count']).toBe(3)
  })

  it('first returns value from first row', () => {
    const result = applyReduce(rows([10, 20, 30]), { op: 'reduce', fn: 'first', field: 'value' })
    expect(result[0]['value_first']).toBe(10)
  })

  it('last returns value from last row', () => {
    const result = applyReduce(rows([10, 20, 30]), { op: 'reduce', fn: 'last', field: 'value' })
    expect(result[0]['value_last']).toBe(30)
  })

  it('custom `as` field name', () => {
    const result = applyReduce(rows([1, 2, 3]), { op: 'reduce', fn: 'sum', field: 'value', as: 'total' })
    expect(result[0]).toHaveProperty('total', 6)
    expect(result[0]).not.toHaveProperty('value_sum')
  })
})

describe('applyReduce — grouped by a single field', () => {
  const input = [
    { series: 'A', value: 1 },
    { series: 'A', value: 2 },
    { series: 'A', value: 3 },
    { series: 'B', value: 10 },
    { series: 'B', value: 20 },
  ]

  it('one output row per series', () => {
    const result = applyReduce(input, { op: 'reduce', fn: 'sum', field: 'value', by: 'series' })
    expect(result).toHaveLength(2)
  })

  it('sum per series: A → 6, B → 30', () => {
    const result = applyReduce(input, { op: 'reduce', fn: 'sum', field: 'value', by: 'series' })
    const byS = Object.fromEntries(result.map((r) => [r['series'], r['value_sum']]))
    expect(byS['A']).toBe(6)
    expect(byS['B']).toBe(30)
  })

  it('group-by key field is present on output row', () => {
    const result = applyReduce(input, { op: 'reduce', fn: 'mean', field: 'value', by: 'series' })
    expect(result.every((r) => 'series' in r)).toBe(true)
  })

  it('first/last per group', () => {
    const result = applyReduce(input, { op: 'reduce', fn: 'first', field: 'value', by: 'series' })
    const byS = Object.fromEntries(result.map((r) => [r['series'], r['value_first']]))
    expect(byS['A']).toBe(1)
    expect(byS['B']).toBe(10)
  })
})

describe('applyReduce — grouped by multiple fields (array `by`)', () => {
  const input = [
    { region: 'east', year: 2020, value: 5 },
    { region: 'east', year: 2021, value: 10 },
    { region: 'west', year: 2020, value: 3 },
    { region: 'west', year: 2021, value: 7 },
  ]

  it('one row per (region, year) combination', () => {
    const result = applyReduce(input, {
      op: 'reduce', fn: 'sum', field: 'value', by: ['region', 'year'],
    })
    expect(result).toHaveLength(4)
  })

  it('both key fields are on output rows', () => {
    const result = applyReduce(input, {
      op: 'reduce', fn: 'sum', field: 'value', by: ['region', 'year'],
    })
    expect(result.every((r) => 'region' in r && 'year' in r)).toBe(true)
  })
})

describe('applyReduce — preserves group insertion order', () => {
  it('output rows appear in the order groups were first seen', () => {
    const input = [
      { cat: 'B', value: 1 },
      { cat: 'A', value: 2 },
      { cat: 'B', value: 3 },
    ]
    const result = applyReduce(input, { op: 'reduce', fn: 'sum', field: 'value', by: 'cat' })
    expect(result.map((r) => r['cat'])).toEqual(['B', 'A'])
  })
})
