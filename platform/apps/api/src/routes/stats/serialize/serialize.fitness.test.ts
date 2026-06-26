// ── Fitness function — the serializer port (ADR-0031 §3/§6, Wave 4a) ──────────────
//
// THE INVARIANTS this locks (F-SERIALIZE):
//
//   1. BYTE-IDENTICAL DEFAULT — with NO `?format=` and with `?format=json`, the wire
//      payload of GET /observations and GET /datasets is BYTE-FOR-BYTE what the route
//      produced BEFORE the serializer port existed (the `{ data }` envelope from
//      lib/http `ok`, serialized by Fastify's default JSON path). This is the
//      expand-contract anchor: zero regression for the current consumers (the geostat
//      front + panel). We assert the raw `res.payload` string equals `JSON.stringify(ok(rows))`.
//
//   2. THE PORT DISPATCHES — an UNREGISTERED `?format=sdmx-csv` (a reserved-but-not-
//      yet-built format) returns the documented 400 RFC-9457 Problem, proving the
//      `?format=` slot is wired through the registry rather than ignored. The day a
//      `sdmx-csv` serializer is registered, the SAME request returns CSV — additively.
//
//   3. REGISTRY IS OCP — only `json` is registered today; the six reserved formats
//      resolve to `undefined` (getSerializer) until registered. No code path special-
//      cases a format name; a new format = one registration.
//
// Harness: NO database. The routes' only dependency is `app.pg.query`, so we inject a
// stub pg returning fixed rows and boot the real route plugins behind the REAL
// production error handler (registerProblemErrorHandler) — so the 400 is the exact
// RFC-9457 envelope production emits (no drift). Always runs (no DATABASE_URL gate):
// this is a pure serialization-contract test.

import Fastify, { type FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ok } from '../../../lib/http.js'
import { registerProblemErrorHandler } from '../../../lib/error-handler.js'
import { getSerializer, hasSerializer } from './registry.js'

// Representative result rows — the exact shape the routes SELECT (observation rows:
// time_period + dim_key + obs_value + obs_status + obs_attribute; dataset rows: the
// descriptor + aggregated dimensions). Includes nulls + nested objects + a Georgian
// label so the byte comparison exercises real serialization (unicode, null, nesting).
const OBS_ROWS = [
  {
    time_period: '2010',
    dim_key: { geo: 'GE', measure: 'GDP' },
    obs_value: 21821.57,
    obs_status: 'A',
    obs_attribute: { seq_pos: 1 },
  },
  {
    time_period: '2011',
    dim_key: { geo: 'GE', measure: 'GDP' },
    obs_value: null,
    obs_status: 'P',
    obs_attribute: {},
  },
]

const DATASET_ROWS = [
  {
    code: 'GDP_ANNUAL',
    label: { ka: 'მთლიანი შიდა პროდუქტი', en: 'GDP' },
    frequency: 'A',
    source: 'GeoStat',
    metadata: null,
    dimensions: [
      { dim_code: 'time', is_time_dim: true, ord: 0 },
      { dim_code: 'geo', is_time_dim: false, ord: 1 },
    ],
  },
]

// A pg stub: every route in this suite issues ONE primary SELECT whose rows we control.
// observations' GET also probes stats.dataset_version (ETag) and the discovery gate;
// datasets' GET / issues only the list SELECT. We answer each by a cheap SQL sniff so
// the route logic runs unchanged and the SERIALIZED rows are deterministic.
function stubPg(rows: unknown[]) {
  return {
    query: (sql: string) => {
      // The lifecycle discovery gate (isDatasetDiscoverable) probes the published
      // projection / existence — answer "discoverable" so the read proceeds.
      if (/dataset_published|information_schema|to_regclass|pg_class/i.test(sql)) {
        return Promise.resolve({ rows: [{ exists: true, status: 'published' }] })
      }
      // The ETag version probe — return NO version row so the route skips the ETag
      // path entirely (keeps the byte comparison about the BODY, not headers).
      if (/dataset_version/i.test(sql)) {
        return Promise.resolve({ rows: [] })
      }
      // The primary observation/dataset SELECT — the rows under test.
      return Promise.resolve({ rows })
    },
  }
}

