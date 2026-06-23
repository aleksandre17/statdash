// ── Fitness function — ContentConstraint cube region (ADR-0027, live DB) ──────
//
// THE INVARIANT (the architectural characteristic this locks):
//   "Every published observation's dim_key is within its dataset's allowed cube
//    region, IF the dataset has a role='allowed' ContentConstraint."
//
// The DB-side SSOT is stats.dim_key_in_allowed_region(dataset_code, dim_key) (V26)
// — the SAME predicate the silver validate gate mirrors in memory. Asserting the
// corpus against the DB helper (not a re-implementation) is what guarantees the
// silver gate, the helper, and any future opt-in trigger cannot silently diverge.
//
// Two assertions:
//   1. CORPUS: for every dataset that HAS an allowed constraint, zero published
//      observations fall outside the region. (Vacuously true on a fresh cube with
//      no authored constraints — see #2, which proves the predicate has teeth.)
//   2. PREDICATE TEETH (against the real ACCOUNTS B9-only-on-side-U rule): seed a
//      constraint in a rolled-back txn and assert the helper ACCEPTS a legal key
//      ({account:B9, side:U}), REJECTS the illegal combination ({account:B9,
//      side:R}), and treats a no-constraint dataset as unconstrained (TRUE).
//
// Harness mirrors upsert.scd2.test.ts: pg Pool + DATABASE_URL, skipped (not failed)
// offline, every test inside a txn ROLLED BACK in afterEach (FIRST — never mutates
// the shared cube).

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

suite('ContentConstraint cube region (ADR-0027) — fitness', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  // ── 1. Corpus invariant: nothing published is out of its allowed region ───────
  it('every published observation is within its dataset allowed region', async () => {
    const { rows } = await client.query<{ dataset_code: string; offending: string }>(
      `SELECT o.dataset_code, count(*)::text AS offending
         FROM stats.observation o
         JOIN stats.content_constraint c
           ON c.dataset_code = o.dataset_code AND c.role = 'allowed'
        WHERE NOT stats.dim_key_in_allowed_region(o.dataset_code, o.dim_key)
        GROUP BY o.dataset_code`,
    )
    expect(rows, `out-of-region observations: ${JSON.stringify(rows)}`).toEqual([])
  })

  // ── 2. Predicate teeth: the real ACCOUNTS B9-only-on-side-U rule ──────────────
  it('helper accepts legal, rejects illegal combination, no-constraint = unconstrained', async () => {
    const ds = `__FITNESS_CC_${Date.now()}`
    // Minimal dataset + dimensions so FKs resolve (rolled back after the test).
    await client.query(
      `INSERT INTO stats.dataset (code, label) VALUES ($1, '{"ka":"ფიქსტ","en":"fixture"}')`, [ds])
    await client.query(
      `INSERT INTO stats.dimension (code, label) VALUES
         ('account', '{"ka":"ანგარიში","en":"a"}'), ('side', '{"ka":"მხარე","en":"s"}')
       ON CONFLICT (code) DO NOTHING`)

    // No constraint yet → unconstrained (TRUE for any key).
    const before = await client.query<{ ok: boolean }>(
      `SELECT stats.dim_key_in_allowed_region($1, '{"account":"B9","side":"R"}') AS ok`, [ds])
    expect(before.rows[0].ok).toBe(true)

    // Author the conditional rule: account B9 only when side=U (ONE predicate row).
    const { rows: [cc] } = await client.query<{ id: string }>(
      `INSERT INTO stats.content_constraint (dataset_code, role) VALUES ($1, 'allowed') RETURNING id`, [ds])
    await client.query(
      `INSERT INTO stats.content_constraint_member (constraint_id, dim_code, code, cond_dim_code, cond_code)
       VALUES ($1, 'account', 'B9', 'side', 'U')`, [cc.id])

    const legal = await client.query<{ ok: boolean }>(
      `SELECT stats.dim_key_in_allowed_region($1, '{"account":"B9","side":"U"}') AS ok`, [ds])
    expect(legal.rows[0].ok, 'B9 on side U is legal').toBe(true)

    const illegal = await client.query<{ ok: boolean }>(
      `SELECT stats.dim_key_in_allowed_region($1, '{"account":"B9","side":"R"}') AS ok`, [ds])
    expect(illegal.rows[0].ok, 'B9 on side R is the SNA-illegal combination').toBe(false)

    // A different account is unaffected by the B9 rule (no unconditional set on
    // account means account is otherwise unconstrained).
    const other = await client.query<{ ok: boolean }>(
      `SELECT stats.dim_key_in_allowed_region($1, '{"account":"B1G","side":"R"}') AS ok`, [ds])
    expect(other.rows[0].ok, 'a non-B9 account is unconstrained here').toBe(true)
  })
})
