// ── Fitness — stranded-submission reclaim (API-02) ────────────────────────────
//
// DB-gated: skipped offline, a real gate where the V11 staging schema + the V37
// claimed_at column exist. Each test runs in a txn ROLLED BACK in afterEach (never
// mutates shared staging). Proves the crash-recovery sweep: a row stranded in
// `parsing` past the visibility timeout is re-queued to `received`, while a fresh
// claim and a terminal row are left untouched.

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { reclaimStrandedSubmissions } from './reclaim.js'
import type { Queryable, QueryableClient, IngestLogger } from './types.js'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip
const silent: IngestLogger = { info: () => {}, warn: () => {}, error: () => {} }

function asQueryable(client: PoolClient): Queryable {
  const q = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
    const res = await client.query(sql, params as unknown[])
    return { rows: res.rows as T[] }
  }
  const qc: QueryableClient = { query: q, release: () => {} }
  return { query: q, connect: async () => qc }
}

/** Insert a submission in a given status with a claimed_at offset (seconds ago). */
async function insertSubmission(
  client: PoolClient, status: string, claimedSecondsAgo: number | null,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO stats_stage.submission (kind, dataset_code, status, claimed_at)
     VALUES ('codelists', NULL, $1,
       ${claimedSecondsAgo === null ? 'NULL' : `now() - make_interval(secs => ${claimedSecondsAgo})`})
     RETURNING id`,
    [status],
  )
  return rows[0].id
}

async function statusOf(client: PoolClient, id: string): Promise<{ status: string; claimed_at: Date | null }> {
  const { rows } = await client.query<{ status: string; claimed_at: Date | null }>(
    `SELECT status, claimed_at FROM stats_stage.submission WHERE id = $1`, [id],
  )
  return rows[0]
}

suite('reclaimStrandedSubmissions (V37 crash-recovery)', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  it('re-queues a stranded parsing row past the threshold (claimed_at cleared)', async () => {
    const stranded = await insertSubmission(client, 'parsing', 600) // claimed 10 min ago
    const { reclaimed } = await reclaimStrandedSubmissions(asQueryable(client), {
      staleAfterMs: 5 * 60_000, logger: silent,
    })
    expect(reclaimed).toBeGreaterThanOrEqual(1)
    const after = await statusOf(client, stranded)
    expect(after.status).toBe('received')
    expect(after.claimed_at).toBeNull()
  })

  it('leaves a FRESH claim (within the timeout) untouched', async () => {
    const fresh = await insertSubmission(client, 'parsing', 10) // claimed 10s ago
    await reclaimStrandedSubmissions(asQueryable(client), { staleAfterMs: 5 * 60_000, logger: silent })
    const after = await statusOf(client, fresh)
    expect(after.status).toBe('parsing') // still in-flight; not reclaimed
  })

  it('never touches a terminal (published) row', async () => {
    const done = await insertSubmission(client, 'published', null)
    await reclaimStrandedSubmissions(asQueryable(client), { staleAfterMs: 1, logger: silent })
    const after = await statusOf(client, done)
    expect(after.status).toBe('published')
  })
})