async function bootObservations(rows: unknown[]): Promise<FastifyInstance> {
  const app = Fastify()
  registerProblemErrorHandler(app)
  app.decorate('pg', stubPg(rows) as never)
  const { observationsRoutes } = await import('../observations.js')
  await app.register(observationsRoutes, { prefix: '/api/stats/observations' })
  await app.ready()
  return app
}

async function bootDatasets(rows: unknown[]): Promise<FastifyInstance> {
  const app = Fastify()
  registerProblemErrorHandler(app)
  app.decorate('pg', stubPg(rows) as never)
  const { datasetsRoutes } = await import('../datasets.js')
  await app.register(datasetsRoutes, { prefix: '/api/stats/datasets' })
  await app.ready()
  return app
}

describe('Serializer port — F-SERIALIZE (byte-identical default + dispatch)', () => {
  let obsApp: FastifyInstance
  let dsApp: FastifyInstance

  beforeAll(async () => {
    obsApp = await bootObservations(OBS_ROWS)
    dsApp = await bootDatasets(DATASET_ROWS)
  })
  afterAll(async () => {
    await obsApp.close()
    await dsApp.close()
  })

  // ── 3. Registry is OCP: only `json` registered; the six reserved formats absent ──
  it('registers ONLY json today; the six reserved formats are unregistered', () => {
    expect(hasSerializer('json')).toBe(true)
    expect(getSerializer('json')).toBeTypeOf('function')
    for (const reserved of [
      'sdmx-json-2.0', 'sdmx-csv', 'qb-turtle', 'datapackage', 'parquet', 'prov',
    ]) {
      expect(hasSerializer(reserved), `${reserved} must be reserved, not registered`).toBe(false)
      expect(getSerializer(reserved)).toBeUndefined()
    }
  })

  // ── 1. Byte-identical default — observations ──────────────────────────────────
  it('GET /observations with no ?format= is byte-identical to the pre-port ok(rows)', async () => {
    const expected = JSON.stringify(ok(OBS_ROWS)) // the EXACT pre-port serialization
    const res = await obsApp.inject({
      method: 'GET',
      url: '/api/stats/observations?dataset=GDP_ANNUAL',
    })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe(expected) // raw wire bytes, not a re-parsed object
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('GET /observations?format=json is byte-identical to no ?format= (same wire bytes)', async () => {
    const expected = JSON.stringify(ok(OBS_ROWS))
    const res = await obsApp.inject({
      method: 'GET',
      url: '/api/stats/observations?dataset=GDP_ANNUAL&format=json',
    })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe(expected)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  // ── 1. Byte-identical default — datasets ──────────────────────────────────────
  it('GET /datasets with no ?format= is byte-identical to the pre-port ok(rows)', async () => {
    const expected = JSON.stringify(ok(DATASET_ROWS))
    const res = await dsApp.inject({ method: 'GET', url: '/api/stats/datasets' })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe(expected)
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })

  it('GET /datasets?format=json is byte-identical to no ?format=', async () => {
    const expected = JSON.stringify(ok(DATASET_ROWS))
    const res = await dsApp.inject({ method: 'GET', url: '/api/stats/datasets?format=json' })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe(expected)
  })

  // ── 2. The port dispatches — an unregistered format → documented 400 Problem ───
  it('GET /observations?format=sdmx-csv returns the documented 400 RFC-9457 Problem', async () => {
    const res = await obsApp.inject({
      method: 'GET',
      url: '/api/stats/observations?dataset=GDP_ANNUAL&format=sdmx-csv',
    })
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    const body = res.json()
    expect(body.status).toBe(400)
    expect(body.detail).toMatch(/sdmx-csv/) // names the unsupported format
  })

  it('GET /datasets?format=parquet returns the documented 400 RFC-9457 Problem', async () => {
    const res = await dsApp.inject({ method: 'GET', url: '/api/stats/datasets?format=parquet' })
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/)
    expect(res.json().detail).toMatch(/parquet/)
  })

  // An unsupported format on GET /datasets/:code must 400 BEFORE the ETag/version path,
  // proving fail-fast resolution sits at the boundary (not after work).
  it('GET /datasets/:code?format=qb-turtle 400s (fail-fast, before the version/ETag path)', async () => {
    const res = await dsApp.inject({
      method: 'GET',
      url: '/api/stats/datasets/GDP_ANNUAL?format=qb-turtle',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().detail).toMatch(/qb-turtle/)
  })
})
