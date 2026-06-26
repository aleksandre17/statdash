// ── Fitness — versioned-DSD mint (the governed structural change) ─────────────
//
// ADR-0031 §4 improvement 5 RESOLUTION half. mintDatasetVersion is the DB-writing
// orchestrator; these tests run it over a FAKE Queryable (a connect()-capable pool
// stub that records every statement) so the PLAN is asserted with zero real database:
//   · widen — a new non-time dim is INSERTed into stats.dataset_dimension; addedDims
//     reports it. An already-present dim is NOT re-reported (idempotent convergence).
//   · axis — a new dim's stats.dimension row is upserted (FK safety).
//   · label — the version label is stamped on stats.dataset.metadata (no parallel store).
//   · counter — stats.bump_dataset_version is called (the new version row).
//   · atomic — BEGIN … COMMIT wraps the whole plan; a mid-plan throw ROLLBACKs.
//   · port — a Queryable without connect() fails fast (the mint owns its txn).

import { describe, expect, it, vi } from 'vitest'
import { mintDatasetVersion, type VersionMintPlan } from './version-mint.js'
import type { Queryable, QueryableClient } from './types.js'

/** A connect()-capable fake: records every statement; answers the existing-dims read. */
function fakePool(existingDims: string[]): { db: Queryable; sql: string[] } {
  const sql: string[] = []
  const client: QueryableClient = {
    query: vi.fn(async (text: string) => {
      sql.push(text)
      if (/FROM stats\.dataset_dimension WHERE dataset_code/i.test(text)) {
        return { rows: existingDims.map((d) => ({ dim_code: d })) }
      }
      if (/bump_dataset_version/i.test(text)) return { rows: [{ version: '7' }] }
      return { rows: [] }
    }) as QueryableClient['query'],
    release: vi.fn(),
  }
  const db: Queryable = {
    query: client.query,
    connect: async () => client,
  }
  return { db, sql }
}

const plan = (): VersionMintPlan => ({
  datasetCode: 'GDP_ANNUAL',
  datasetVersion: 'v2',
  dimensions: [
    { dimCode: 'time', ord: 0, isTimeDim: true },
    { dimCode: 'approach', ord: 1, isTimeDim: false }, // the NEW dim
    { dimCode: 'measure', ord: 2, isTimeDim: false },
    { dimCode: 'geo', ord: 3, isTimeDim: false },
  ],
  dimLabels: { approach: { ka: 'მ', en: 'Approach' } },
})

describe('mintDatasetVersion — the governed widen', () => {
  it('adds the new non-time dim and reports it (existing dims not re-reported)', async () => {
    // Gold already has time,measure,geo — the workbook adds `approach`.
    const { db, sql } = fakePool(['time', 'measure', 'geo'])
    const res = await mintDatasetVersion(db, plan())

    expect(res.datasetCode).toBe('GDP_ANNUAL')
    expect(res.datasetVersion).toBe('v2')
    expect(res.addedDims).toEqual(['approach']) // ONLY the genuinely new non-time dim
    expect(res.version).toBe(7) // the bumped counter value

    // The axis row + the DSD widen were issued for every dim (ON CONFLICT DO NOTHING).
    expect(sql.some((s) => /INSERT INTO stats\.dimension/i.test(s))).toBe(true)
    expect(sql.some((s) => /INSERT INTO stats\.dataset_dimension/i.test(s))).toBe(true)
    // The version label is stamped on the metadata slot (no parallel store).
    expect(sql.some((s) => /UPDATE stats\.dataset[\s\S]*metadata[\s\S]*dataset_version/i.test(s))).toBe(true)
    // The V6 ETag counter bumped (the new version row).
    expect(sql.some((s) => /bump_dataset_version/i.test(s))).toBe(true)
    // Atomic.
    expect(sql[0]).toMatch(/BEGIN/i)
    expect(sql.at(-1)).toMatch(/COMMIT/i)
  })

  it('idempotent — re-ingest where the dim already exists adds nothing', async () => {
    // The new dim is ALREADY in gold (a converged re-ingest of the same versioned wb).
    const { db } = fakePool(['time', 'approach', 'measure', 'geo'])
    const res = await mintDatasetVersion(db, plan())
    expect(res.addedDims).toEqual([]) // converged — no dup
    expect(res.version).toBe(7) // the counter still advances (a cache signal, harmless)
  })

  it('time-only / no new dim — addedDims empty (time is never a series-key add)', async () => {
    const { db } = fakePool(['approach', 'measure', 'geo']) // all non-time present; time new
    const res = await mintDatasetVersion(db, plan())
    expect(res.addedDims).toEqual([]) // time is flagged isTimeDim → never reported
  })

  it('fails fast without a pool (the mint owns its transaction)', async () => {
    const noConnect: Queryable = { query: async () => ({ rows: [] }) }
    await expect(mintDatasetVersion(noConnect, plan())).rejects.toThrow(/connect/i)
  })

  it('rolls back on a mid-plan error (atomic)', async () => {
    const sql: string[] = []
    let calls = 0
    const client: QueryableClient = {
      query: (async (text: string) => {
        sql.push(text)
        calls++
        if (calls > 2) throw new Error('boom') // fail after BEGIN + the dims read
        if (/FROM stats\.dataset_dimension WHERE/i.test(text)) return { rows: [] }
        return { rows: [] }
      }) as QueryableClient['query'],
      release: vi.fn(),
    }
    const db: Queryable = { query: client.query, connect: async () => client }
    await expect(mintDatasetVersion(db, plan())).rejects.toThrow(/boom/)
    expect(sql).toContain('ROLLBACK')
  })
})
