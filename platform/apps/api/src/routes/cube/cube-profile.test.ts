// ── cube-profile endpoint — integration + fitness (live DB) ───────────────────
//
// GET /api/cube/:datasetCode/profile is the Constructor's introspection bundle
// (ADR-0026). This suite proves two things:
//
//   1. SHAPE (integration, live DB): against a seeded dataset the bundle carries
//      the right dimensions (DSD + concept_role + isTime + members), the right
//      measures (each with its resolved unit + source from V21), and the
//      actualRegion SEAM (null/unavailable today; populated when V26 lands).
//
//   2. FITNESS (source assertion, no DB): the unit DATA-PATH references
//      stats.measure_unit_resolved and NEVER classifier.metadata or obs_attribute.
//      This is the ADR-0026 invariant — the V21 view is the single source of the
//      unit-resolution rule; re-deriving a unit elsewhere would fork that rule.
//
// Harness mirrors upsert.scd2.test.ts / bootstrap-parity.fitness.test.ts: a real
// pg connection per test inside a transaction ROLLED BACK in afterEach, so the
// shared cube is never mutated (FIRST — fast/isolated/repeatable). The whole DB
// suite is describe.skip when DATABASE_URL is absent (no-op locally, real gate in
// CI). The fitness check needs no DB and always runs.

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolClient } from 'pg'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL
const dbSuite = DATABASE_URL ? describe : describe.skip

const here = dirname(fileURLToPath(import.meta.url))

// Codes unlikely to collide with seeded data, scoped inside the rolled-back tx.
const DS = 'CUBEPROF_TEST'
const M_DIM = 'measure'
const G_DIM = 'geo'
const T_DIM = 'time'
const M_CODE = 'CPGDP'
const M_CODE_NOUNIT = 'CPNOUNIT'
const G_CODE = 'CPGE'      // realised geo (has observations) — has-data
const G_CODE2 = 'CPGE2'    // allowed but unrealised geo — empty-by-design
const G_CODE_BAD = 'CPGEX' // not in the allowed geo set — missing
const UNIT = 'CPUNIT'

interface ProfileBundle {
  datasetCode: string
  dimensions: Array<{
    code: string
    conceptRole: string | null
    isTime: boolean
    members: Array<{ code: string; label: Record<string, string>; parentCode: string | null }>
  }>
  measures: Array<{
    code: string
    label: Record<string, string>
    unit: {
      unit_code: string | null
      symbol: string | null
      label: Record<string, string> | null
      unit_type: string | null
      unit_mult: number | null
      decimals: number | null
      base_period: string | null
      source: 'measure' | 'dataset' | 'none'
    }
  }>
  actualRegion: {
    available: boolean
    combinations: Array<{
      dimKey: Record<string, string>
      obsCount: number
      firstTimePeriod: string | null
      lastTimePeriod: string | null
    }> | null
  }
}

interface ClassifyResponse {
  datasetCode: string
  classified: Array<{ dimKey: Record<string, string>; classification: string }>
}

