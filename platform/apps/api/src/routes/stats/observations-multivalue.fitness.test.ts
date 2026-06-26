// ── Fitness — observations MULTI-VALUE key selection (SDMX OR-within-dim, live DB) ──
//
// THE INVARIANT this locks: the canonical filter contract (dim-filter.ts) executes
// AS REAL POSTGRES against stats.observation and returns the SDMX key-selection set —
//   · a SINGLE multi-value dim → the OR-union of its members (geo ∈ {R2,R3}),
//   · MULTI-VALUE across two dims → AND-of-ORs (geo ∈ {R2,R3} AND approach ∈ {P,E}),
//   · a SCALAR-only filter → byte-identical to the prior single-jsonb containment.
//
// This proves the predicate the route emits (buildDimFilter) is valid Postgres and
// semantically correct — the unit tests (dim-filter.test.ts) lock the SQL/param shape;
// this locks that the shape actually scopes the cube the way SDMX/Eurostat/.Stat do.
//
// Harness mirrors dataset-lifecycle.fitness.test.ts: pg Pool + DATABASE_URL, skipped
// offline, every test in a txn ROLLED BACK in afterEach (the cube is never mutated).
// We run the EXACT range+filter SQL the route runs, built from buildDimFilter, so the
// test cannot drift from the route's predicate.

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildDimFilter, type DimFilter } from './dim-filter.js'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL && DATABASE_URL !== 'postgres://test' ? describe : describe.skip

suite('observations multi-value key selection — fitness', () => {
  let pool: Pool
  let client: PoolClient
  let ds: string

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN')

    // A 3-axis DSD: geo + approach (both non-time) + time. Seed members for both
    // non-time dims and a grid of observations so OR-within / AND-across are
    // distinguishable. dim_key carries ONLY the non-time dims (the V4 trigger keys on
    // the non-time set), mirroring the lifecycle fixture's shape.
    ds = `__FIT_MV_${Date.now()}`
    await client.query(
      `INSERT INTO stats.dataset (code, label) VALUES ($1, '{"ka":"მრ","en":"mv"}')`, [ds])
    await client.query(
      `INSERT INTO stats.dimension (code, label) VALUES
         ('geo',      '{"ka":"გეო","en":"geo"}'),
         ('approach', '{"ka":"მ","en":"approach"}'),
         ('time',     '{"ka":"დრო","en":"t"}')
       ON CONFLICT (code) DO NOTHING`)
    await client.query(
      `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
         ($1, 'geo',      false, 0),
         ($1, 'approach', false, 1),
         ($1, 'time',     true,  2)`, [ds])
    await client.query(
      `INSERT INTO stats.classifier (dim_code, code, label) VALUES
         ('geo','R1','{"ka":"რ1","en":"R1"}'),
         ('geo','R2','{"ka":"რ2","en":"R2"}'),
         ('geo','R3','{"ka":"რ3","en":"R3"}'),
         ('approach','P','{"ka":"P","en":"Production"}'),
         ('approach','E','{"ka":"E","en":"Expenditure"}')
       ON CONFLICT DO NOTHING`)

    // A full geo×approach grid for period 2020 — 3 geos × 2 approaches = 6 rows.
    for (const geo of ['R1', 'R2', 'R3']) {
      for (const approach of ['P', 'E']) {
        await client.query(
          `INSERT INTO stats.observation (dataset_code, time_period, time_period_date, dim_key, obs_value)
           VALUES ($1, '2020', stats.parse_time_period('2020'), $2::jsonb, 1.0)`,
          [ds, JSON.stringify({ geo, approach })])
      }
    }
  })

  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  // Run the EXACT predicate the route runs (buildDimFilter), returning the matched
  // dim_keys. $1 dataset · $2 from · $3 to are the route's static binds; the filter
  // binds $4..$n; LIMIT trails. Mirrors observations.ts current-cube read 1:1.
  async function readKeys(filter: DimFilter | undefined): Promise<Array<Record<string, string>>> {
    const f = buildDimFilter(filter, 4)
    const params = [ds, null, null, ...f.params, 1000]
    const limitIdx = params.length
    const { rows } = await client.query<{ dim_key: Record<string, string> }>(
      `SELECT dim_key
         FROM stats.observation
        WHERE dataset_code = $1
          AND ($2::text IS NULL OR time_period_date >= stats.parse_time_period($2))
          AND ($3::text IS NULL OR time_period_date <= stats.parse_time_period_end($3))
          AND ${f.sql}
        ORDER BY dim_key
        LIMIT $${limitIdx}`,
      params)
    return rows.map((r) => r.dim_key)
  }

  const geos = (keys: Array<Record<string, string>>): string[] =>
    [...new Set(keys.map((k) => k.geo))].sort()
  const approaches = (keys: Array<Record<string, string>>): string[] =>
    [...new Set(keys.map((k) => k.approach))].sort()

  it('SCALAR filter unchanged — geo=R2 returns only R2 rows (byte-identical containment)', async () => {
    const keys = await readKeys({ geo: 'R2' })
    expect(geos(keys)).toEqual(['R2'])
    expect(keys).toHaveLength(2) // R2×{P,E}
  })

  it('SINGLE multi-value dim — geo ∈ {R2,R3} returns the OR-union (R2 and R3, not R1)', async () => {
    const keys = await readKeys({ geo: ['R2', 'R3'] })
    expect(geos(keys)).toEqual(['R2', 'R3'])
    expect(keys).toHaveLength(4) // {R2,R3}×{P,E}
  })

  it('MULTI-VALUE across two dims — geo ∈ {R2,R3} AND approach ∈ {P} is the AND-of-ORs', async () => {
    const keys = await readKeys({ geo: ['R2', 'R3'], approach: ['P'] })
    expect(geos(keys)).toEqual(['R2', 'R3'])
    expect(approaches(keys)).toEqual(['P'])     // approach scoped to P only
    expect(keys).toHaveLength(2)                // {R2,R3}×{P}
  })

  it('mixed scalar + multi-value — geo ∈ {R2,R3} AND approach=E (scalar) → 2 rows', async () => {
    const keys = await readKeys({ geo: ['R2', 'R3'], approach: 'E' })
    expect(geos(keys)).toEqual(['R2', 'R3'])
    expect(approaches(keys)).toEqual(['E'])
    expect(keys).toHaveLength(2)
  })

  it('empty filter → the full grid (no scoping); empty array → matches nothing', async () => {
    expect(await readKeys(undefined)).toHaveLength(6)   // unscoped: full grid
    expect(await readKeys({})).toHaveLength(6)          // {} scopes nothing
    expect(await readKeys({ geo: [] })).toHaveLength(0) // empty OR-set: no member matches
  })
})
