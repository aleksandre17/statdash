// ── Fitness function — SCD-2 classifier revision invariants (live DB) ─────────
//
// ADR-0023 inverts this suite. The hierarchy edge + materialized LTREE path moved
// off the churning surrogate id and onto the STABLE (dim_code, code) business key
// (parent_code + code_path, V23). The old assertions proved the runtime REPAIRED a
// churning id (parent_id re-pointed, grandchild path rebuilt to the new id-chain);
// the new assertions prove the repair is no longer NEEDED — codes do not churn, so:
//
//   Bug B (still guarded): `ON CONFLICT ON CONSTRAINT uq_classifier_current` throws,
//                    because uq_classifier_current is a partial unique INDEX (V6),
//                    not a constraint. A first revision must not throw.
//   ADR-0023 WIN (was Bug A, inverted): after revising a node that has
//                    grandchildren, the descendants' code_path is BYTE-IDENTICAL
//                    before and after — the code-chain ('B.B1.B1G') never moves on a
//                    revision because the codes never move. No re-point, no repath.
//   parent_code STABILITY: a child's parent_code is unchanged across the parent's
//                    revision (it always referenced the code, never the id).
//   AS-OF read: the tree as of a date is a pure validity-window filter
//                    (valid_from <= D AND (valid_to IS NULL OR valid_to > D))
//                    ORDER BY code_path — impossible under the old id-chain.
//
// A pure unit test cannot catch these: Bug B only manifests against a real Postgres
// partial index, and the code_path stability only manifests through the V23
// BEFORE-trigger that materializes code_path. This runs against a LIVE migrated
// database — skipped (not failed) when DATABASE_URL is absent, so it is a no-op
// locally and a real gate in CI where the migrated DB exists.
//
// NOTE on parity: during V23→V24 both `path` (id-chain) and `code_path` coexist.
// This suite asserts ONLY the code-chain (`code_path::text AS path` is what routes
// expose), so it passes both during parity and after V24 drops parent_id/path.
//
// Harness: matches the seed ETL's connection pattern (pg Pool + DATABASE_URL) and
// the apps/api vitest config (node env, globals, src/**/*.test.ts). Every test runs
// inside a transaction that is ROLLED BACK in afterEach, so it never mutates the
// shared cube and is fully isolated/repeatable (FIRST).

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { upsertClassifier } from './upsert.js'
import type { QueryableClient } from './types.js'

const DATABASE_URL = process.env.DATABASE_URL

// Skip the whole suite when there is no live DB (local dev without Postgres). In CI
// the migrated DB is present, so these become real assertions. describe.skip keeps
// the spec visible (it documents the contract) without failing offline.
const suite = DATABASE_URL ? describe : describe.skip

// A QueryableClient backed by a real PoolClient — the exact port the publish path
// passes into upsertClassifier. release() is a no-op here (the suite owns the client
// lifecycle so the rollback in afterEach is guaranteed).
function asQueryable(client: PoolClient): QueryableClient {
  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const res = await client.query(sql, params as unknown[])
      return { rows: res.rows as T[] }
    },
    release: () => {},
  }
}

const DIM = 'account'

