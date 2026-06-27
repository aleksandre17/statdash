// ── Route — versioned-DSD ingestion governance (ADR-0031 §4 improvement 5) ────
//
// THE NETS this locks (the RESOLVABLE DSD gate):
//   · a DSD change (a new `approach` dim vs the registered [time,measure]) WITHOUT a
//     version → 400 DSD_INCOMPATIBLE; the DSD is UNCHANGED (the gate held).      [DB-gated]
//   · the SAME workbook WITH ?datasetVersion=v2 → 202 + a versionMint summary; the
//     dataset_dimension now INCLUDES `approach`, a new dataset_version row exists,
//     and the version label is stamped on the dataset metadata (new vintage).    [DB-gated]
//   · re-ingest of the versioned workbook converges — no duplicate dim row.       [DB-gated]
//
// Needs a REAL Pool (the route drives the worker + mint + publish over connect()-scoped
// txns and COMMITS to gold) — so it is DB-gated (skips clean without DATABASE_URL, the
// real gate in CI) and cleans up its synthetic dataset afterwards. The pure precedence/
// shaping nets are in canonical-dsd-inputs.test.ts; the mint plan in version-mint.test.ts.

import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

import { writeWorkbook } from '../../ingest/canonical/read-workbook.js'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL && DATABASE_URL !== 'postgres://test' ? describe : describe.skip

const DS = 'VTEST_DSD'

// A canonical workbook whose DSD is [time, measure, approach] — i.e. it adds `approach`
// over the registered [time, measure]. CL sheets for both non-time dims; one DATA row.
function versionedWorkbook(): Buffer {
  return writeWorkbook({
    STRUCTURE: [
      ['key', 'value'],
      ['dataset_code', DS],
      ['name_en', 'Versioned test'],
      ['name_ka', 'ვერსიის ტესტი'],
      ['dimensions', 'time,measure,approach'],
      ['measure', 'OBS_VALUE'],
    ],
    CL_MEASURE: [
      ['code', 'name_ka', 'name_en', 'parent', 'order'],
      ['GDP', 'მშპ', 'GDP', '', 1],
    ],
    CL_APPROACH: [
      ['code', 'name_ka', 'name_en', 'parent', 'order'],
      ['_Z', 'სულ', 'Total', '', 1],
    ],
    DATA: [
      ['measure', 'approach', 'time', 'obs_value', 'obs_status'],
      ['GDP', '_Z', '2010', 100, 'A'],
    ],
  })
}

