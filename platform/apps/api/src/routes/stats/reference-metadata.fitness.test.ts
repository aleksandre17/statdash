// ── Reference metadata (V31, ADR SDMX-P1-D) — round-trip + fitness (live DB) ───
//
// THE INVARIANTS this locks:
//
//   1. ROUND-TRIP (store → serve) WITH i18n INTACT — a report written to
//      stats.reference_metadata is served by GET /api/stats/datasets/:code/metadata
//      with every LocaleString carrying BOTH active locales (ka+en). This is the
//      load-bearing contract: the Law-9 badges render structured metadata, and the
//      runner resolves each LocaleString per the active locale, so a dropped locale
//      on the wire blanks a badge in that language (the V13/V14 failure mode).
//
//   2. OPTIONAL-LOCALE COMPLETENESS HAS TEETH — a PROVIDED-but-half-translated
//      content field is REJECTED at write (config.enforce_locale_string_optional),
//      while an OMITTED field ('{}') is allowed. Optionality must not become a hole
//      through which incomplete i18n enters.
//
//   3. SCD-2 CURRENT UNIQUENESS — at most one is_current dataset report per dataset
//      (uq_reference_metadata_current_dataset); a revision close-old/insert-new keeps
//      the history and the serve read returns the CURRENT vintage only.
//
//   4. TARGET CHECK — reference_metadata_target_chk makes a target_type ⇄
//      target-column mismatch unrepresentable (Law 1 / make-illegal-states-...).
//
//   5. DISCOVERY GATE — a draft/superseded dataset's metadata 404s from the serve
//      endpoint (the V28 published-only projection), exactly as cube-profile.
//
// Harness mirrors cube-profile.test.ts: a real pg client per test inside a txn ROLLED
// BACK in afterEach (FIRST — isolated/repeatable), the route's app.pg bound to that
// client so the serve read runs in the same rolled-back tx. Whole suite describe.skip
// without DATABASE_URL (no-op locally, real gate in CI).

import { Pool, type PoolClient } from 'pg'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ReferenceMetadataContract } from '@statdash/contracts'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL ? describe : describe.skip

const DS = 'REFMETA_TEST'

