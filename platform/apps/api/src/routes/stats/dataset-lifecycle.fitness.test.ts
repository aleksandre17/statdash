// ── Fitness function — Dataset lifecycle FSM (V28, ADR SDMX-P1-B, live DB) ─────
//
// THE INVARIANTS this locks:
//
//   1. PUBLISHED-ONLY PROJECTION HOLDS — stats.dataset_published never exposes a
//      draft or superseded dataset (only published/deprecated). This is the delivery
//      SSOT the bootstrap / cube-profile / observations surfaces filter through.
//
//   2. SUPERSEDE DELETES ZERO OBSERVATIONS — a draft→published→superseded transition
//      changes the count of stats.observation rows for the dataset by EXACTLY zero.
//      Lifecycle is a projection filter, never a data operation (data outlives code;
//      auditability is non-negotiable).
//
//   3. A SUPERSEDED DATASET'S DATA STILL RESOLVES — after supersession, the dataset's
//      observations remain directly readable (the permalink/asOf auditability path).
//
//   4. ILLEGAL STATE UNREPRESENTABLE — dataset_superseded_chk forbids status=
//      'superseded' without replaced_by (and vice versa); the FSM rejects illegal
//      transitions (fail fast).
//
// Harness mirrors content-constraint.fitness.test.ts: pg Pool + DATABASE_URL,
// skipped offline, every test in a txn ROLLED BACK in afterEach.

import { Pool, type PoolClient } from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

suite('Dataset lifecycle FSM (V28) — fitness', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(() => { pool = new Pool({ connectionString: DATABASE_URL }) })
  afterAll(async () => { await pool.end() })
  beforeEach(async () => { client = await pool.connect(); await client.query('BEGIN') })
  afterEach(async () => { await client.query('ROLLBACK'); client.release() })

  // ── 1. Published-only projection: no draft/superseded ever surfaces ───────────
  it('stats.dataset_published exposes only published/deprecated datasets', async () => {
    const { rows } = await client.query<{ code: string; status: string }>(
      `SELECT code, status FROM stats.dataset_published
        WHERE status NOT IN ('published', 'deprecated')`,
    )
    expect(rows, `non-deliverable datasets leaked into the projection: ${JSON.stringify(rows)}`)
      .toEqual([])
  })

  // ── 2 + 3. Supersede deletes zero observations; data still resolves ───────────
  it('a supersede transition deletes zero observations and the data still resolves', async () => {
    const ds = `__FIT_LC_${Date.now()}`
    const successor = `__FIT_LC_NEXT_${Date.now()}`

    // Minimal datasets + a single observation. The observation needs a dim_key the
    // V4 trigger accepts; use a minimal time-only DSD so the fixture is self-contained.
    await client.query(
      `INSERT INTO stats.dataset (code, label) VALUES ($1, '{"en":"fixture"}'), ($2, '{"en":"next"}')`,
      [ds, successor])
    await client.query(
      `INSERT INTO stats.dimension (code, label) VALUES ('time', '{"en":"t"}')
       ON CONFLICT (code) DO NOTHING`)
    await client.query(
      `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim)
       VALUES ($1, 'time', true)`, [ds])
    await client.query(
      `INSERT INTO stats.classifier (dim_code, code, label)
       VALUES ('time', '2020', '{"en":"2020"}') ON CONFLICT DO NOTHING`)
    await client.query(
      `INSERT INTO stats.observation (dataset_code, time_period, time_period_date, dim_key, obs_value)
       VALUES ($1, '2020', stats.parse_time_period('2020'), '{"time":"2020"}'::jsonb, 1.0)`, [ds])

    const countObs = async (): Promise<number> => {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM stats.observation WHERE dataset_code = $1`, [ds])
      return Number(rows[0].n)
    }
    const before = await countObs()
    expect(before, 'fixture seeded one observation').toBe(1)

    // draft → published → superseded(replaced_by=successor), via the FSM function.
    await client.query(`SELECT stats.set_dataset_status($1, 'published')`, [ds])
    await client.query(`SELECT stats.set_dataset_status($2, 'published')`, [ds, successor])
    await client.query(`SELECT stats.set_dataset_status($1, 'superseded', $2)`, [ds, successor])

    // 2. Zero observations deleted.
    const after = await countObs()
    expect(after, 'supersede must delete NO observations (data outlives code)').toBe(before)

    // 3. The data still resolves by direct read (the permalink/asOf auditability path).
    const { rows: data } = await client.query(
      `SELECT obs_value FROM stats.observation WHERE dataset_code = $1`, [ds])
    expect(data.length, 'superseded dataset data still readable').toBe(1)

    // …and the dataset is now ABSENT from the published-only discovery projection.
    const { rows: disc } = await client.query(
      `SELECT code FROM stats.dataset_published WHERE code = $1`, [ds])
    expect(disc.length, 'superseded dataset is hidden from discovery').toBe(0)
  })

  // ── 4. Illegal state unrepresentable + FSM rejects illegal transitions ────────
  it('superseded requires replaced_by (constraint) and FSM rejects illegal transitions', async () => {
    const ds = `__FIT_LC_CHK_${Date.now()}`
    await client.query(
      `INSERT INTO stats.dataset (code, label) VALUES ($1, '{"en":"fixture"}')`, [ds])

    // The CHECK: status='superseded' with NULL replaced_by is unrepresentable.
    await expect(
      client.query(`UPDATE stats.dataset SET status = 'superseded' WHERE code = $1`, [ds]),
    ).rejects.toThrow(/dataset_superseded_chk|superseded/i)

    // The FSM: draft → deprecated is illegal (must publish first). Use a savepoint so
    // the rejected statement does not poison the surrounding txn.
    await client.query('SAVEPOINT s1')
    await expect(
      client.query(`SELECT stats.set_dataset_status($1, 'deprecated')`, [ds]),
    ).rejects.toThrow(/illegal transition/i)
    await client.query('ROLLBACK TO SAVEPOINT s1')

    // The FSM: supersede without replaced_by is rejected with a clear message.
    await client.query(`SELECT stats.set_dataset_status($1, 'published')`, [ds])
    await client.query('SAVEPOINT s2')
    await expect(
      client.query(`SELECT stats.set_dataset_status($1, 'superseded')`, [ds]),
    ).rejects.toThrow(/requires p_replaced_by/i)
    await client.query('ROLLBACK TO SAVEPOINT s2')
  })
})
