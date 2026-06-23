// @vitest-environment node
//
// ── Map panel — color scale unit tests ──────────────────────────────
//
// Tests buildColorScale in isolation: no React, no DOM, no topology.
// Law 1: geoDim and valueField are treated as plain field-name strings.

import { describe, it, expect } from 'vitest'
import { buildColorScale }      from './mapColorUtils'
import type { EngineRow }       from '@statdash/engine'

// ── Helpers ──────────────────────────────────────────────────────────

function makeRows(entries: Array<[string, number]>): EngineRow[] {
  return entries.map(([geo, value]) => ({ geo, value }))
}

const PALETTE3 = ['#aaa', '#bbb', '#ccc']
const PALETTE2 = ['#111', '#999']

// ── Quantile scale ────────────────────────────────────────────────────

describe('buildColorScale — quantile', () => {
  it('6 rows with 3-color palette: 2 rows per bucket', () => {
    // sorted values: 10, 20, 30, 40, 50, 60
    // bucket 0 (0–1 of 3): ranks 0,1 → #aaa
    // bucket 1 (1–2 of 3): ranks 2,3 → #bbb
    // bucket 2 (2–3 of 3): ranks 4,5 → #ccc
    const rows = makeRows([
      ['a', 10], ['b', 20], ['c', 30],
      ['d', 40], ['e', 50], ['f', 60],
    ])
    const map = buildColorScale(rows, 'geo', 'value', PALETTE3, 'quantile')

    expect(map.get('a')).toBe('#aaa')
    expect(map.get('b')).toBe('#aaa')
    expect(map.get('c')).toBe('#bbb')
    expect(map.get('d')).toBe('#bbb')
    expect(map.get('e')).toBe('#ccc')
    expect(map.get('f')).toBe('#ccc')
  })

  it('all values equal → rank-distributed across buckets (quantile is rank-based)', () => {
    // Quantile assigns by rank position, not value.
    // 3 equal-value rows in a 3-bucket palette: each row gets its own bucket.
    // sorted index 0 → floor(0/3*3)=0 → #aaa
    // sorted index 1 → floor(1/3*3)=1 → #bbb
    // sorted index 2 → floor(2/3*3)=2 → #ccc
    const rows = makeRows([['a', 5], ['b', 5], ['c', 5]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE3, 'quantile')
    // All 3 colors are used (rank-distributed)
    const colors = [map.get('a'), map.get('b'), map.get('c')]
    expect(new Set(colors).size).toBe(3)
    // The specific assignment depends on sort stability (input order preserved for equal values)
    expect(colors).toContain('#aaa')
    expect(colors).toContain('#bbb')
    expect(colors).toContain('#ccc')
  })

  it('single row → gets first palette color', () => {
    const rows = makeRows([['x', 42]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE3, 'quantile')
    expect(map.get('x')).toBe('#aaa')
  })
})

// ── Linear scale ──────────────────────────────────────────────────────

describe('buildColorScale — linear', () => {
  it('min value → first palette color', () => {
    const rows = makeRows([['low', 0], ['mid', 50], ['high', 100]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE2, 'linear')
    expect(map.get('low')).toBe('#111111')
  })

  it('max value → last palette color', () => {
    const rows = makeRows([['low', 0], ['mid', 50], ['high', 100]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE2, 'linear')
    expect(map.get('high')).toBe('#999999')
  })

  it('degenerate range (all equal) → first palette color for all', () => {
    const rows = makeRows([['a', 7], ['b', 7]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE2, 'linear')
    expect(map.get('a')).toBe('#111111')
    expect(map.get('b')).toBe('#111111')
  })

  it('single row → first palette color', () => {
    const rows = makeRows([['only', 99]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE2, 'linear')
    expect(map.get('only')).toBe('#111111')
  })
})

// ── Threshold scale ───────────────────────────────────────────────────

describe('buildColorScale — threshold', () => {
  it('min value → first palette bucket', () => {
    const rows = makeRows([['lo', 0], ['hi', 100]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE3, 'threshold')
    expect(map.get('lo')).toBe('#aaa')
  })

  it('max value → last palette bucket', () => {
    const rows = makeRows([['lo', 0], ['hi', 100]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE3, 'threshold')
    expect(map.get('hi')).toBe('#ccc')
  })

  it('mid value → middle palette bucket', () => {
    // range 0–99, n=3 → buckets [0,33), [33,66), [66,99]
    const rows = makeRows([['lo', 0], ['mid', 50], ['hi', 99]])
    const map  = buildColorScale(rows, 'geo', 'value', PALETTE3, 'threshold')
    expect(map.get('mid')).toBe('#bbb')
  })
})

// ── Edge cases ────────────────────────────────────────────────────────

describe('buildColorScale — edge cases', () => {
  it('empty rows → empty Map', () => {
    const map = buildColorScale([], 'geo', 'value', PALETTE3, 'quantile')
    expect(map.size).toBe(0)
  })

  it('rows missing geoDim field → skipped', () => {
    const rows: EngineRow[] = [{ value: 42 }]  // no 'geo' field
    const map = buildColorScale(rows, 'geo', 'value', PALETTE3, 'quantile')
    expect(map.size).toBe(0)
  })

  it('rows missing valueField → skipped', () => {
    const rows: EngineRow[] = [{ geo: 'ka' }]  // no 'value' field
    const map = buildColorScale(rows, 'geo', 'value', PALETTE3, 'quantile')
    expect(map.size).toBe(0)
  })

  it('empty palette → empty Map', () => {
    const rows = makeRows([['a', 10]])
    const map  = buildColorScale(rows, 'geo', 'value', [], 'quantile')
    expect(map.size).toBe(0)
  })

  it('numeric geoDim codes are valid keys', () => {
    const rows: EngineRow[] = [{ geo: 1, value: 42 }, { geo: 2, value: 10 }]
    const map = buildColorScale(rows, 'geo', 'value', PALETTE2, 'quantile')
    expect(map.has(1)).toBe(true)
    expect(map.has(2)).toBe(true)
  })
})
