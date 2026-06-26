// ── E2E regression anchor — canonical-workbook ingestion (ADR-0031 §6 Wave 5a) ─
//
// THE deliverable's proof: the 3 conformant canonical workbooks
// (DATA/canonical/{GDP_ANNUAL,ACCOUNTS_SEQUENCE,REGIONAL_GVA}.xlsx) ingest through
// the FULL real pipeline and the geostat-front serve endpoints return them.
//
//   POST /api/ingest/canonical  (route parses .xlsx at the boundary → up to 3 ordered
//      submissions: codelists → displays → facts; the worker NEVER sees Excel). The route
//      ORCHESTRATES the seed-pipeline ordering: it drives REFERENCE DATA (codelists, then
//      displays) to PUBLISHED gold IN-PROCESS, then submits the facts STAGED. So the
//      classifier members are in gold (is_current=true) BEFORE the facts validate against
//      them — the fix for the ordering bug where a batched submit validated facts while
//      the codes were only staged (every code → UNKNOWN_CODE).
//   → the route returns: codelists/displays 'published' + the facts jobId 'staged'.
//   → POST /api/ingest/jobs/:factsId/publish  (the EXPLICIT approval gate → gold; the
//      route deliberately does NOT auto-publish facts — auto-opens a singleton release,
//      stamps observation.release_id, bumps the version)
//   → published.   Then the SERVE path the geostat front consumes:
//   GET /api/cube/:code/profile  (dims + members + timeCoverage)
//   GET /api/stats/observations?dataset=…  (the published facts).
//
// THE FACTS FSM IS NOT AUTO-PUBLISH: the route leaves facts 'staged'; publish is a
// separate curator action. So this e2e approves only the FACTS (poll→publish→poll),
// mirroring the proven live harness scripts/seed-pipeline.ts. Reference data is already
// gold (the route published it). The plumbing (boot real-Pool app, preconditions, FSM
// drive, fresh-state reset) lives in ./canonical-ingest.e2e-harness.ts — this file owns
// the ASSERTIONS only.
//
// DB-GATED: skips clean without DATABASE_URL (no-op locally; the real gate in CI
// against the migrated DB). Needs a real Pool (worker + publish own their own
// connect()-scoped transactions) — so it COMMITS to gold and cleans up itself.