dbSuite('GET /api/cube/:datasetCode/profile — bundle shape (live DB)', () => {
  let pool: Pool
  let client: PoolClient
  let app: FastifyInstance

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL })

    // Boot a minimal app whose app.pg is bound to OUR single client, so every
    // route query runs inside the same rolled-back transaction as the seed. This
    // keeps the integration test fully isolated (the route reads exactly what we
    // seeded; nothing leaks to the shared cube).
    const Fastify = (await import('fastify')).default
    const { cubeRoutes } = await import('./index.js')
    app = Fastify()
    // Decorate app.pg with a thin shim over the per-test client. Only .query is
    // used by the route + loader.
    app.decorate('pg', {
      query: (...args: unknown[]) => (client.query as (...a: unknown[]) => unknown)(...args),
    } as never)
    await app.register(cubeRoutes, { prefix: '/api/cube' })
    await app.ready()
  })

  afterAll(async () => {
    if (app) await app.close()
    await pool.end()
  })

  beforeEach(async () => {
    client = await pool.connect()
    await client.query('BEGIN')

    // ── Seed a 3-axis DSD: measure (with unit), geo, time ──────────────────────
    // Dimensions. concept_role drives the bundle's conceptRole (V18). measure/geo
    // get roles; time's concept_role is set too (the DSD is_time_dim drives isTime).
    await client.query(
      `INSERT INTO stats.dimension (code, label, ord, concept_role) VALUES
         ($1, '{"ka":"მაჩვენებელი","en":"Measure"}'::jsonb, 0, 'measure'),
         ($2, '{"ka":"გეო","en":"Geo"}'::jsonb, 1, 'geo'),
         ($3, '{"ka":"დრო","en":"Time"}'::jsonb, 2, 'time')
       ON CONFLICT (code) DO UPDATE SET concept_role = EXCLUDED.concept_role`,
      [M_DIM, G_DIM, T_DIM],
    )

    // A unit in the V16 codelist (locale-complete label — the trigger enforces it).
    await client.query(
      `INSERT INTO stats.unit_measure (code, label, unit_type, symbol)
         VALUES ($1, '{"ka":"მლნ ლარი","en":"GEL mn"}'::jsonb, 'currency', '₾')
       ON CONFLICT (code) DO NOTHING`,
      [UNIT],
    )

    // Dataset with NO dataset-level unit_code — so resolution is purely per-measure.
    // status='published' so the V28 published-only discovery projection
    // (stats.dataset_published, the cube-profile/classify surface) exposes it — the
    // default 'draft' would 404 from discovery. Insert published directly (the FSM
    // function is exercised by the dataset-lifecycle suite; here we only need the
    // dataset to be discoverable).
    await client.query(
      `INSERT INTO stats.dataset (code, label, frequency, status, valid_from)
         VALUES ($1, '{"ka":"ტესტი","en":"Test"}'::jsonb, 'A', 'published', now())
       ON CONFLICT (code) DO UPDATE SET status = 'published'`,
      [DS],
    )

    // DSD: measure(ord0), geo(ord1), time(is_time_dim, ord2).
    await client.query(
      `INSERT INTO stats.dataset_dimension (dataset_code, dim_code, is_time_dim, ord) VALUES
         ($1, $2, false, 0),
         ($1, $3, false, 1),
         ($1, $4, true,  2)
       ON CONFLICT (dataset_code, dim_code) DO NOTHING`,
      [DS, M_DIM, G_DIM, T_DIM],
    )

    // Measure members: one WITH a per-measure unit (→ source='measure'), one
    // WITHOUT (and the dataset has no default → source='none', the warn case).
    await client.query(
      `INSERT INTO stats.classifier (dim_code, code, label, unit_code) VALUES
         ($1, $2, '{"ka":"მშპ","en":"GDP"}'::jsonb, $4),
         ($1, $3, '{"ka":"უ","en":"NoUnit"}'::jsonb, NULL)
       ON CONFLICT DO NOTHING`,
      [M_DIM, M_CODE, M_CODE_NOUNIT, UNIT],
    )
    // Two geo members: G_CODE is realised, G_CODE2 is allowed-but-unrealised.
    await client.query(
      `INSERT INTO stats.classifier (dim_code, code, label) VALUES
         ($1, $2, '{"ka":"საქართველო","en":"Georgia"}'::jsonb),
         ($1, $3, '{"ka":"აჭარა","en":"Adjara"}'::jsonb)
       ON CONFLICT DO NOTHING`,
      [G_DIM, G_CODE, G_CODE2],
    )
  })

  afterEach(async () => {
    await client.query('ROLLBACK')
    client.release()
  })

  it('404s a dataset that does not exist (fail-fast)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cube/NOPE_NOT_A_DATASET/profile' })
    expect(res.statusCode).toBe(404)
  })

  it('returns dimensions with concept_role, isTime and live members', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/cube/${DS}/profile` })
    expect(res.statusCode).toBe(200)
    const { data } = res.json() as { data: ProfileBundle }

    expect(data.datasetCode).toBe(DS)

    const byCode = new Map(data.dimensions.map((d) => [d.code, d]))

    // measure axis — concept_role from V18, not time.
    const measureDim = byCode.get(M_DIM)
    expect(measureDim?.conceptRole).toBe('measure')
    expect(measureDim?.isTime).toBe(false)
    const measureMemberCodes = measureDim?.members.map((m) => m.code) ?? []
    expect(measureMemberCodes).toContain(M_CODE)
    expect(measureMemberCodes).toContain(M_CODE_NOUNIT)

    // geo axis — role 'geo', has the seeded member with parentCode null.
    const geoDim = byCode.get(G_DIM)
    expect(geoDim?.conceptRole).toBe('geo')
    expect(geoDim?.isTime).toBe(false)
    const geoMember = geoDim?.members.find((m) => m.code === G_CODE)
    expect(geoMember?.parentCode).toBeNull()
    expect(geoMember?.label.en).toBe('Georgia')

    // time axis — isTime from the DSD is_time_dim, regardless of concept_role.
    const timeDim = byCode.get(T_DIM)
    expect(timeDim?.isTime).toBe(true)
  })

  it('returns measures with the unit RESOLVED from V21, including the source tier', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/cube/${DS}/profile` })
    const { data } = res.json() as { data: ProfileBundle }

    const measures = new Map(data.measures.map((m) => [m.code, m]))

    // The measure WITH a per-measure unit → source 'measure', full unit payload.
    const gdp = measures.get(M_CODE)
    expect(gdp, 'GDP measure must be present').toBeDefined()
    expect(gdp!.unit.source).toBe('measure')
    expect(gdp!.unit.unit_code).toBe(UNIT)
    expect(gdp!.unit.symbol).toBe('₾')
    expect(gdp!.unit.unit_type).toBe('currency')
    expect(gdp!.unit.label?.en).toBe('GEL mn')

    // The measure WITHOUT a unit and no dataset default → source 'none' (the
    // Constructor's warn signal), unit_code null.
    const noUnit = measures.get(M_CODE_NOUNIT)
    expect(noUnit, 'no-unit measure must still appear').toBeDefined()
    expect(noUnit!.unit.source).toBe('none')
    expect(noUnit!.unit.unit_code).toBeNull()
  })

  it('exposes actualRegion with enriched combinations (V26 active) or graceful degradation', async () => {
    // Seed two observations for the realised combo {measure:CPGDP, geo:CPGE}. The
    // DSD non-time dims are {measure, geo} (time is is_time_dim), so the dim_key the
    // validate_observation_dim_key trigger requires is exactly those two keys.
    await client.query(
      `INSERT INTO stats.observation (dataset_code, time_period, time_period_date, dim_key, obs_value) VALUES
         ($1, '2020', stats.parse_time_period('2020'), $2::jsonb, 100),
         ($1, '2021', stats.parse_time_period('2021'), $2::jsonb, 110)
       ON CONFLICT DO NOTHING`,
      [DS, JSON.stringify({ measure: M_CODE, geo: G_CODE })],
    )

    const res = await app.inject({ method: 'GET', url: `/api/cube/${DS}/profile` })
    const { data } = res.json() as { data: ProfileBundle }

    expect(typeof data.actualRegion.available).toBe('boolean')
    // V26 ships in this repo, so the DB-gated path exercises the ACTIVE branch.
    expect(data.actualRegion.available).toBe(true)
    const combos = data.actualRegion.combinations
    expect(Array.isArray(combos)).toBe(true)

    const realised = combos!.find(
      (c) => c.dimKey.measure === M_CODE && c.dimKey.geo === G_CODE,
    )
    expect(realised, 'the seeded combo must appear in the actual region').toBeDefined()
    // Density signals come straight from the view's aggregate columns.
    expect(realised!.obsCount).toBe(2)
    expect(realised!.firstTimePeriod).toBe('2020')
    expect(realised!.lastTimePeriod).toBe('2021')
  })

  it('classify route returns the three-way has-data / empty-by-design / missing (V26 SSOT)', async () => {
    // Realised: one observation for {measure:CPGDP, geo:CPGE}.
    await client.query(
      `INSERT INTO stats.observation (dataset_code, time_period, time_period_date, dim_key, obs_value)
         VALUES ($1, '2020', stats.parse_time_period('2020'), $2::jsonb, 100)
       ON CONFLICT DO NOTHING`,
      [DS, JSON.stringify({ measure: M_CODE, geo: G_CODE })],
    )

    // Author an ALLOWED constraint: geo ∈ {CPGE, CPGE2}. CPGEX is therefore OUT of
    // region (missing); CPGE2 is in region but unrealised (empty-by-design); CPGE is
    // realised (has-data). measure is left unconstrained (no unconditional rows).
    const { rows: [cc] } = await client.query<{ id: string }>(
      `INSERT INTO stats.content_constraint (dataset_code, role)
         VALUES ($1, 'allowed') RETURNING id`,
      [DS],
    )
    await client.query(
      `INSERT INTO stats.content_constraint_member (constraint_id, dim_code, code) VALUES
         ($1, $2, $3),
         ($1, $2, $4)`,
      [cc.id, G_DIM, G_CODE, G_CODE2],
    )

    const res = await app.inject({
      method: 'POST',
      url: `/api/cube/${DS}/classify`,
      payload: {
        combinations: [
          { measure: M_CODE, geo: G_CODE },      // realised + allowed → has-data
          { measure: M_CODE, geo: G_CODE2 },     // allowed, unrealised → empty-by-design
          { measure: M_CODE, geo: G_CODE_BAD },  // not in allowed set → missing
        ],
      },
    })
    expect(res.statusCode).toBe(200)
    const { data } = res.json() as { data: ClassifyResponse }

    const byGeo = new Map(data.classified.map((c) => [c.dimKey.geo, c.classification]))
    expect(byGeo.get(G_CODE)).toBe('has-data')
    expect(byGeo.get(G_CODE2)).toBe('empty-by-design')
    expect(byGeo.get(G_CODE_BAD)).toBe('missing')
  })

  it('classify 404s an unknown dataset (fail-fast, same contract as profile)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cube/NOPE_NOT_A_DATASET/classify',
      payload: { combinations: [{ measure: M_CODE, geo: G_CODE }] },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── FITNESS (no DB): the unit data-path uses V21 ONLY ─────────────────────────
//
// ADR-0026 invariant: the per-measure unit is sourced EXCLUSIVELY from
// stats.measure_unit_resolved. The route must NEVER re-derive a unit from
// classifier.metadata or obs_attribute (doing so forks the resolution rule the
// V21 view exists to own). A source-level assertion catches a future edit that
// would reach around the SSOT — exactly what a fitness function guards.
describe('cube-profile fitness — unit path uses V21 only (ADR-0026)', () => {
  it('the route references measure_unit_resolved and NOT classifier.metadata / obs_attribute for units', async () => {
    const source = await readFile(resolve(here, 'index.ts'), 'utf8')

    // The V21 SSOT must be the unit source.
    expect(source).toContain('measure_unit_resolved')

    // Strip comments so the assertion checks the actual CODE/SQL data-path, not the
    // prose explaining the invariant (the comments legitimately name the forbidden
    // sources to document WHY they are forbidden).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/^\s*\/\/.*$/gm, '')        // line comments

    // No unit may be read from classifier.metadata or the obs_attribute bag in the
    // executable data-path. (classifier is still joined — for the measure LABEL —
    // but never its .metadata, and obs_attribute must not appear at all.)
    expect(codeOnly).not.toMatch(/metadata\s*->/)
    expect(codeOnly).not.toContain('obs_attribute')
  })
})
