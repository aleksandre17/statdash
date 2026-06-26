// ── Route — canonical-workbook upload (ADR-0031 Wave 3a, §8 fitness nets) ──────
//
// THE NETS this locks (ADR §6 / §8):
//   · 202 + jobIds for a valid canonical workbook (GDP_ANNUAL.xlsx fixture), in the
//     codelists → displays → facts ORDER.                              [DB-gated]
//   · F-2 idempotency — re-POST the SAME bytes → 409 (Idempotent Receiver). [DB-gated]
//   · a DSD_INCOMPATIBLE workbook (a dim dropped vs the registered gold) → 400,
//     publish BLOCKED (no submission created).                          [DB-gated]
//   · a workbook carrying methodology_ref → a reference_metadata row at publish. [DB-gated]
//   · auth (401/403) + empty-body (400) + structural parseIssues (400). [DB-FREE]
//
// The boundary slice (auth + empty body + parseIssues) runs UNCONDITIONALLY with a
// fake app.pg that only answers the config.locale read — these paths never reach a
// gold write. The end-to-end nets (202/409/DSD/metadata) need a real pipeline + gold
// and are DB-gated (describe.skip without DATABASE_URL — a no-op locally, the real
// gate in CI). The Wave-5 e2e proves the full publish→gold render on the real DB.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeWorkbook } from '../../ingest/canonical/read-workbook.js'

// Env contract is parsed at import time (env.ts); set required vars BEFORE importing
// any module that reads it. JWT_SECRET is fixed so the test can issue verifiable tokens.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

// ── Locate DATA/canonical (walk up — no brittle ../../../) ─────────────────────
function findDataDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, 'DATA', 'canonical')
    if (existsSync(candidate)) return candidate
    const up = resolve(dir, '..')
    if (up === dir) break
    dir = up
  }
  throw new Error('Could not locate DATA/canonical fixtures')
}

// A minimal valid canonical workbook as .xlsx bytes (in-memory, no fixture needed).
// Uses the ACL's writeWorkbook (the one xlsx boundary) so this test never imports the
// vendor SDK itself (F-3). readWorkbook round-trips writeWorkbook's output.
const buildWorkbook = (sheets: import('../../ingest/canonical/read-workbook.js').SheetMatrices): Buffer =>
  writeWorkbook(sheets)

// ── DB-FREE boundary slice ─────────────────────────────────────────────────────
// A fake app.pg that answers ONLY the config.locale active-locale read (the single
// DB read before the boundary 400s). The gold-snapshot read is never reached on
// these paths (empty body / parseIssues 400 happen first; auth fails earliest).
function fakeLocalePg(): { query: (sql: string) => Promise<{ rows: unknown[] }> } {
  return {
    query: async (sql: string) => {
      if (/FROM config\.locale/i.test(sql)) {
        return { rows: [{ code: 'ka' }, { code: 'en' }] }
      }
      // unregistered dataset → loadGoldDsdSnapshot returns null → routine (no block)
      return { rows: [] }
    },
  }
}