import { Pool } from 'pg'
import type { FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Env contract is parsed at import time (env.ts); set required vars BEFORE importing
// any module that reads it. JWT_SECRET is fixed so we can mint a verifiable admin token.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

import {
  DATASETS, EXPECTED_OBS, bootHarness, ensurePreconditions, freshState,
  ingestAndPublish, findDataDir, type E2eHarness,
} from './canonical-ingest.e2e-harness.js'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL && DATABASE_URL !== 'postgres://test' ? describe : describe.skip

dbSuite('E2E — canonical-workbook ingestion → gold → serve (ADR-0031 Wave 5a)', () => {
  let h: E2eHarness
  let pool: Pool
  let app: FastifyInstance

  beforeAll(async () => {
    h = await bootHarness(DATABASE_URL as string)
    pool = h.pool
    app = h.app
    await ensurePreconditions(h)
    await freshState(pool)
  }, 120_000)

  afterAll(async () => {
    if (app) await app.close()
    if (pool) {
      await freshState(pool).catch(() => {}) // leave the shared DB clean (gold COMMITted)
      await pool.end()
    }
  })

  // ── (c) Ingest all 3 through the FULL pipeline to gold ────────────────────────
  it('ingests the 3 canonical workbooks end-to-end to published gold', async () => {
    for (const code of DATASETS) {
      const jobIds = await ingestAndPublish(h, code)
      const kinds = jobIds.map((j) => j.kind)
      // codelists + facts at minimum, IN ORDER (no DISPLAY sheet → no displays job).
      expect(kinds[0]).toBe('codelists')
      expect(kinds[kinds.length - 1]).toBe('facts')

      // THE ORDERING FIX, asserted on the route response itself: the route drove the
      // REFERENCE DATA (codelists/displays) to PUBLISHED gold before submitting facts,
      // and left the FACTS 'staged' for the curator-approval gate. So when the facts
      // validated against the classifiers they were already gold (no UNKNOWN_CODE).
      for (const j of jobIds) {
        if (j.kind === 'facts') {
          expect(j.status, `${code} facts left staged (approval gate)`).toBe('staged')
        } else {
          expect(j.status, `${code} ${j.kind} auto-published by the route`).toBe('published')
        }
      }
    }
  }, 120_000)

  // ── (d) Gold assertions: per-dataset counts + the 3 anchor values ─────────────
  it('gold has the expected per-dataset observation counts', async () => {
    for (const code of DATASETS) {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM stats.observation WHERE dataset_code = $1`, [code],
      )
      expect(Number(rows[0].n), `${code} published obs count`).toBe(EXPECTED_OBS[code])
    }
  })

  it('GDP_ANNUAL 2010 GDP-at-current-prices total ≈ 22148.65 (geo=GE, approach=_Z)', async () => {
    const { rows } = await pool.query<{ obs_value: string }>(
      `SELECT obs_value FROM stats.observation
        WHERE dataset_code = 'GDP_ANNUAL' AND time_period = '2010'
          AND dim_key @> '{"measure":"gross-domestic-product-at-current-prices","approach":"_Z","geo":"GE"}'::jsonb`,
    )
    expect(rows.length).toBe(1)
    expect(Number(rows[0].obs_value)).toBeCloseTo(22148.65, 1)
  })

  it('REGIONAL_GVA geo=_T, sector=_T, 2010 GVA ≈ 21821.57', async () => {
    const { rows } = await pool.query<{ obs_value: string }>(
      `SELECT obs_value FROM stats.observation
        WHERE dataset_code = 'REGIONAL_GVA' AND time_period = '2010'
          AND dim_key @> '{"geo":"_T","sector":"_T","measure":"GVA"}'::jsonb`,
    )
    expect(rows.length).toBe(1)
    expect(Number(rows[0].obs_value)).toBeCloseTo(21821.57, 1)
  })

  it('ACCOUNTS_SEQUENCE has a 2010 row whose account classifier carries BOTH ka + en labels', async () => {
    const { rows: obs } = await pool.query<{ dim_key: Record<string, string> }>(
      `SELECT dim_key FROM stats.observation
        WHERE dataset_code = 'ACCOUNTS_SEQUENCE' AND time_period = '2010'
          AND dim_key @> '{"account":"allocation-of-primary-income-account"}'::jsonb
        LIMIT 1`,
    )
    expect(obs.length, 'a 2010 allocation-of-primary-income-account row exists').toBe(1)

    const { rows: cl } = await pool.query<{ label: Record<string, string> }>(
      `SELECT label FROM stats.classifier
        WHERE dim_code = 'account' AND code = 'allocation-of-primary-income-account'
          AND is_current = true`,
    )
    expect(cl.length).toBe(1)
    expect(cl[0].label.ka, 'ka label present').toBeTruthy()
    expect(cl[0].label.en, 'en label present').toBeTruthy()
    expect(cl[0].label.en).toBe('Allocation of Primary Income Account')
  })

  // ── (e) Serve path: what the geostat front consumes ───────────────────────────
  it('cube-profile serves each dataset: dims, classifiers, timeCoverage', async () => {
    for (const code of DATASETS) {
      const res = await app.inject({ method: 'GET', url: `/api/cube/${code}/profile` })
      expect(res.statusCode, `${code} profile`).toBe(200)
      const { data } = res.json() as {
        data: {
          datasetCode: string
          dimensions: Array<{ code: string; isTime: boolean; members: unknown[] }>
          timeCoverage: { min: string | null; max: string | null; periods: string[] }
        }
      }
      expect(data.datasetCode).toBe(code)

      const byCode = new Map(data.dimensions.map((d) => [d.code, d]))
      expect(byCode.get('time')?.isTime).toBe(true)
      expect(byCode.get('measure')?.members.length, `${code} measure members served`).toBeGreaterThan(0)

      // timeCoverage reflects the published facts (2010 is the floor for all 3).
      expect(data.timeCoverage.periods.length, `${code} timeCoverage periods`).toBeGreaterThan(0)
      expect(data.timeCoverage.periods).toContain('2010')
      expect(data.timeCoverage.min).toBe('2010')
    }
  })

  it('observations endpoint returns the published facts for each dataset', async () => {
    for (const code of DATASETS) {
      const res = await app.inject({ method: 'GET', url: `/api/stats/observations?dataset=${code}&limit=10000` })
      expect(res.statusCode, `${code} observations`).toBe(200)
      const { data } = res.json() as { data: Array<{ time_period: string }> }
      expect(data.length, `${code} served obs count`).toBe(EXPECTED_OBS[code])
    }
  })

  // ── (f) Idempotency (F-2): re-POST one file after publish → 409, no dup gold ───
  it('re-POST of an already-published workbook → 409, gold rows unchanged (F-2)', async () => {
    const code = 'GDP_ANNUAL'
    const before = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM stats.observation WHERE dataset_code = $1`, [code],
    )
    const res = await app.inject({
      method: 'POST', url: '/api/ingest/canonical',
      headers: {
        'content-type': 'application/octet-stream',
        authorization: `Bearer ${h.adminJwt}`,
        'x-filename': `${code}.xlsx`,
      },
      payload: readFileSync(join(findDataDir(), `${code}.xlsx`)),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('ALREADY_PUBLISHED')

    const after = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM stats.observation WHERE dataset_code = $1`, [code],
    )
    expect(after.rows[0].n, 'no duplicate gold rows').toBe(before.rows[0].n)
  })
})
