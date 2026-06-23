import { describe, it, expect } from 'vitest'
import { applyWindow } from './window'

// Helper: build rows with a single numeric field
const rows = (vals: number[], field = 'value') =>
  vals.map((v) => ({ [field]: v }))

describe('applyWindow — movingAvg', () => {
  it('n=3 over [1,2,3,4,5] → [1, 1.5, 2, 3, 4]', () => {
    const result = applyWindow(rows([1, 2, 3, 4, 5]), {
      op: 'window', fn: 'movingAvg', over: 'value', n: 3,
    })
    expect(result.map((r) => r['value_movingAvg'])).toEqual([1, 1.5, 2, 3, 4])
  })

  it('growing window: fewer than n predecessors averages what is available', () => {
    const result = applyWindow(rows([10, 20, 30]), {
      op: 'window', fn: 'movingAvg', over: 'value', n: 3,
    })
    // row 0: avg([10]) = 10, row 1: avg([10,20]) = 15, row 2: avg([10,20,30]) = 20
    expect(result.map((r) => r['value_movingAvg'])).toEqual([10, 15, 20])
  })

  it('uses custom `as` field name', () => {
    const result = applyWindow(rows([1, 2, 3]), {
      op: 'window', fn: 'movingAvg', over: 'value', n: 2, as: 'avg2',
    })
    expect(result[0]).toHaveProperty('avg2')
  })
})

describe('applyWindow — cumSum', () => {
  it('[1,2,3,4,5] → [1,3,6,10,15]', () => {
    const result = applyWindow(rows([1, 2, 3, 4, 5]), {
      op: 'window', fn: 'cumSum', over: 'value',
    })
    expect(result.map((r) => r['value_cumSum'])).toEqual([1, 3, 6, 10, 15])
  })

  it('cumSum with negatives', () => {
    const result = applyWindow(rows([5, -3, 2]), {
      op: 'window', fn: 'cumSum', over: 'value',
    })
    expect(result.map((r) => r['value_cumSum'])).toEqual([5, 2, 4])
  })
})

describe('applyWindow — lag', () => {
  it('first row has no output field at all', () => {
    const result = applyWindow(rows([10, 20, 30]), {
      op: 'window', fn: 'lag', over: 'value',
    })
    expect('value_lag' in result[0]).toBe(false)
  })

  it('second row equals first value', () => {
    const result = applyWindow(rows([10, 20, 30]), {
      op: 'window', fn: 'lag', over: 'value',
    })
    expect(result[1]['value_lag']).toBe(10)
    expect(result[2]['value_lag']).toBe(20)
  })
})

describe('applyWindow — diff', () => {
  it('first row has no output field at all', () => {
    const result = applyWindow(rows([10, 20, 30]), {
      op: 'window', fn: 'diff', over: 'value',
    })
    expect('value_diff' in result[0]).toBe(false)
  })

  it('second row = value[1] - value[0]', () => {
    const result = applyWindow(rows([10, 20, 35]), {
      op: 'window', fn: 'diff', over: 'value',
    })
    expect(result[1]['value_diff']).toBe(10)
    expect(result[2]['value_diff']).toBe(15)
  })
})

describe('applyWindow — partitions via `by`', () => {
  it('each series is independent — lag resets at partition boundary', () => {
    const input = [
      { series: 'A', value: 1 },
      { series: 'A', value: 2 },
      { series: 'B', value: 10 },
      { series: 'B', value: 20 },
    ]
    const result = applyWindow(input, {
      op: 'window', fn: 'lag', over: 'value', by: 'series',
    })
    // A partition: first row no field, second row = 1
    expect('value_lag' in result[0]).toBe(false)
    expect(result[1]['value_lag']).toBe(1)
    // B partition: first row no field, second row = 10
    expect('value_lag' in result[2]).toBe(false)
    expect(result[3]['value_lag']).toBe(10)
  })

  it('cumSum restarts for each partition', () => {
    const input = [
      { series: 'A', value: 1 },
      { series: 'A', value: 2 },
      { series: 'B', value: 10 },
      { series: 'B', value: 5 },
    ]
    const result = applyWindow(input, {
      op: 'window', fn: 'cumSum', over: 'value', by: 'series',
    })
    expect(result[0]['value_cumSum']).toBe(1)
    expect(result[1]['value_cumSum']).toBe(3)
    expect(result[2]['value_cumSum']).toBe(10)
    expect(result[3]['value_cumSum']).toBe(15)
  })

  it('does not mutate input rows', () => {
    const input = [{ value: 5 }, { value: 10 }]
    const original = JSON.parse(JSON.stringify(input))
    applyWindow(input, { op: 'window', fn: 'cumSum', over: 'value' })
    expect(input).toEqual(original)
  })
})
