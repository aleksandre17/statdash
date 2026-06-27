// ── E2E harness for the canonical-ingestion regression anchor (ADR-0031 Wave 5a) ─
//
// One concern: BOOT a real-Pool app over the production routes, make the pipeline's
// preconditions deterministic, drive a workbook through the FULL FSM (upload → poll
// staged → publish → poll published), and reset gold to fresh state. The test file
// (canonical-ingest.e2e.test.ts) owns the ASSERTIONS; this owns the plumbing — kept
// separate so neither file bloats past the one-concern ceiling (`05`/`09`).
//
// NOT a *.test.ts → vitest does not collect it as a suite; it is imported by the e2e
// test. It must therefore never be imported by runtime src/ (it reaches `pg` + the
// routes directly, the test boundary).

import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The 3 conformant canonical workbooks + their EXACT published-obs counts (every
 *  DATA key is distinct → published 1:1, no dedup; verified against the fixtures). */
export const DATASETS = ['GDP_ANNUAL', 'ACCOUNTS_SEQUENCE', 'REGIONAL_GVA'] as const
export const EXPECTED_OBS: Record<string, number> = {
  GDP_ANNUAL: 288,
  ACCOUNTS_SEQUENCE: 415,
  REGIONAL_GVA: 1554,
}

interface JobView {
  job: { id: string; status: string; stagedCount?: number }
  issuesBySeverity: { error: number; warn: number; info: number }
  canPublish: boolean
}

