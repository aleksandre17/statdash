// ── Fitness function — AgencyScheme (V38, DB-08, live DB) ─────────────────────
//
// THE INVARIANTS this locks (the architectural characteristics V38 introduces):
//
//   1. CODE UNIQUE — stats.agency.code is the SDMX agencyID business identity; the
//      UNIQUE constraint has teeth (a duplicate code is rejected). And every existing
//      agency.code is distinct across the corpus.
//
//   2. RE-POINT FK VALIDITY + BACKFILL COMPLETENESS — every row of the three
//      re-pointed carriers (stats.concept_scheme, stats.metadataflow, stats.dataset)
//      has a NON-NULL agency_id that resolves to a real stats.agency row. The GEOSTAT
//      fallback guarantees no unbound row after the V38 backfill.
//
//   3. i18n NAME COMPLETENESS — stats.agency.name honors the V13/V14 locale contract:
//      an incomplete name (missing an active locale) is REJECTED by
//      config.enforce_locale_string('name'); every existing name is locale-complete.
//
//   4. EXPAND-ONLY / NO-MT POSTURE (source grep, no DB) — V38 is a pure identity
//      EXPAND: it does NOT drop the free-text columns, does NOT set the FK NOT NULL,
//      and builds NO multi-tenancy (no RLS FORCE, no tenant GUC, no tenant_id). The
//      CONTRACT + MT are deferred doors; this test fails CI if V38 opens either.
//
// Harness mirrors concept-scheme.fitness.test.ts: pg Pool + DATABASE_URL, skipped (not
// failed) offline, every DB mutation inside a txn ROLLED BACK in afterEach (never
// mutates the shared cube). The source grep (#4) needs no DB and always runs.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL ? describe : describe.skip

const here = dirname(fileURLToPath(import.meta.url))
// repo-root ops/postgres/migrations from platform/apps/api/src/routes/stats
const V38_PATH = resolve(here, '../../../../../../ops/postgres/migrations/V38__agency_scheme.sql')

