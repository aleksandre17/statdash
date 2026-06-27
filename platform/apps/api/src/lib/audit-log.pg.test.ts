// ── Fitness — pg-backed audit trail survives a simulated restart (API-03) ─────
//
// DB-gated like submit.provenance.test.ts: skipped offline, a real gate where the
// V15-migrated DB (config.audit_log) exists. Every test runs in a txn ROLLED BACK
// in afterEach (never mutates the shared trail). "Restart" is simulated by a SECOND
// createPgAuditLogger over the same connection with NO shared in-memory state: if
// it reads back what the first logger wrote, the entry is genuinely IN THE DB
// (durable) — not held in a process-local ring that a restart would lose.

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createPgAuditLogger, type AuditDb } from './audit-log.js'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

function asDb(client: PoolClient): AuditDb {
  return {
    query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
      const res = await client.query(sql, params as unknown[])
      return { rows: res.rows as T[] }
    },
  }
}

suite('createPgAuditLogger — durable governance trail (V15)', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  it('persists an entry that a FRESH logger (simulated restart) reads back', async () => {
    const db = asDb(client)
    const action = `test.publish.${Math.random().toString(36).slice(2)}`
    const writer = createPgAuditLogger(db)
    await writer.log({ userId: 'curator-7', action, resource: 'job-42', payload: { reason: 'approved' } })

    // Simulated restart: a brand-new adapter, no shared memory with `writer`.
    const reader = createPgAuditLogger(db)
    const entries = await reader.recent(100)
    const found = entries.find((e) => e.action === action)
    expect(found).toBeDefined()
    expect(found).toMatchObject({ userId: 'curator-7', action, resource: 'job-42', payload: { reason: 'approved' } })
    expect(typeof found!.ts).toBe('string')
  })

  it('recent() returns newest-first and honours the limit', async () => {
    const db = asDb(client)
    const logger = createPgAuditLogger(db)
    const tag = Math.random().toString(36).slice(2)
    await logger.log({ action: `a.${tag}` })
    await logger.log({ action: `b.${tag}` })
    const recent = await logger.recent(1)
    expect(recent).toHaveLength(1)
    expect(recent[0].action).toBe(`b.${tag}`)
  })
})