const POLL_INTERVAL_MS = 250
const POLL_TIMEOUT_MS = 60_000
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Locate DATA/canonical by walking up (no brittle ../../../). */
export function findDataDir(): string {
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

/** The booted e2e fixture: the real Pool, the app over the production routes, the JWT. */
export interface E2eHarness {
  pool: Pool
  app: FastifyInstance
  adminJwt: string
}

/**
 * Boot a Fastify app wired to a REAL Pool (so the worker + publish own their own
 * connect()-scoped transactions and gold writes COMMIT). Only the routes this proof
 * exercises are mounted, each at its production prefix: canonical upload + the ingest
 * FSM/publish + the serve surfaces (cube + stats).
 */
export async function bootHarness(databaseUrl: string): Promise<E2eHarness> {
  const pool = new Pool({ connectionString: databaseUrl })

  const Fastify = (await import('fastify')).default
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
  const { issueToken } = await import('../../lib/auth.js')
  const { env } = await import('../../env.js')
  const { canonicalRoutes } = await import('../../routes/ingest/canonical.js')
  const { ingestRoutes } = await import('../../routes/ingest/index.js')
  const { cubeRoutes } = await import('../../routes/cube/index.js')
  const { statsRoutes } = await import('../../routes/stats/index.js')

  const app = Fastify()
  registerProblemErrorHandler(app)
  app.decorate('pg', pool as never) // the REAL pool — .connect() is live (worker/publish)
  await app.register(canonicalRoutes(), { prefix: '/api/ingest/canonical' })
  await app.register(ingestRoutes(), { prefix: '/api/ingest' })
  await app.register(cubeRoutes, { prefix: '/api/cube' })
  await app.register(statsRoutes(), { prefix: '/api/stats' })
  await app.ready()

  const adminJwt = issueToken('admin', env.JWT_SECRET, undefined, ['admin'])
  return { pool, app, adminJwt }
}

/**
 * Make the pipeline's preconditions deterministic (root-cause, not order-dependent):
 *   · config.locale ka+en ACTIVE — the classifier label completeness gate.
 *   · the 3 datasets EXIST with their DSD (from STRUCTURE, Law-1 ordered) — validateObs
 *     needs the dataset + non-time DSD or facts reject (UNKNOWN_DATASET/DIM_KEY_MISMATCH).
 *   · each dataset status='published' — the V28 projection gates the serve reads.
 * All idempotent: a fresh DB and a migrated/seeded DB both converge to the same state.
 */
export async function ensurePreconditions(h: E2eHarness): Promise<void> {
  const { pool } = h

  await pool.query(
    `INSERT INTO config.locale (code, name, name_en, is_active, is_default, icu_locale, ord) VALUES
       ('ka', 'ქართული', 'Georgian', true, true,  'ka', 0),
       ('en', 'English',  'English',  true, false, 'en', 1)
     ON CONFLICT (code) DO UPDATE SET is_active = true`,
  )

  await pool.query(
    `INSERT INTO stats.dimension (code, label, ord) VALUES
       ('time',     '{"ka":"პერიოდი","en":"Time"}'::jsonb,        0),
       ('measure',  '{"ka":"მაჩვენებელი","en":"Measure"}'::jsonb, 1),
       ('geo',      '{"ka":"ტერიტორია","en":"Geography"}'::jsonb, 2),
       ('approach', '{"ka":"მიდგომა","en":"Approach"}'::jsonb,    3),
       ('account',  '{"ka":"ანგარიში","en":"Account"}'::jsonb,    4),
       ('side',     '{"ka":"მხარე","en":"Side"}'::jsonb,          5),
       ('sector',   '{"ka":"სექტორი","en":"Sector"}'::jsonb,      6)
     ON CONFLICT (code) DO NOTHING`,
  )

  const { readWorkbook } = await import('./read-workbook.js')
  const { parseCanonicalWorkbook } = await import('./parse.js')
  for (const code of DATASETS) {
    const buf = readFileSync(join(findDataDir(), `${code}.xlsx`))
    const { dsd } = parseCanonicalWorkbook(readWorkbook(buf), { activeLocales: ['ka', 'en'] })

    await pool.query(
      `INSERT INTO stats.dataset (code, label, frequency, status)
         VALUES ($1, $2::jsonb, 'A', 'draft')
       ON CONFLICT (code) DO NOTHING`,
      [code, JSON.stringify({ ka: dsd.name.ka ?? code, en: dsd.name.en ?? code })],
    )
    for (let i = 0; i < dsd.dimensions.length; i++) {
      const dim = dsd.dimensions[i]
      await pool.query(
        `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord)
           VALUES ($1, $2, $3, $4)
         ON CONFLICT (dataset_code, dim_code) DO NOTHING`,
        [code, dim, dim === 'time', i],
      )
    }
    // draft → published via the FSM (cast pins the overload). If already published the
    // transition may reject in some builds → force the column; the end state is the same.
    await pool.query(`SELECT stats.set_dataset_status($1::text, 'published')`, [code])
      .catch(async () => {
        await pool.query(`UPDATE stats.dataset SET status = 'published' WHERE code = $1`, [code])
      })
  }
}

/**
 * Fresh state: wipe the 3 datasets' gold facts + their pipeline rows so counts are
 * EXACT (not cumulative across re-runs). Classifiers are LEFT (SCD-2 + cross-dataset,
 * shared with the seed corpus; the codelists submission converges them idempotently).
 * submission_blob / *_staging / validation_issue cascade via FK ON DELETE CASCADE.
 */
export async function freshState(pool: Pool): Promise<void> {
  for (const code of DATASETS) {
    await pool.query(`DELETE FROM stats.observation_revision WHERE dataset_code = $1`, [code]).catch(() => {})
    await pool.query(`DELETE FROM stats.observation WHERE dataset_code = $1`, [code])
    await pool.query(`DELETE FROM stats.release WHERE dataset_code = $1`, [code]).catch(() => {})
  }
  await pool.query(
    `DELETE FROM stats_stage.submission
      WHERE format = 'canonical-xlsx'
        AND (dataset_code = ANY($1) OR dataset_code IS NULL)`,
    [DATASETS as unknown as string[]],
  )
}

/** Poll one job's FSM (via the real GET /jobs/:id) to a terminal target; throw on failed/rejected/timeout. */
async function pollStatus(h: E2eHarness, jobId: string, target: 'staged' | 'published'): Promise<JobView> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  for (;;) {
    const res = await h.app.inject({
      method: 'GET', url: `/api/ingest/jobs/${jobId}`,
      headers: { authorization: `Bearer ${h.adminJwt}` },
    })
    const { data } = res.json() as { data: JobView }
    const status = data.job.status
    if (status === target) return data
    if (status === 'published' && target === 'staged') return data // already past
    if (status === 'failed' || status === 'rejected') {
      const issues = await h.app.inject({
        method: 'GET', url: `/api/ingest/jobs/${jobId}/issues`,
        headers: { authorization: `Bearer ${h.adminJwt}` },
      })
      throw new Error(`job ${jobId} ${status}: ${issues.body}`)
    }
    if (Date.now() >= deadline) {
      throw new Error(`job ${jobId} did not reach '${target}' within ${POLL_TIMEOUT_MS / 1000}s (last: '${status}')`)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

/** Wait for 'staged', then POST /publish (the explicit gate), then wait for 'published'. */
async function publish(h: E2eHarness, jobId: string): Promise<void> {
  const staged = await pollStatus(h, jobId, 'staged')
  if (staged.job.status === 'published') return // idempotent re-run
  const res = await h.app.inject({
    method: 'POST', url: `/api/ingest/jobs/${jobId}/publish`,
    headers: { authorization: `Bearer ${h.adminJwt}` },
  })
  if (res.statusCode !== 200) throw new Error(`publish ${jobId} → ${res.statusCode}: ${res.body}`)
  await pollStatus(h, jobId, 'published')
}

/**
 * Upload one canonical workbook → drive it to published gold the way a real curator does.
 *
 * THE ROUTE now orchestrates the seed-pipeline ordering: it drives REFERENCE DATA
 * (codelists, then displays) to PUBLISHED gold IN-PROCESS before submitting facts, then
 * returns the FACTS jobId 'staged' (the curator-approval gate; the facts validate against
 * the now-published classifiers). So this harness no longer publishes codelists itself —
 * the route did. It only approves the FACTS: poll the facts job to 'staged' (the route
 * left it there) → POST /publish → poll 'published'. Each returned job carries the FSM
 * status the route left it in: 'published' for reference data, 'staged' for facts.
 */
export async function ingestAndPublish(h: E2eHarness, code: string): Promise<{ kind: string; jobId: string; status?: string }[]> {
  const buf = readFileSync(join(findDataDir(), `${code}.xlsx`))
  const res = await h.app.inject({
    method: 'POST', url: '/api/ingest/canonical',
    headers: {
      'content-type': 'application/octet-stream',
      authorization: `Bearer ${h.adminJwt}`,
      'x-filename': `${code}.xlsx`,
    },
    payload: buf,
  })
  if (res.statusCode !== 202) throw new Error(`${code} upload → ${res.statusCode}: ${res.body}`)
  const { data } = res.json() as {
    data: { datasetCode: string; jobIds: { kind: string; jobId: string; status?: string }[] }
  }
  // The route already published the reference data (codelists/displays) to gold. The
  // curator approves only the FACTS (the approval gate the route deliberately preserves).
  const facts = data.jobIds.find((j) => j.kind === 'facts')
  if (!facts) throw new Error(`${code} upload produced no facts job (jobIds: ${JSON.stringify(data.jobIds)})`)
  await publish(h, facts.jobId)
  return data.jobIds
}