dbSuite('AgencyScheme (V38) — fitness', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  // ── 1. CODE UNIQUE ─────────────────────────────────────────────────────────────
  it('agency.code is unique across the corpus', async () => {
    const { rows } = await client.query<{ code: string; n: string }>(
      `SELECT code, COUNT(*)::text AS n FROM stats.agency GROUP BY code HAVING COUNT(*) > 1`,
    )
    expect(rows, `duplicate agency codes: ${JSON.stringify(rows)}`).toEqual([])
  })

  it('rejects a duplicate agency code (UNIQUE has teeth)', async () => {
    // A complete name gets past the completeness trigger so the UNIQUE check is what bites.
    await expect(
      client.query(
        `INSERT INTO stats.agency (scheme_code, code, name)
         VALUES ('AGENCIES', 'GEOSTAT', '{"ka":"დ","en":"d"}')`,
      ),
    ).rejects.toThrow()
  })

  // ── 2. RE-POINT FK VALIDITY + BACKFILL COMPLETENESS ─────────────────────────────
  it('every re-pointed row has a non-null agency_id resolving to a real agency', async () => {
    const { rows } = await client.query<{ carrier: string; unbound: string; dangling: string }>(
      `SELECT 'concept_scheme' AS carrier,
              COUNT(*) FILTER (WHERE cs.agency_id IS NULL)::text AS unbound,
              COUNT(*) FILTER (WHERE cs.agency_id IS NOT NULL AND a.id IS NULL)::text AS dangling
         FROM stats.concept_scheme cs LEFT JOIN stats.agency a ON a.id = cs.agency_id
       UNION ALL
       SELECT 'metadataflow',
              COUNT(*) FILTER (WHERE mf.agency_id IS NULL)::text,
              COUNT(*) FILTER (WHERE mf.agency_id IS NOT NULL AND a.id IS NULL)::text
         FROM stats.metadataflow mf LEFT JOIN stats.agency a ON a.id = mf.agency_id
       UNION ALL
       SELECT 'dataset',
              COUNT(*) FILTER (WHERE d.agency_id IS NULL)::text,
              COUNT(*) FILTER (WHERE d.agency_id IS NOT NULL AND a.id IS NULL)::text
         FROM stats.dataset d LEFT JOIN stats.agency a ON a.id = d.agency_id`,
    )
    for (const r of rows) {
      expect(r.unbound, `${r.carrier} has ${r.unbound} rows with NULL agency_id (backfill incomplete)`).toBe('0')
      expect(r.dangling, `${r.carrier} has ${r.dangling} rows whose agency_id resolves to no agency`).toBe('0')
    }
  })

  it('rejects a re-point to a non-existent agency (FK holds)', async () => {
    await expect(
      client.query(
        `UPDATE stats.dataset SET agency_id = '00000000-0000-0000-0000-000000000000'::uuid
          WHERE code = (SELECT code FROM stats.dataset LIMIT 1)`,
      ),
    ).rejects.toThrow()
  })

  // ── 3. i18n NAME COMPLETENESS ───────────────────────────────────────────────────
  it('rejects an incomplete agency name (missing an active locale)', async () => {
    await expect(
      client.query(
        `INSERT INTO stats.agency (scheme_code, code, name)
         VALUES ('AGENCIES', $1, '{"en":"only english"}')`,
        [`__FIT_AG_${Date.now()}`],
      ),
    ).rejects.toThrow(/locale_string_invalid/i)
  })

  it('every existing agency name is locale-complete', async () => {
    const { rows } = await client.query<{ code: string }>(
      `SELECT code FROM stats.agency WHERE NOT config.validate_locale_string(name)`,
    )
    expect(rows, `agencies with incomplete names: ${JSON.stringify(rows)}`).toEqual([])
  })

  it('rejects an agency that is its own parent (self-cycle CHECK)', async () => {
    const code = `__FIT_AG2_${Date.now()}`
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO stats.agency (scheme_code, code, name)
       VALUES ('AGENCIES', $1, '{"ka":"დ","en":"d"}') RETURNING id`, [code])
    await expect(
      client.query(`UPDATE stats.agency SET parent_id = id WHERE id = $1`, [rows[0].id]),
    ).rejects.toThrow()
  })
})

// ── 4. EXPAND-ONLY / NO-MT POSTURE — source grep (no DB, always runs) ────────────
describe('AgencyScheme (V38) — EXPAND-only + no multi-tenancy (DDL posture)', () => {
  it('V38 does not open the CONTRACT door or build multi-tenancy', async () => {
    const sql = (await readFile(V38_PATH, 'utf8'))
      // strip block COMMENT ON … IS '…'; (terminate at the CLOSING quote-semicolon so a
      // ';' inside the comment body — e.g. "Nullable; CONTRACT deferred." — is included in
      // the stripped span, not treated as the statement end) and the header prose, so the
      // guard sees only executable LOGIC (documentation MAY mention tenant_id / the V6 seam).
      .replace(/COMMENT ON[\s\S]*?';/gi, '')
      .split('\n')
      .map((line) => {
        const t = line.trimStart()
        if (t.startsWith('--')) return ''
        const ix = line.indexOf('--')
        return ix >= 0 ? line.slice(0, ix) : line
      })
      .join('\n')
      .toUpperCase()

    // CONTRACT is deferred — the free-text carriers must NOT be dropped, and the FK
    // columns must NOT be made NOT NULL, by this migration.
    expect(sql.includes('DROP COLUMN'), 'V38 must not drop any column (CONTRACT is a later door)').toBe(false)
    expect(/ALTER COLUMN\s+AGENCY_ID\s+SET NOT NULL/.test(sql), 'V38 must not NOT-NULL agency_id (CONTRACT deferred)').toBe(false)

    // Multi-tenancy is deferred — V38 builds none of its machinery.
    for (const mt of ['FORCE ROW LEVEL SECURITY', 'CURRENT_SETTING', 'APP.CURRENT_TENANT', 'TENANT_ID']) {
      expect(sql.includes(mt), `V38 must not build multi-tenancy (found "${mt}")`).toBe(false)
    }
  })
})
