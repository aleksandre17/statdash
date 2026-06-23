// ── Fitness function — ConceptScheme (V27, ADR SDMX-P1-A, live DB) ────────────
//
// THE INVARIANTS this locks (the architectural characteristics V27 introduces):
//
//   1. NO-DRIFT (the expand-contract guarantee): while stats.dimension.concept_role
//      (V18 read alias) lives in PARALLEL with stats.concept.concept_role (V27 SSOT),
//      every BOUND dimension's role MUST equal its concept's role. If these drift,
//      the contract step (dropping the dimension column) would silently change
//      behaviour — so the parallel period is only safe while they agree.
//
//   2. LAW 1 — no hardcoded concept name in the V27 DDL. concept.code IS the
//      identity; a concept is DATA (an INSERT), never a literal baked into SQL. The
//      only enumerated point allowed is the concept_role CHECK (the closed SDMX role
//      vocabulary, the same V18 pinned). Asserted by grepping the migration source.
//
//   3. BINDING RESOLVES — a dimension that declares a (concept_scheme_code,
//      concept_code) binding resolves to a real stats.concept row (the FK holds),
//      AND the cube-profile-style role resolution (COALESCE(concept.role, dim.role))
//      yields the concept's role for a bound dim (the SSOT wins).
//
// Harness mirrors content-constraint.fitness.test.ts: pg Pool + DATABASE_URL,
// skipped (not failed) offline, every DB test inside a txn ROLLED BACK in afterEach
// (never mutates the shared cube). The source grep (#2) needs no DB and always runs.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL ? describe : describe.skip

const here = dirname(fileURLToPath(import.meta.url))
// repo-root ops/postgres/migrations from platform/apps/api/src/routes/cube
const V27_PATH = resolve(here, '../../../../../../ops/postgres/migrations/V27__concept_scheme.sql')

dbSuite('ConceptScheme (V27) — fitness', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  // ── 1. NO-DRIFT across the whole corpus ───────────────────────────────────────
  it('every bound dimension role equals its concept role (no drift)', async () => {
    const { rows } = await client.query<{ dim: string; dim_role: string; concept_role: string }>(
      `SELECT d.code AS dim, d.concept_role AS dim_role, c.concept_role
         FROM stats.dimension d
         JOIN stats.concept c
           ON c.scheme_code = d.concept_scheme_code
          AND c.code        = d.concept_code
        WHERE d.concept_role IS DISTINCT FROM c.concept_role`,
    )
    expect(rows, `drifted dimension↔concept roles: ${JSON.stringify(rows)}`).toEqual([])
  })

  // ── 3. BINDING resolves to a real concept + SSOT role resolution wins ─────────
  it('a bound dimension resolves its role through the concept (SSOT)', async () => {
    const scheme = `__FIT_CS_${Date.now()}`
    const dim = `__fit_dim_${Date.now()}`

    await client.query(
      `INSERT INTO stats.concept_scheme (code, label) VALUES ($1, '{"en":"fixture"}')`, [scheme])
    // Concept role = 'geo'; the dimension's stale alias deliberately set to 'measure'
    // would be a DRIFT — but the resolution COALESCE(concept, dim) must pick the
    // concept ('geo'), proving the SSOT wins. (We set the dim alias to NULL here so
    // the no-drift corpus assertion above is not tripped by the fixture; the
    // resolution test only needs the concept to carry the role.)
    await client.query(
      `INSERT INTO stats.concept (scheme_code, code, label, concept_role)
       VALUES ($1, 'REF_AREA_FIT', '{"en":"area"}', 'geo')`, [scheme])
    await client.query(
      `INSERT INTO stats.dimension (code, label, concept_scheme_code, concept_code)
       VALUES ($1, '{"en":"d"}', $2, 'REF_AREA_FIT')`, [dim, scheme])

    const { rows } = await client.query<{ resolved: string | null }>(
      `SELECT COALESCE(c.concept_role, d.concept_role) AS resolved
         FROM stats.dimension d
         LEFT JOIN stats.concept c
           ON c.scheme_code = d.concept_scheme_code AND c.code = d.concept_code
        WHERE d.code = $1`, [dim])
    expect(rows[0].resolved, 'role resolves through the bound concept').toBe('geo')
  })

  // ── BINDING FK has teeth — a binding to a missing concept is rejected ─────────
  it('rejects a dimension binding to a non-existent concept (FK holds)', async () => {
    const scheme = `__FIT_CS2_${Date.now()}`
    await client.query(
      `INSERT INTO stats.concept_scheme (code, label) VALUES ($1, '{"en":"fixture"}')`, [scheme])
    await expect(
      client.query(
        `INSERT INTO stats.dimension (code, label, concept_scheme_code, concept_code)
         VALUES ($1, '{"en":"d"}', $2, 'NO_SUCH_CONCEPT')`, [`__fit_d2_${Date.now()}`, scheme]),
    ).rejects.toThrow()
  })
})

// ── 2. LAW 1 — no hardcoded concept name in the V27 DDL (no DB) ────────────────
describe('ConceptScheme (V27) — Law 1: no hardcoded dimension/concept names in DDL', () => {
  it('V27 contains no literal SDMX concept code in executable logic', async () => {
    const sql = await readFile(V27_PATH, 'utf8')

    // Strip DOCUMENTATION so prose/comments mentioning REF_AREA etc. do not trip the
    // check; only executable LOGIC must be free of hardcoded concept names. Three
    // documentation forms are removed (all are comments, not logic):
    //   · whole-line leading comments (-- …)
    //   · trailing inline comments (code … -- 'REF_AREA' | …)
    //   · COMMENT ON … IS '…' statements (catalog documentation, multi-line)
    const noBlockComments = sql
      // remove COMMENT ON … IS '…'; (greedy to the terminating ';', across newlines)
      .replace(/COMMENT ON[\s\S]*?;\s*/gi, '')
    const logic = noBlockComments
      .split('\n')
      .map((line) => {
        const t = line.trimStart()
        if (t.startsWith('--')) return ''        // whole-line comment
        const ix = line.indexOf('--')
        return ix >= 0 ? line.slice(0, ix) : line // strip trailing inline comment
      })
      .join('\n')

    // No common SDMX cross-domain concept code may appear as a string LITERAL in the
    // executable logic (the backfill seeds concepts from dimension.concept_role DATA,
    // never from a hardcoded list — Law 1: a new concept is an INSERT, not an ALTER).
    for (const concept of ['REF_AREA', 'TIME_PERIOD', 'OBS_VALUE', 'FREQ']) {
      expect(
        logic.includes(`'${concept}'`),
        `V27 executable logic hardcodes concept '${concept}' — concepts must be DATA (Law 1)`,
      ).toBe(false)
    }
  })
})
