// ── Fitness — createSubmission round-trips provenance (live DB) ───────────────
//
// ADR-0031 §4 improvement 4 fitness net: createSubmission persists source_digest +
// provenance to stats_stage.submission (V32 columns), and they read back identically.
// DB-gated like upsert.scd2.test.ts — skipped (not failed) offline, a real gate where
// the V32-migrated DB exists. Every test runs in a txn ROLLED BACK in afterEach (FIRST:
// never mutates shared staging). The worker is fire-and-forget; we do not await its
// drain — we assert the BRONZE write (the row + its provenance), the synchronous part.

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createSubmission } from './submit.js'
import type { Queryable, QueryableClient, IngestLogger } from './types.js'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

const silentLog: IngestLogger = { info: () => {}, warn: () => {}, error: () => {} }

// A Queryable over a single txn-scoped client. connect() returns the SAME client so the
// worker's would-be transaction shares our rolled-back txn (release is a no-op — the
// suite owns the lifecycle). The worker drain is fire-and-forget; the bronze write we
// assert completes before createSubmission returns.
function asQueryable(client: PoolClient): Queryable {
  const q = async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
    const res = await client.query(sql, params as unknown[])
    return { rows: res.rows as T[] }
  }
  const qc: QueryableClient = { query: q, release: () => {} }
  return { query: q, connect: async () => qc }
}

suite('createSubmission — provenance round-trip (V32)', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  it('persists source_digest + provenance and reads them back identically', async () => {
    const db = asQueryable(client)
    const provenance = {
      parserVersion: 'canonical-workbook@1',
      sourceDigest: 'deadbeef'.repeat(8),
      sourceFilename: 'GDP_ANNUAL.xlsx',
      rulesetId: 'dqaf-default',
    }
    const id = await createSubmission(db, silentLog, {
      kind: 'codelists', datasetCode: null, format: 'canonical-xlsx',
      payload: { classifiers: [] }, dryRun: true,
      sourceDigest: provenance.sourceDigest, provenance,
    })

    const { rows } = await client.query<{ source_digest: string; provenance: Record<string, unknown> }>(
      `SELECT source_digest, provenance FROM stats_stage.submission WHERE id = $1`, [id],
    )
    expect(rows[0].source_digest).toBe(provenance.sourceDigest)
    expect(rows[0].provenance).toEqual(provenance)
  })

  it('omitting provenance writes NULL (Postel — lineage is optional)', async () => {
    const db = asQueryable(client)
    const id = await createSubmission(db, silentLog, {
      kind: 'codelists', datasetCode: null, format: 'bundle',
      payload: { classifiers: [] }, dryRun: true,
    })
    const { rows } = await client.query<{ source_digest: string | null; provenance: unknown }>(
      `SELECT source_digest, provenance FROM stats_stage.submission WHERE id = $1`, [id],
    )
    expect(rows[0].source_digest).toBeNull()
    expect(rows[0].provenance).toBeNull()
  })
})
