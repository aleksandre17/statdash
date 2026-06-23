import { describe, it, expect } from 'vitest'
import { applyJoinByField } from './joinByField'

const left = [
  { id: 'a', val: 1 },
  { id: 'b', val: 2 },
  { id: 'c', val: 3 },
]

const right = [
  { id: 'a', label: 'Alpha', extra: 10 },
  { id: 'b', label: 'Beta',  extra: 20 },
  { id: 'd', label: 'Delta', extra: 40 },
]

describe('applyJoinByField — inner', () => {
  it('only rows where both sides have the key', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'inner', source: right })
    expect(result).toHaveLength(2)
    expect(result.map((r) => r['id'])).toEqual(['a', 'b'])
  })

  it('merges right fields onto matched rows', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'inner', source: right })
    expect(result[0]).toMatchObject({ id: 'a', val: 1, label: 'Alpha', extra: 10 })
    expect(result[1]).toMatchObject({ id: 'b', val: 2, label: 'Beta',  extra: 20 })
  })
})

describe('applyJoinByField — left', () => {
  it('all left rows are present', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'left', source: right })
    expect(result).toHaveLength(3)
    expect(result.map((r) => r['id'])).toEqual(['a', 'b', 'c'])
  })

  it('unmatched left row has no right-side fields', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'left', source: right })
    const rowC = result.find((r) => r['id'] === 'c')!
    expect(rowC).toHaveProperty('val', 3)
    expect(rowC).not.toHaveProperty('label')
    expect(rowC).not.toHaveProperty('extra')
  })

  it('matched left row has right fields merged', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'left', source: right })
    const rowA = result.find((r) => r['id'] === 'a')!
    expect(rowA).toMatchObject({ id: 'a', val: 1, label: 'Alpha' })
  })
})

describe('applyJoinByField — outer', () => {
  it('all rows from both sides are present', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'outer', source: right })
    const ids = result.map((r) => r['id'])
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    expect(ids).toContain('d')
    expect(result).toHaveLength(4)
  })

  it('unmatched right row (d) appears as its own row', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'outer', source: right })
    const rowD = result.find((r) => r['id'] === 'd')!
    expect(rowD).toMatchObject({ id: 'd', label: 'Delta', extra: 40 })
    expect(rowD).not.toHaveProperty('val')
  })
})

describe('applyJoinByField — A wins on field conflict', () => {
  it('left field value is preserved when right has the same field', () => {
    const a = [{ id: 'x', label: 'LEFT' }]
    const b = [{ id: 'x', label: 'RIGHT', newField: 99 }]
    const result = applyJoinByField(a, { op: 'joinByField', by: 'id', mode: 'inner', source: b })
    expect(result[0]['label']).toBe('LEFT')
    expect(result[0]['newField']).toBe(99)
  })
})

describe('applyJoinByField — does not mutate inputs', () => {
  it('input rows are not mutated', () => {
    const a = [{ id: 'a', val: 1 }]
    const b = [{ id: 'a', extra: 9 }]
    const origA = JSON.parse(JSON.stringify(a))
    const origB = JSON.parse(JSON.stringify(b))
    applyJoinByField(a, { op: 'joinByField', by: 'id', mode: 'inner', source: b })
    expect(a).toEqual(origA)
    expect(b).toEqual(origB)
  })
})

describe('applyJoinByField — empty inputs', () => {
  it('empty left + inner → empty result', () => {
    const result = applyJoinByField([], { op: 'joinByField', by: 'id', mode: 'inner', source: right })
    expect(result).toHaveLength(0)
  })

  it('empty right + left → all left rows', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'left', source: [] })
    expect(result).toHaveLength(3)
    expect(result.every((r) => !('label' in r))).toBe(true)
  })

  it('empty right + outer → all left rows only', () => {
    const result = applyJoinByField(left, { op: 'joinByField', by: 'id', mode: 'outer', source: [] })
    expect(result).toHaveLength(3)
  })
})
