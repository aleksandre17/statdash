// ── Boot provisioning of config.data_source (P3-4) ────────────────────────────
//
// The geostat front + panel build their store manifest from config.data_source via
// GET /api/data-sources. A fresh stack has ZERO rows, so boot provisioning must
// self-seed them — `docker-compose up` with ZERO manual steps. Driven end-to-end
// through runProvisioning (parse → upsert) so the parser's default-narrowing AND the
// upserter's idempotency both run on the real boot path. Invariants asserted:
//   • url = NULL          — single-origin relative base (never localhost)
//   • status = 'connected'— else the public read (WHERE status='connected') hides it
//   • datasetCode + nonTimeDims carried verbatim into config (the store-builder reads them)
//   • idempotent          — re-run converges; manual rows reconcile; no dup, no churn
//
// Split from loader.test.ts (one-concern-per-file, 05/09 hygiene). A focused FakePg
// models only config.data_source — the loader depends on the PgPool PORT, so this
// in-memory fake is a drop-in (Dependency Inversion).

import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runProvisioning } from './loader.js'
import type { PgPool, PgClient, QueryResult } from './types.js'

interface DataSourceRow { id: string; name: string; type: string; url: string | null; config: unknown; status: string }

class FakePg implements PgPool {
  dataSources: DataSourceRow[] = []
  private seq = 0
  /** Counts data_source INSERT + UPDATE writes — the idempotency assertion hinges on this. */
  writes = 0

  async connect(): Promise<PgClient> {
    return { query: <R>(sql: string, params?: unknown[]) => this.query<R>(sql, params), release: () => {} }
  }

  async query<R = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
    const s = sql.replace(/\s+/g, ' ').trim()
    if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK')) return { rows: [] }

    if (s.includes('SELECT id, type, url, config, status FROM config.data_source WHERE name')) {
      const row = this.dataSources.find((r) => r.name === params[0])
      return { rows: (row ? [{ id: row.id, type: row.type, url: row.url, config: row.config, status: row.status }] : []) as R[] }
    }
    if (s.startsWith('UPDATE config.data_source SET type')) {
      this.writes++
      const row = this.dataSources.find((r) => r.id === params[0])
      if (row) {
        row.type = params[1] as string
        row.url = params[2] as string | null
        row.config = JSON.parse(params[3] as string)
        row.status = params[4] as string
      }
      return { rows: [] }
    }
    if (s.startsWith('INSERT INTO config.data_source')) {
      this.writes++
      this.dataSources.push({
        id: `ds-${++this.seq}`,
        name:   params[0] as string,
        type:   params[1] as string,
        url:    params[2] as string | null,
        config: JSON.parse(params[3] as string),
        status: params[4] as string,
      })
      return { rows: [] }
    }
    throw new Error(`FakePg: unhandled SQL: ${s}`)
  }
}

async function withDir(files: Record<string, string>, fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'prov-ds-'))
  try {
    for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content, 'utf8')
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// The exact 3 sources the geostat client needs — mirrors provisioning/geostat.provisioning.json.
// url OMITTED on purpose (→ NULL). status='connected' so the public read surfaces them.
const GEOSTAT_SOURCES = JSON.stringify({
  version: 1,
  dataSources: [
    { name: 'gdp',      type: 'rest', status: 'connected',
      config: { datasetCode: 'GDP_ANNUAL',        nonTimeDims: ['measure', 'geo'],             classifierDims: ['measure', 'geo'] } },
    { name: 'accounts', type: 'rest', status: 'connected',
      config: { datasetCode: 'ACCOUNTS_SEQUENCE', nonTimeDims: ['measure', 'account', 'side'], classifierDims: ['measure', 'account', 'side'] } },
    { name: 'regional', type: 'rest', status: 'connected',
      config: { datasetCode: 'REGIONAL_GVA',      nonTimeDims: ['measure', 'geo', 'sector'],   classifierDims: ['measure', 'geo', 'sector'] } },
  ],
})

const silent = { info() {}, warn() {}, error() {} }