dbSuite('GET /api/stats/datasets/:code/metadata — reference metadata (live DB)', () => {
  let pool: Pool
  let client: PoolClient
  let app: FastifyInstance

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })

    // Boot a minimal app whose app.pg is bound to OUR single per-test client, so the
    // serve read runs inside the same rolled-back transaction as the seed.
    const Fastify = (await import('fastify')).default
    const { datasetsRoutes } = await import('./datasets.js')
    app = Fastify()
    app.decorate('pg', {
      query: (...args: unknown[]) => (client.query as (...a: unknown[]) => unknown)(...args),
    } as never)
    await app.register(datasetsRoutes, { prefix: '/api/stats/datasets' })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await pool.end()
  })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN')

    // A PUBLISHED dataset (so the discovery gate exposes it; default 'draft' would
    // 404). Label is locale-complete (the V14 trigger enforces it on stats.dataset).
    await client.query(
      `INSERT INTO stats.dataset (code, label, frequency, status, valid_from)
         VALUES ($1, '{"ka":"ტესტი","en":"Test"}'::jsonb, 'A', 'published', now())
       ON CONFLICT (code) DO UPDATE SET status = 'published'`,
      [DS],
    )
    // The default ESMS_LITE metadataflow is seeded by V31; assert-by-upsert so the
    // test is self-contained even on a DB where the seed row was rolled back.
    await client.query(
      `INSERT INTO stats.metadataflow (code, label)
         VALUES ('ESMS_LITE', '{"ka":"ნაკადი","en":"flow"}'::jsonb)
       ON CONFLICT (code) DO NOTHING`,
    )
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  async function serve(code: string): Promise<{ status: number; body: { data: ReferenceMetadataContract } }> {
    const res = await app.inject({ method: 'GET', url: `/api/stats/datasets/${code}/metadata` })
    return { status: res.statusCode, body: res.json() }
  }

  // ── 1. Round-trip store → serve with i18n intact ──────────────────────────────
  it('serves a stored report with every LocaleString carrying both active locales', async () => {
    await client.query(
      `INSERT INTO stats.reference_metadata
         (metadataflow_code, target_type, dataset_code,
          methodology, source, coverage, quality, note,
          last_updated, contact_name, contact_email, methodology_url)
       VALUES ('ESMS_LITE', 'dataset', $1,
          '{"ka":"მეთოდი","en":"Methodology"}'::jsonb,
          '{"ka":"წყარო","en":"Geostat"}'::jsonb,
          '{"ka":"მოცვა","en":"Coverage"}'::jsonb,
          '{"ka":"ხარისხი","en":"Quality"}'::jsonb,
          '{"ka":"შენიშვნა","en":"Note"}'::jsonb,
          '2024-09-15', 'NA Division', 'info@geostat.ge', 'https://geostat.ge/gdp')`,
      [DS],
    )

    const { status, body } = await serve(DS)
    expect(status).toBe(200)
    const rm = body.data
    expect(rm.datasetCode).toBe(DS)
    expect(rm.metadataflow).toBe('ESMS_LITE')
    // i18n intact — BOTH locales survive the wire on every content field.
    for (const field of ['methodology', 'source', 'coverage', 'quality', 'note'] as const) {
      expect(rm[field], `${field} present`).toBeDefined()
      expect(rm[field], `${field} has ka`).toHaveProperty('ka')
      expect(rm[field], `${field} has en`).toHaveProperty('en')
    }
    expect(rm.source?.en).toBe('Geostat')
    // Non-locale provenance round-trips (the badge date + contact + methodology link).
    expect(rm.lastUpdated).toBe('2024-09-15')
    expect(rm.contactName).toBe('NA Division')
    expect(rm.contactEmail).toBe('info@geostat.ge')
    expect(rm.methodologyUrl).toBe('https://geostat.ge/gdp')
    expect(rm.revision).toBe(1)
    expect(typeof rm.validFrom).toBe('string')
  })

  // ── 1b. Omitted optional field becomes an ABSENT wire key (not '{}') ───────────
  it('omits an unset optional content field from the wire shape', async () => {
    // Only `source` provided; the rest default '{}' (omitted).
    await client.query(
      `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source)
       VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"წყარო","en":"Source"}'::jsonb)`,
      [DS],
    )
    const { status, body } = await serve(DS)
    expect(status).toBe(200)
    expect(body.data.source).toBeDefined()
    // An omitted '{}' field is ABSENT on the wire (Postel) — the badge slot is empty.
    expect(body.data.methodology).toBeUndefined()
    expect(body.data.coverage).toBeUndefined()
  })

  // ── 2. Optional-locale completeness has teeth ─────────────────────────────────
  it('rejects a PROVIDED-but-half-translated content field at write', async () => {
    await expect(
      client.query(
        `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, methodology)
         VALUES ('ESMS_LITE', 'dataset', $1, '{"en":"only english"}'::jsonb)`,
        [DS],
      ),
    ).rejects.toThrow(/locale_string_invalid|locale/i)
  })

  it('allows an OMITTED optional content field (empty {} passes the optional guard)', async () => {
    // A report with NO content fields at all (all default '{}') must be insertable —
    // optionality is real. last_updated alone is a valid minimal report.
    await expect(
      client.query(
        `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, last_updated)
         VALUES ('ESMS_LITE', 'dataset', $1, '2024-01-01')`,
        [DS],
      ),
    ).resolves.toBeDefined()
  })

  // ── 3. SCD-2 current uniqueness ───────────────────────────────────────────────
  it('permits at most one is_current dataset report (partial unique index)', async () => {
    await client.query(
      `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source)
       VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"ა","en":"a"}'::jsonb)`,
      [DS],
    )
    // A SECOND current report for the same dataset violates the partial unique index.
    await expect(
      client.query(
        `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source)
         VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"ბ","en":"b"}'::jsonb)`,
        [DS],
      ),
    ).rejects.toThrow()
  })

  it('serves the CURRENT vintage after a revision (close-old / insert-new)', async () => {
    // v1 — then close it and insert v2 as current (the SCD-2 revise path).
    await client.query(
      `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source, last_updated)
       VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"ძველი","en":"old"}'::jsonb, '2023-01-01')`,
      [DS],
    )
    await client.query(
      `UPDATE stats.reference_metadata SET is_current = false, valid_to = now()
        WHERE dataset_code = $1 AND target_type = 'dataset' AND is_current`,
      [DS],
    )
    await client.query(
      `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source, last_updated, revision)
       VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"ახალი","en":"new"}'::jsonb, '2024-01-01', 2)`,
      [DS],
    )
    const { status, body } = await serve(DS)
    expect(status).toBe(200)
    expect(body.data.source?.en).toBe('new')
    expect(body.data.lastUpdated).toBe('2024-01-01')
    expect(body.data.revision).toBe(2)
  })

  // ── 4. Target CHECK — illegal target_type/column combos rejected ──────────────
  it('rejects a dataset-typed report with no dataset_code (target CHECK)', async () => {
    await expect(
      client.query(
        `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code)
         VALUES ('ESMS_LITE', 'dataset', NULL)`,
      ),
    ).rejects.toThrow(/reference_metadata_target_chk|violates check/i)
  })

  // ── 5. Discovery gate — a draft dataset's metadata 404s ───────────────────────
  it('404s the metadata of a non-published (draft) dataset', async () => {
    const draft = 'REFMETA_DRAFT'
    await client.query(
      `INSERT INTO stats.dataset (code, label) VALUES ($1, '{"ka":"მონახაზი","en":"draft"}'::jsonb)
       ON CONFLICT (code) DO NOTHING`,
      [draft],
    )
    await client.query(
      `INSERT INTO stats.reference_metadata (metadataflow_code, target_type, dataset_code, source)
       VALUES ('ESMS_LITE', 'dataset', $1, '{"ka":"ა","en":"a"}'::jsonb)`,
      [draft],
    )
    const { status } = await serve(draft)
    expect(status).toBe(404)
  })

  // ── 5b. A published dataset with NO report 404s the report (not a 500) ────────
  it('404s when a published dataset has no reference-metadata report', async () => {
    const { status } = await serve(DS) // dataset exists + published, but no rm row
    expect(status).toBe(404)
  })
})