async function buildBoundaryApp(): Promise<{ app: FastifyInstance; adminJwt: string; viewerJwt: string }> {
  const Fastify = (await import('fastify')).default
  const { canonicalRoutes } = await import('./canonical.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
  const { issueToken } = await import('../../lib/auth.js')
  const { env } = await import('../../env.js')

  const app = Fastify()
  registerProblemErrorHandler(app)
  app.decorate('pg', fakeLocalePg() as never)
  await app.register(canonicalRoutes, { prefix: '/api/ingest/canonical' })
  await app.ready()

  return {
    app,
    adminJwt:  issueToken('admin',  env.JWT_SECRET, undefined, ['admin']),
    viewerJwt: issueToken('viewer', env.JWT_SECRET, undefined, ['viewer']),
  }
}

describe('POST /api/ingest/canonical — boundary (DB-free)', () => {
  let app: FastifyInstance
  let adminJwt: string
  let viewerJwt: string

  beforeAll(async () => {
    const built = await buildBoundaryApp()
    app = built.app
    adminJwt = built.adminJwt
    viewerJwt = built.viewerJwt
  })

  const post = (body: Buffer | undefined, headers: Record<string, string>) =>
    app.inject({ method: 'POST', url: '/api/ingest/canonical', headers, payload: body })

  it('401 — no token', async () => {
    const res = await post(buildWorkbook({ STRUCTURE: [['key', 'value']] }), {
      'content-type': 'application/octet-stream',
    })
    expect(res.statusCode).toBe(401)
  })

  it('403 — valid token, wrong role (viewer)', async () => {
    const res = await post(buildWorkbook({ STRUCTURE: [['key', 'value']] }), {
      'content-type': 'application/octet-stream',
      authorization: `Bearer ${viewerJwt}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('400 — empty body', async () => {
    const res = await post(Buffer.alloc(0), {
      'content-type': 'application/octet-stream',
      authorization: `Bearer ${adminJwt}`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — structural parseIssues (no STRUCTURE sheet) surfaces PARSE_ISSUES', async () => {
    const buf = buildWorkbook({ DATA: [['x', 'time', 'obs_value']] })
    const res = await post(buf, {
      'content-type': 'application/octet-stream',
      authorization: `Bearer ${adminJwt}`,
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe('PARSE_ISSUES')
    expect(Array.isArray(body.parseIssues)).toBe(true)
    expect(body.parseIssues[0].code).toBe('MISSING_STRUCTURE')
  })

  it('400 — well-formed but empty (no codelists/displays/obs) → EMPTY_WORKBOOK', async () => {
    // A valid STRUCTURE with a single time dim (no CL sheets, no DATA rows) parses
    // clean but produces zero submissions — a curator error, not a silent 202.
    const buf = buildWorkbook({
      STRUCTURE: [
        ['key', 'value'],
        ['dataset_code', 'EMPTY_DS'],
        ['name_en', 'Empty'],
        ['dimensions', 'time'],
        ['measure', 'OBS_VALUE'],
      ],
      DATA: [['time', 'obs_value', 'obs_status']],
    })
    const res = await post(buf, {
      'content-type': 'application/octet-stream',
      authorization: `Bearer ${adminJwt}`,
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('EMPTY_WORKBOOK')
  })
})

// ── DB-GATED route-contract nets ────────────────────────────────────────────────
// Bind app.pg to a per-test txn client (rolled back in afterEach — never mutates the
// cube), POST via inject, and assert the route's REAL contract: createSubmission
// writes the bronze rows SYNCHRONOUSLY before the 202 (the worker drain fires via
// setImmediate and no-ops on a single client — fire-and-forget, caught/logged), so the
// kind/order/format/provenance/sourceDigest are all assertable in-txn. The full
// worker→publish→gold render is the Wave-5 e2e (real Pool, boot+poll).
//
// config.locale must hold ka+en (the standard seed) for the parser's label gate.
const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL && DATABASE_URL !== 'postgres://test' ? describe : describe.skip

dbSuite('POST /api/ingest/canonical — route contract (live DB, txn-rolled-back)', () => {
  let pool: import('pg').Pool
  let client: import('pg').PoolClient
  let app: FastifyInstance
  let adminJwt: string

  beforeAll(async () => {
    const { Pool } = await import('pg')
    pool = new Pool({ connectionString: DATABASE_URL })

    const Fastify = (await import('fastify')).default
    const { canonicalRoutes } = await import('./canonical.js')
    const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
    const { issueToken } = await import('../../lib/auth.js')
    const { env } = await import('../../env.js')

    app = Fastify()
    registerProblemErrorHandler(app)
    // app.pg forwards to OUR single per-test client (no .connect — the worker no-ops).
    app.decorate('pg', { query: (...a: unknown[]) => (client.query as (...x: unknown[]) => unknown)(...a) } as never)
    await app.register(canonicalRoutes, { prefix: '/api/ingest/canonical' })
    await app.ready()
    adminJwt = issueToken('admin', env.JWT_SECRET, undefined, ['admin'])
  })

  afterAll(async () => { if (app) await app.close(); await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  const upload = (buf: Buffer) => app.inject({
    method: 'POST', url: '/api/ingest/canonical',
    headers: { 'content-type': 'application/octet-stream', authorization: `Bearer ${adminJwt}`, 'x-filename': 'GDP_ANNUAL.xlsx' },
    payload: buf,
  })

  it('202 + ordered jobIds (codelists → facts) with provenance stamped, for GDP_ANNUAL.xlsx', async () => {
    const buf = readFileSync(join(findDataDir(), 'GDP_ANNUAL.xlsx'))
    const res = await upload(buf)
    expect(res.statusCode).toBe(202)
    const { data } = res.json()
    expect(data.datasetCode).toBe('GDP_ANNUAL')
    expect(typeof data.sourceDigest).toBe('string')

    // ORDER is load-bearing: codelists BEFORE facts (no DISPLAY sheet → no displays job).
    const kinds = data.jobIds.map((j: { kind: string }) => j.kind)
    expect(kinds).toEqual(['codelists', 'facts'])

    // Provenance + format stamped on EVERY submission (sampled by jobId).
    for (const j of data.jobIds) {
      const { rows } = await client.query<{ format: string; source_digest: string; provenance: { parserVersion: string; sourceDigest: string } | null }>(
        `SELECT format, source_digest, provenance FROM stats_stage.submission WHERE id = $1`, [j.jobId])
      expect(rows[0].format).toBe('canonical-xlsx')
      expect(rows[0].source_digest).toBe(data.sourceDigest)
      expect(rows[0].provenance?.parserVersion).toBe('canonical-workbook@1')
      expect(rows[0].provenance?.sourceDigest).toBe(data.sourceDigest)
    }

    // The facts submission is dataset-scoped; codelists is cross-dataset (NULL).
    const facts = data.jobIds.find((j: { kind: string }) => j.kind === 'facts')
    const { rows: f } = await client.query<{ dataset_code: string | null }>(
      `SELECT dataset_code FROM stats_stage.submission WHERE id = $1`, [facts.jobId])
    expect(f[0].dataset_code).toBe('GDP_ANNUAL')
  })

  it('F-2 idempotency — an already-published identical facts payload → 409', async () => {
    // Seed the published terminal state the Idempotent Receiver guards: the SAME content
    // hash the route will compute for the facts payload, on a published submission for
    // the same dataset. Re-POST then collides → 409 ALREADY_PUBLISHED.
    const { contentHash } = await import('../../ingest/index.js')
    const { readWorkbook } = await import('../../ingest/canonical/read-workbook.js')
    const { parseCanonicalWorkbook } = await import('../../ingest/canonical/parse.js')

    const buf = readFileSync(join(findDataDir(), 'GDP_ANNUAL.xlsx'))
    const { dsd, bronze } = parseCanonicalWorkbook(readWorkbook(buf), { activeLocales: ['ka', 'en'] })
    const referenceMetadata = (await import('../../ingest/reference-metadata-map.js'))
      .recognizeReferenceMetadata(dsd.meta)
    const factsPayload = { obs: bronze.obs, ...(referenceMetadata ? { referenceMetadata } : {}) }
    const hash = contentHash(factsPayload)

    const { rows: sub } = await client.query<{ id: string }>(
      `INSERT INTO stats_stage.submission (kind, dataset_code, format, dry_run, status, published_at)
       VALUES ('facts', 'GDP_ANNUAL', 'canonical-xlsx', false, 'published', now()) RETURNING id`)
    await client.query(
      `INSERT INTO stats_stage.submission_blob (submission_id, content_hash, raw_content, byte_size)
       VALUES ($1, $2, $3, $4)`,
      [sub[0].id, hash, JSON.stringify(factsPayload), Buffer.byteLength(JSON.stringify(factsPayload))])

    const res = await upload(buf)
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('ALREADY_PUBLISHED')
    expect(res.json().existingJobId).toBe(sub[0].id)
  })

  it('DSD_INCOMPATIBLE — a workbook whose dims differ from registered gold → 400, no submission', async () => {
    // Register GDP_ANNUAL in gold with a DIFFERENT (incompatible) dimension set, then
    // upload the real workbook (dims time,approach,measure,geo). The pre-pass classifies
    // a DSD change → DSD_INCOMPATIBLE (unversioned = error) → 400, BEFORE any submission.
    await client.query(
      `INSERT INTO stats.dataset (code, label, measure) VALUES ('GDP_ANNUAL', '{"ka":"მშპ","en":"GDP"}', 'OBS_VALUE')
       ON CONFLICT (code) DO UPDATE SET measure = 'OBS_VALUE'`)
    await client.query(
      `INSERT INTO stats.dimension (code, label) VALUES ('time','{"ka":"დრო","en":"t"}'),('approach','{"ka":"მ","en":"a"}')
       ON CONFLICT (code) DO NOTHING`)
    // Gold declares only time,approach — the workbook declares time,approach,measure,geo.
    await client.query(`DELETE FROM stats.dataset_dimension WHERE dataset_code = 'GDP_ANNUAL'`)
    await client.query(
      `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
         ('GDP_ANNUAL','time',true,0),('GDP_ANNUAL','approach',false,1)`)

    const before = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM stats_stage.submission`)
    const res = await upload(readFileSync(join(findDataDir(), 'GDP_ANNUAL.xlsx')))
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('DSD_INCOMPATIBLE')
    // The GATE held: no submission was created (publish blocked).
    const after = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM stats_stage.submission`)
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('Wave 3b — a published facts payload carrying methodology_ref lands a reference_metadata row', async () => {
    // Drive the publish path directly (the route returns at bronze; publish lands the
    // V31 row). Build a minimal facts submission whose blob carries the recognized
    // metadata, register the dataset published, publish, then assert the report row.
    const { publishSubmission } = await import('../../ingest/index.js')
    await client.query(
      `INSERT INTO stats.dataset (code, label, frequency, status, valid_from)
         VALUES ('META_DS', '{"ka":"მ","en":"m"}', 'A', 'published', now())
       ON CONFLICT (code) DO UPDATE SET status='published'`)
    await client.query(
      `INSERT INTO stats.metadataflow (code, label) VALUES ('ESMS_LITE','{"ka":"ნ","en":"f"}')
       ON CONFLICT (code) DO NOTHING`)

    const factsPayload = {
      obs: [],
      referenceMetadata: { methodologyUrl: 'https://geostat.ge/method', lastUpdated: '2026-06-26' },
    }
    const { rows: sub } = await client.query<{ id: string }>(
      `INSERT INTO stats_stage.submission (kind, dataset_code, format, dry_run, status)
       VALUES ('facts','META_DS','canonical-xlsx',false,'staged') RETURNING id`)
    await client.query(
      `INSERT INTO stats_stage.submission_blob (submission_id, content_hash, raw_content, byte_size)
       VALUES ($1,'h-meta',$2,$3)`,
      [sub[0].id, JSON.stringify(factsPayload), Buffer.byteLength(JSON.stringify(factsPayload))])

    // publishSubmission needs a pool (it opens its own txn). Use a Queryable whose
    // connect() returns OUR client so the publish runs inside this rolled-back txn.
    const poolish = {
      query: (...a: unknown[]) => (client.query as (...x: unknown[]) => unknown)(...a),
      connect: async () => ({
        query: (...a: unknown[]) => (client.query as (...x: unknown[]) => unknown)(...a),
        release: () => {},
      }),
    }
    await publishSubmission(poolish as never, sub[0].id)

    const { rows } = await client.query<{ methodology_url: string; last_updated: string }>(
      `SELECT methodology_url, last_updated FROM stats.reference_metadata
        WHERE dataset_code = 'META_DS' AND target_type = 'dataset' AND is_current`)
    expect(rows[0]?.methodology_url).toBe('https://geostat.ge/method')
    expect(rows[0]?.last_updated).toBe('2026-06-26')
  })
})