describe('runProvisioning — config.data_source', () => {
  let pg: FakePg
  beforeEach(() => { pg = new FakePg() })

  it('provisions the 3 geostat rows: url=NULL, status=connected, correct datasetCode/nonTimeDims', async () => {
    await withDir({ 'sources.json': GEOSTAT_SOURCES }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([
        { kind: 'dataSource', key: 'gdp',      outcome: 'created' },
        { kind: 'dataSource', key: 'accounts', outcome: 'created' },
        { kind: 'dataSource', key: 'regional', outcome: 'created' },
      ])
      expect(pg.dataSources).toEqual([
        { id: expect.any(String), name: 'gdp',      type: 'rest', url: null, status: 'connected',
          config: { datasetCode: 'GDP_ANNUAL',        nonTimeDims: ['measure', 'geo'],             classifierDims: ['measure', 'geo'] } },
        { id: expect.any(String), name: 'accounts', type: 'rest', url: null, status: 'connected',
          config: { datasetCode: 'ACCOUNTS_SEQUENCE', nonTimeDims: ['measure', 'account', 'side'], classifierDims: ['measure', 'account', 'side'] } },
        { id: expect.any(String), name: 'regional', type: 'rest', url: null, status: 'connected',
          config: { datasetCode: 'REGIONAL_GVA',      nonTimeDims: ['measure', 'geo', 'sector'],   classifierDims: ['measure', 'geo', 'sector'] } },
      ])
      expect(pg.dataSources.every((r) => r.url === null)).toBe(true)   // single-origin invariant
    })
  })

  it('defaults url=NULL and status=connected when the manifest omits them', async () => {
    const minimal = JSON.stringify({ version: 1, dataSources: [{ name: 'gdp', type: 'rest', config: { datasetCode: 'GDP_ANNUAL' } }] })
    await withDir({ 'sources.json': minimal }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      expect(pg.dataSources[0]).toMatchObject({ url: null, status: 'connected' })
    })
  })

  it('is idempotent: a second run on unchanged sources is all-unchanged with no write churn', async () => {
    await withDir({ 'sources.json': GEOSTAT_SOURCES }, async (dir) => {
      await runProvisioning(pg, { dir, logger: silent })
      expect(pg.writes).toBe(3)                     // 3 inserts on the first run
      const second = await runProvisioning(pg, { dir, logger: silent })
      expect(second.results).toEqual([
        { kind: 'dataSource', key: 'gdp',      outcome: 'unchanged' },
        { kind: 'dataSource', key: 'accounts', outcome: 'unchanged' },
        { kind: 'dataSource', key: 'regional', outcome: 'unchanged' },
      ])
      expect(pg.writes).toBe(3)                     // still 3 — the re-run wrote nothing
      expect(pg.dataSources).toHaveLength(3)        // no duplicate rows
    })
  })

  it('reconciles a manually-seeded matching row to unchanged (no duplicate, no error)', async () => {
    // Pre-seed exactly what the live demo was hand-seeded with: url NULL, connected.
    pg.dataSources.push({
      id: 'manual-gdp', name: 'gdp', type: 'rest', url: null, status: 'connected',
      config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['measure', 'geo'], classifierDims: ['measure', 'geo'] },
    })
    const oneSource = JSON.stringify({
      version: 1,
      dataSources: [{ name: 'gdp', type: 'rest', status: 'connected',
        config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['measure', 'geo'], classifierDims: ['measure', 'geo'] } }],
    })
    await withDir({ 'sources.json': oneSource }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'dataSource', key: 'gdp', outcome: 'unchanged' }])
      expect(pg.dataSources).toHaveLength(1)        // reconciled in place, not duplicated
      expect(pg.writes).toBe(0)                     // matching manual row ⇒ zero writes
    })
  })

  it('updates an existing source whose status drifted (e.g. left at idle default)', async () => {
    pg.dataSources.push({
      id: 'drift-gdp', name: 'gdp', type: 'rest', url: null, status: 'idle',
      config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['measure', 'geo'], classifierDims: ['measure', 'geo'] },
    })
    const oneSource = JSON.stringify({
      version: 1,
      dataSources: [{ name: 'gdp', type: 'rest', status: 'connected',
        config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['measure', 'geo'], classifierDims: ['measure', 'geo'] } }],
    })
    await withDir({ 'sources.json': oneSource }, async (dir) => {
      const report = await runProvisioning(pg, { dir, logger: silent })
      expect(report.results).toEqual([{ kind: 'dataSource', key: 'gdp', outcome: 'updated' }])
      expect(pg.dataSources[0].status).toBe('connected')   // idle → connected
    })
  })

  it('dryRun does not write data_source', async () => {
    await withDir({ 'sources.json': GEOSTAT_SOURCES }, async (dir) => {
      const report = await runProvisioning(pg, { dir, dryRun: true, logger: silent })
      expect(report.results[0]).toMatchObject({ kind: 'dataSource', outcome: 'skipped', reason: 'dry-run' })
      expect(pg.dataSources).toHaveLength(0)
      expect(pg.writes).toBe(0)
    })
  })
})