dbSuite('POST /api/ingest/canonical — versioned DSD change (live DB)', () => {
  let pool: Pool
  let app: FastifyInstance
  let adminJwt: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })

    const Fastify = (await import('fastify')).default
    const { canonicalRoutes } = await import('./canonical.js')
    const { ingestRoutes } = await import('./index.js')
    const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
    const { issueToken } = await import('../../lib/auth.js')
    const { env } = await import('../../env.js')

    app = Fastify()
    registerProblemErrorHandler(app)
    app.decorate('pg', pool as never) // REAL pool — worker/mint/publish open their own txns
    await app.register(canonicalRoutes(), { prefix: '/api/ingest/canonical' })
    await app.register(ingestRoutes(), { prefix: '/api/ingest' })
    await app.ready()
    adminJwt = issueToken('admin', env.JWT_SECRET, undefined, ['admin'])

    // Active locales for the classifier label gate.
    await pool.query(
      `INSERT INTO config.locale (code, name, name_en, is_active, is_default, icu_locale, ord) VALUES
         ('ka','ქართული','Georgian',true,true,'ka',0),('en','English','English',true,false,'en',1)
       ON CONFLICT (code) DO UPDATE SET is_active = true`,
    )
    // The axes that pre-exist; `approach` is added BY the mint (do NOT pre-create it).
    await pool.query(
      `INSERT INTO stats.dimension (code, label) VALUES
         ('time','{"ka":"დრო","en":"Time"}'::jsonb),('measure','{"ka":"მ","en":"Measure"}'::jsonb)
       ON CONFLICT (code) DO NOTHING`,
    )
  }, 120_000)

  afterAll(async () => {
    if (app) await app.close()
    if (pool) {
      await cleanup(pool)
      await pool.query(`DELETE FROM stats.dataset_dimension WHERE dim_code = 'approach' AND dataset_code = $1`, [DS]).catch(() => {})
      await pool.end()
    }
  })

  async function cleanup(p: Pool): Promise<void> {
    await p.query(`DELETE FROM stats.observation WHERE dataset_code = $1`, [DS]).catch(() => {})
    await p.query(`DELETE FROM stats.release WHERE dataset_code = $1`, [DS]).catch(() => {})
    await p.query(`DELETE FROM stats_stage.submission WHERE dataset_code = $1 OR dataset_code IS NULL AND format='canonical-xlsx'`, [DS]).catch(() => {})
    await p.query(`DELETE FROM stats.dataset_version WHERE dataset_code = $1`, [DS]).catch(() => {})
    await p.query(`DELETE FROM stats.dataset_dimension WHERE dataset_code = $1`, [DS]).catch(() => {})
    await p.query(`DELETE FROM stats.dataset WHERE code = $1`, [DS]).catch(() => {})
  }

  // Register the dataset with the PRIOR DSD [time, measure] (no approach) — published.
  async function registerPriorDsd(): Promise<void> {
    await cleanup(pool)
    await pool.query(
      `INSERT INTO stats.dataset (code, label, frequency, status)
         VALUES ($1, '{"ka":"ვ","en":"v"}', 'A', 'published')
       ON CONFLICT (code) DO UPDATE SET status='published'`, [DS])
    await pool.query(
      `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
         ($1,'time',true,0),($1,'measure',false,1)
       ON CONFLICT (dataset_code, dim_code) DO NOTHING`, [DS])
  }

  afterEach(async () => { await cleanup(pool) })

  const upload = (versionQuery: string | undefined) => app.inject({
    method: 'POST',
    url: `/api/ingest/canonical${versionQuery ? `?datasetVersion=${versionQuery}` : ''}`,
    headers: { 'content-type': 'application/octet-stream', authorization: `Bearer ${adminJwt}`, 'x-filename': 'vtest.xlsx' },
    payload: versionedWorkbook(),
  })

  it('UNVERSIONED DSD change → 400 DSD_INCOMPATIBLE, the DSD is unchanged (gate held)', async () => {
    await registerPriorDsd()
    const res = await upload(undefined)
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('DSD_INCOMPATIBLE')

    const { rows } = await pool.query<{ dim_code: string }>(
      `SELECT dim_code FROM stats.dataset_dimension WHERE dataset_code = $1 ORDER BY ord`, [DS])
    expect(rows.map((r) => r.dim_code)).toEqual(['time', 'measure']) // NOT widened
  })

  it('VERSIONED DSD change → 202 + versionMint; dataset_dimension includes approach, a version row exists', async () => {
    await registerPriorDsd()
    const res = await upload('v2')
    expect(res.statusCode).toBe(202)
    const { data } = res.json() as {
      data: { versionMint?: { datasetVersion: string; addedDims: string[]; version: number } }
    }
    // The governed-version summary the panel keys its "new version" UX on.
    expect(data.versionMint?.datasetVersion).toBe('v2')
    expect(data.versionMint?.addedDims).toContain('approach')

    // The DSD was widened to the canonical STRUCTURE (approach now in the series key).
    const { rows: dims } = await pool.query<{ dim_code: string }>(
      `SELECT dim_code FROM stats.dataset_dimension WHERE dataset_code = $1 ORDER BY ord`, [DS])
    expect(dims.map((r) => r.dim_code)).toEqual(['time', 'measure', 'approach'])

    // A new dataset_version row exists (the V6 ETag counter — the "new version").
    const { rows: ver } = await pool.query<{ version: string }>(
      `SELECT version::text AS version FROM stats.dataset_version WHERE dataset_code = $1`, [DS])
    expect(ver.length).toBe(1)
    expect(Number(ver[0].version)).toBeGreaterThanOrEqual(1)

    // The version label is recorded on the dataset metadata slot (no parallel store).
    const { rows: meta } = await pool.query<{ v: string }>(
      `SELECT metadata->>'dataset_version' AS v FROM stats.dataset WHERE code = $1`, [DS])
    expect(meta[0].v).toBe('v2')
  })

  it('re-ingest of the versioned workbook converges — approach is not duplicated', async () => {
    await registerPriorDsd()
    await upload('v2') // first versioned ingest widens the DSD
    // The facts are staged (not published), so a second upload is not a 409 dup; the
    // mint must converge: the dim already exists → addedDims empty, no duplicate row.
    const res2 = await upload('v2')
    // 202 (re-stages facts) — the route is not blocked; the mint is idempotent.
    expect([202, 409]).toContain(res2.statusCode)
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM stats.dataset_dimension
         WHERE dataset_code = $1 AND dim_code = 'approach'`, [DS])
    expect(rows[0].n).toBe('1') // exactly one approach row — no dup
  })
})
