// ── dim-filter — the SDMX key-selection predicate builder (pure, DB-free) ──────
//
// The canonical multi-value filter contract: scalar dims AND-combine into one
// `dim_key @> $::jsonb` containment; each multi-value dim ORs within itself via
// `dim_key->>'<dim>' = ANY($::text[])`; the clauses AND together. These tests lock
// the four cases the task specifies:
//   · scalar-only filter is BYTE-IDENTICAL to the prior single-jsonb containment.
//   · a single multi-value dim → the OR-union (= ANY).
//   · multi-value across two dims → AND-of-ORs.
//   · empty / absent / edge cases.

import { describe, it, expect } from 'vitest'
import { buildDimFilter } from './dim-filter.js'

describe('buildDimFilter — scalar (back-compat, byte-identical)', () => {
  it('a single scalar dim → one @> containment at the given index', () => {
    const { sql, params } = buildDimFilter({ measure: 'GVA' }, 4)
    expect(sql).toBe('dim_key @> $4::jsonb')
    expect(params).toEqual([JSON.stringify({ measure: 'GVA' })])
  })

  it('multiple scalar dims collapse into ONE containment (sorted, stable)', () => {
    const { sql, params } = buildDimFilter({ sector: '_T', measure: 'GVA' }, 4)
    // Exactly one clause, one param — the legacy single-jsonb shape preserved.
    expect(sql).toBe('dim_key @> $4::jsonb')
    // Keys sorted → deterministic JSON regardless of authoring order.
    expect(params).toEqual([JSON.stringify({ measure: 'GVA', sector: '_T' })])
  })

  it('absent filter → TRUE no-op, no params', () => {
    expect(buildDimFilter(undefined, 4)).toEqual({ sql: 'TRUE', params: [] })
  })

  it('empty filter object → TRUE no-op (scopes nothing, matches @> {} semantics)', () => {
    expect(buildDimFilter({}, 4)).toEqual({ sql: 'TRUE', params: [] })
  })
})

describe('buildDimFilter — single multi-value dim (OR within)', () => {
  it('an array value → dim_key->>dim = ANY($::text[])', () => {
    const { sql, params } = buildDimFilter({ geo: ['R2', 'R3'] }, 4)
    expect(sql).toBe(`dim_key->>'geo' = ANY($4::text[])`)
    expect(params).toEqual([['R2', 'R3']])
  })

  it('numeric leaves are stringified for the text[] membership', () => {
    const { sql, params } = buildDimFilter({ geo: [2, 3] }, 4)
    expect(sql).toBe(`dim_key->>'geo' = ANY($4::text[])`)
    expect(params).toEqual([['2', '3']])
  })

  it('an EMPTY array → = ANY of an empty set (matches nothing — a deliberate empty selection)', () => {
    const { sql, params } = buildDimFilter({ geo: [] }, 4)
    expect(sql).toBe(`dim_key->>'geo' = ANY($4::text[])`)
    expect(params).toEqual([[]])
  })
})

describe('buildDimFilter — multi-value across dims (AND of ORs)', () => {
  it('two multi-value dims → two = ANY clauses, AND-combined, indices threaded', () => {
    const { sql, params } = buildDimFilter({ geo: ['R2', 'R3'], approach: ['P', 'E'] }, 4)
    // sorted keys: approach ($4), geo ($5).
    expect(sql).toBe(
      `dim_key->>'approach' = ANY($4::text[]) AND dim_key->>'geo' = ANY($5::text[])`,
    )
    expect(params).toEqual([['P', 'E'], ['R2', 'R3']])
  })

  it('mixed scalar + multi-value → containment AND = ANY (the headline cross-region case)', () => {
    // {"geo":["R2","R3"],"sector":"_T","measure":"GVA"}
    const { sql, params } = buildDimFilter(
      { geo: ['R2', 'R3'], sector: '_T', measure: 'GVA' }, 4,
    )
    // Scalars (measure, sector) collapse to ONE containment; geo is the = ANY clause.
    // Emission order: multi-value clauses are gathered, then the scalar containment is
    // appended ahead of them in the join — assert the exact composed SQL.
    expect(sql).toBe(
      `dim_key @> $4::jsonb AND dim_key->>'geo' = ANY($5::text[])`,
    )
    expect(params).toEqual([
      JSON.stringify({ measure: 'GVA', sector: '_T' }),
      ['R2', 'R3'],
    ])
  })
})

describe('buildDimFilter — index threading + column override', () => {
  it('respects a non-default start index (as-of leg threading)', () => {
    const { sql, params } = buildDimFilter({ geo: ['R2', 'R3'], measure: 'GVA' }, 9)
    expect(sql).toBe(`dim_key @> $9::jsonb AND dim_key->>'geo' = ANY($10::text[])`)
    expect(params).toEqual([JSON.stringify({ measure: 'GVA' }), ['R2', 'R3']])
  })

  it('targets a custom column (the as-of preimg leg uses live_obs.dim_key)', () => {
    const { sql } = buildDimFilter({ geo: ['R2'], measure: 'GVA' }, 5, 'live_obs.dim_key')
    expect(sql).toBe(
      `live_obs.dim_key @> $5::jsonb AND live_obs.dim_key->>'geo' = ANY($6::text[])`,
    )
  })

  it('rejects a dimension key carrying a single quote (SQL-literal break, fail-fast)', () => {
    expect(() => buildDimFilter({ "ge'o": ['R2'] }, 4)).toThrowError(/illegal dimension code/)
  })
})