suite('upsertClassifier — SCD-2 revision invariants', () => {
  let pool: Pool
  let client: PoolClient
  let qc: QueryableClient

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })
  })

  afterAll(async () => {
    await pool.end()
  })

  // Each test gets its own client + transaction; afterEach rolls it back so the
  // shared cube is never mutated. The 'account' dimension must exist (V7); we
  // upsert it defensively so the suite is self-contained.
  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN')
    qc = asQueryable(client)
    await client.query(
      `INSERT INTO stats.dimension (code, label, ord)
       VALUES ($1, '{"ka":"account","en":"account"}'::jsonb, 0)
       ON CONFLICT (code) DO NOTHING`,
      [DIM],
    )
    // Use codes unlikely to collide with seeded data inside this rolled-back tx.
    await client.query(
      `DELETE FROM stats.classifier WHERE dim_code = $1 AND code IN ('B','B1','B1G')`,
      [DIM],
    )
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('first revision succeeds (Bug B) and keeps the 3-level subtree code_path STABLE (ADR-0023 win)', async () => {
    // ── 1. Seed a 3-level codelist: grandparent B → parent B1 → child B1G ──
    // The hierarchy edge is now the parent CODE, not a resolved surrogate id.
    const gpId = await upsertClassifier(qc, DIM, 'B', { ka: 'წარმოება', en: 'Production' }, null, null, 0)
    const pId = await upsertClassifier(qc, DIM, 'B1', { ka: 'მშპ', en: 'GVA' }, null, 'B', 1)
    const cId = await upsertClassifier(qc, DIM, 'B1G', { ka: 'მშპ ფასებში', en: 'GVA basic' }, null, 'B1', 2)

    // Sanity: the seeded grandchild code_path is the full code-chain (sanitised).
    const seeded = await client.query<{ path: string }>(
      `SELECT code_path::text AS path FROM stats.classifier WHERE id = $1`,
      [cId],
    )
    expect(seeded.rows[0].path).toBe('B.B1.B1G')

    // ── 2. Revise the GRANDPARENT's label (label IS DISTINCT → SCD-2 close+insert) ──
    // Bug B assertion: this call must NOT throw. Before the fix, ON CONFLICT ON
    // CONSTRAINT against the partial index raised at runtime. Under ADR-0023 there
    // is no Step 3/3b re-point/repath at all — the insert + trigger is the whole job.
    const newGpId = await upsertClassifier(
      qc, DIM, 'B', { ka: 'წარმოება (გადახედილი)', en: 'Production (revised)' }, null, null, 0,
    )

    // A revision still mints a NEW surrogate id (SCD-2 identity-per-version) — the id
    // churns, but the hierarchy no longer rides on it.
    expect(newGpId).not.toBe(gpId)

    // ── 3a. Exactly one is_current=true row per (dim_code, code) ──
    const currentCounts = await client.query<{ code: string; n: string }>(
      `SELECT code, count(*) AS n
         FROM stats.classifier
        WHERE dim_code = $1 AND code IN ('B','B1','B1G') AND is_current = true
        GROUP BY code`,
      [DIM],
    )
    for (const row of currentCounts.rows) {
      expect(Number(row.n), `code ${row.code} must have exactly one current row`).toBe(1)
    }
    expect(currentCounts.rows).toHaveLength(3)

    // The old grandparent row survives as history (is_current=false), label preserved.
    const oldGp = await client.query<{ is_current: boolean }>(
      `SELECT is_current FROM stats.classifier WHERE id = $1`,
      [gpId],
    )
    expect(oldGp.rows[0].is_current).toBe(false)

    // ── 3b. parent_code STABILITY: the direct child still references the parent by
    //         CODE 'B' — unchanged across the grandparent's revision (no re-point). ──
    const directChild = await client.query<{ parent_code: string }>(
      `SELECT parent_code FROM stats.classifier WHERE id = $1`,
      [pId],
    )
    expect(directChild.rows[0].parent_code).toBe('B')

    // ── 3c. (ADR-0023 WIN) The GRANDCHILD's code_path is BYTE-IDENTICAL after the
    //         grandparent revision — codes don't churn, so the path never moves.
    //         This is the inversion of the old Bug A (which had to REBUILD it). ──
    const grandchild = await client.query<{ path: string }>(
      `SELECT code_path::text AS path FROM stats.classifier WHERE id = $1`,
      [cId],
    )
    expect(
      grandchild.rows[0].path,
      'grandchild code_path must be unchanged after a grandparent revision (codes are stable)',
    ).toBe('B.B1.B1G')

    // The direct child's code_path is likewise unchanged.
    const parentPath = await client.query<{ path: string }>(
      `SELECT code_path::text AS path FROM stats.classifier WHERE id = $1`,
      [pId],
    )
    expect(parentPath.rows[0].path).toBe('B.B1')

    // ── 3d. The NEW current grandparent owns the root code_path 'B'. ──
    const newGp = await client.query<{ path: string }>(
      `SELECT code_path::text AS path FROM stats.classifier WHERE id = $1`,
      [newGpId],
    )
    expect(newGp.rows[0].path).toBe('B')
  })

  it('unchanged re-publish is a no-op (no churn, no throw, id stable)', async () => {
    const gpId = await upsertClassifier(qc, DIM, 'B', { ka: 'წარმოება', en: 'Production' }, null, null, 0)
    // Same label → Step 1 closes nothing, Step 2 DO NOTHING, Step 3 SELECT returns
    // the still-current id. Must converge to the SAME id with no new row.
    const again = await upsertClassifier(qc, DIM, 'B', { ka: 'წარმოება', en: 'Production' }, null, null, 0)
    expect(again).toBe(gpId)

    const count = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM stats.classifier WHERE dim_code = $1 AND code = 'B'`,
      [DIM],
    )
    expect(Number(count.rows[0].n)).toBe(1)
  })

  it('as-of read: the tree at a past instant is a validity-window filter ordered by code_path', async () => {
    // Seed B → B1, capture an instant, then revise B's label. The as-of read at the
    // captured instant must return the ORIGINAL grandparent label; the live read the
    // revised one. Both order by code_path (parents before children). This temporal
    // read was IMPOSSIBLE under the id-chain (a revision re-pointed the live edge and
    // rebuilt paths, destroying the historical tree shape).
    await upsertClassifier(qc, DIM, 'B', { ka: 'წარმოება', en: 'Production' }, null, null, 0)
    await upsertClassifier(qc, DIM, 'B1', { ka: 'მშპ', en: 'GVA' }, null, 'B', 1)

    const { rows: t0rows } = await client.query<{ now: string }>(`SELECT now() AS now`)
    const asOf = t0rows[0].now

    // Revise B's label AFTER the captured instant.
    await upsertClassifier(
      qc, DIM, 'B', { ka: 'წარმოება (გადახედილი)', en: 'Production (revised)' }, null, null, 0,
    )

    // As-of the captured instant: the validity-window picks the ORIGINAL B row.
    const asOfTree = await client.query<{ code: string; label: Record<string, string> }>(
      `SELECT code, label
         FROM stats.classifier
        WHERE dim_code = $1
          AND code IN ('B','B1')
          AND valid_from <= $2
          AND (valid_to IS NULL OR valid_to > $2)
        ORDER BY code_path`,
      [DIM, asOf],
    )
    expect(asOfTree.rows.map((r) => r.code)).toEqual(['B', 'B1']) // code_path order: parent first
    expect(asOfTree.rows[0].label.en).toBe('Production') // the historical label

    // Live read: the revised label is current.
    const liveB = await client.query<{ label: Record<string, string> }>(
      `SELECT label FROM stats.classifier
        WHERE dim_code = $1 AND code = 'B' AND is_current = true`,
      [DIM],
    )
    expect(liveB.rows[0].label.en).toBe('Production (revised)')
  })
})
