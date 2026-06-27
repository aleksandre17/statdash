// ── Fitness — pg-backed snapshot store survives a simulated restart (API-09) ──
//
// DB-gated: skipped offline, a real gate where the V36-migrated DB
// (config.snapshot) exists. Each test runs in a txn ROLLED BACK in afterEach. A
// minted embed URL must survive a deploy: "restart" is a SECOND
// createPgSnapshotStore over the same connection (no shared LRU). If it reads back
// the stored snapshot, the embed is genuinely durable (not in a process-local ring
// the next deploy would drop).

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPgSnapshotStore, type SnapshotDb, type StoredSnapshot } from './snapshot-store.js'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

function asDb(client: PoolClient): SnapshotDb {
  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const res = await client.query(sql, params as unknown[])
      return { rows: res.rows as T[] }
    },
  }
}

const token = (): string => `tok-${Math.random().toString(36).slice(2)}`

suite('createPgSnapshotStore — durable embed snapshots (V36)', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  it('a FRESH store (simulated restart) reads back the stored snapshot', async () => {
    const db = asDb(client)
    const t = token()
    const entry: StoredSnapshot = {
      snapshot: { generatedAt: '2026-06-17T00:00:00.000Z', nodes: [], status: 'ok' },
      createdAt: Date.now(),
      params: { expiresAt: Date.now() + 60_000, allowedDims: { geo: ['GE'] } },
    }
    await createPgSnapshotStore(db).set(t, entry)

    const reloaded = await createPgSnapshotStore(db).get(t)
    expect(reloaded).toBeDefined()
    expect(reloaded!.snapshot).toEqual(entry.snapshot)
    expect(reloaded!.params.expiresAt).toBe(entry.params.expiresAt)
    expect(reloaded!.params.allowedDims).toEqual({ geo: ['GE'] })
  })

  it('get() of an unknown token is undefined', async () => {
    expect(await createPgSnapshotStore(asDb(client)).get(token())).toBeUndefined()
  })

  it('set() of the same token upserts (idempotent re-mint)', async () => {
    const db = asDb(client)
    const store = createPgSnapshotStore(db)
    const t = token()
    await store.set(t, { snapshot: { generatedAt: 'a' }, createdAt: Date.now(), params: {} })
    await store.set(t, { snapshot: { generatedAt: 'b' }, createdAt: Date.now(), params: {} })
    const got = await store.get(t)
    expect(got!.snapshot.generatedAt).toBe('b')
  })
})
