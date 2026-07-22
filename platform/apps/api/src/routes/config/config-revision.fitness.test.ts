// ── FF-PUT-VALIDATED + FF-REVISION-ON-PUT — the validated, versioned config PUT ─
//
//  ADR-052 door #2. Two fitness contracts, pinned WITHOUT a real DB (a stateful fake
//  pg — the pages.validation.test.ts idiom, extended to model config.revision +
//  the stats DSD probes + the site metrics catalog):
//
//    FF-PUT-VALIDATED   — an invalid body is REJECTED with a 422 config-invalid
//                         (RFC 9457) carrying NAMED violations, and NOT persisted.
//                         Fixtures: the regional-datasetCode-flip (a dangling
//                         datasetCode) + the dims-outside-DSD class ARE invalid; an
//                         empty-but-structurally-valid spec (the orphan-0-row class)
//                         is NOT invalid (emptiness is honest, ADR-052 §4). The
//                         code-resolves class (J-LIFECYCLE gap, 2026-07-22): a
//                         head/source code must resolve as a governed metric OR a
//                         live measure code (stats.classifier) — a nonsense code in
//                         EITHER shape is 422; a valid raw code passes; with a
//                         registry unprovisioned the check honestly stands down.
//    FF-REVISION-ON-PUT — every successful PUT appends EXACTLY ONE revision (full
//                         snapshot); restore appends a NEW revision with restoredFrom
//                         set; earlier history is NEVER mutated; restore is admin-gated.

import { describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../../lib/auth.js'

process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

// ── The in-memory fake DB state ────────────────────────────────────────────────
interface RevisionRow {
  id: string; doc_kind: string; doc_id: string; revision_number: number
  body: unknown; actor: string | null; note: string | null
  restored_from: string | null; created_at: string
}
interface State {
  dataSources: Map<string, Record<string, unknown>>
  dataSpecs:   Map<string, Record<string, unknown>>
  revisions:   RevisionRow[]
  datasets:    Set<string>
  dsd:         Map<string, string[]>
  metrics:     { id: string; code: string }[]
  /** Live measure codelist (stats.classifier, dim=measure, is_current) — the raw-code SSOT. */
  measureCodes: string[]
  revSeq:      number
}

function freshState(): State {
  return {
    dataSources: new Map(),
    dataSpecs:   new Map(),
    revisions:   [],
    datasets:    new Set(['GDP_ANNUAL']),
    dsd:         new Map([['GDP_ANNUAL', ['approach', 'measure', 'geo', 'time']]]),
    metrics:     [{ id: 'gdp.current', code: 'gross-domestic-product' }],
    measureCodes: ['gross-domestic-product', 'B1GQ'],
    revSeq:      0,
  }
}

// The ONE query router — pool.query and every in-txn client.query share it + the state.
function runQuery(state: State, text: string, values: unknown[] = []): { rows: Record<string, unknown>[] } {
  const t = text.replace(/\s+/g, ' ').trim()

  if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(t)) return { rows: [] }

  // relationExists — every stats relation is "present" in the fake.
  if (/to_regclass/i.test(t)) return { rows: [{ exists: true }] }

  // DSD-dims probe (must precede the stats.dataset match — substring).
  if (/FROM stats\.dataset_dimension WHERE dataset_code/i.test(t)) {
    const dims = state.dsd.get(String(values[0])) ?? []
    return { rows: dims.map((d) => ({ dim_code: d })) }
  }
  // dataset-exists probe.
  if (/FROM stats\.dataset WHERE code/i.test(t)) {
    return { rows: state.datasets.has(String(values[0])) ? [{ one: 1 }] : [] }
  }
  // metrics catalog.
  if (/FROM config\.site_config WHERE key = 'metrics'/i.test(t)) {
    return { rows: [{ value: state.metrics }] }
  }
  // live measure codelist (stats.classifier, dim=measure, is_current) — raw-code SSOT.
  if (/FROM stats\.classifier WHERE dim_code/i.test(t)) {
    return { rows: state.measureCodes.map((code) => ({ code })) }
  }

  // ── config.revision ──
  if (/INSERT INTO config\.revision/i.test(t)) {
    const [doc_kind, doc_id, body, actor, note, restored_from] = values as [string, string, string, string | null, string | null, string | null]
    const n = state.revisions.filter((r) => r.doc_kind === doc_kind && r.doc_id === doc_id)
      .reduce((mx, r) => Math.max(mx, r.revision_number), 0) + 1
    const seq = (++state.revSeq).toString(16).padStart(12, '0')
    const row: RevisionRow = {
      id: `00000000-0000-4000-8000-${seq}`, doc_kind, doc_id, revision_number: n,
      body: JSON.parse(String(body)), actor: actor ?? null, note: note ?? null,
      restored_from: restored_from ?? null, created_at: new Date().toISOString(),
    }
    state.revisions.push(row)
    return { rows: [row as unknown as Record<string, unknown>] }
  }
  if (/FROM config\.revision/i.test(t)) {
    let rows = state.revisions.filter((r) => r.doc_kind === values[0] && r.doc_id === values[1])
    if (/AND id =/i.test(t)) rows = rows.filter((r) => r.id === values[2])
    rows = [...rows].sort((a, b) => b.revision_number - a.revision_number)
    return { rows: rows as unknown as Record<string, unknown>[] }
  }

  // ── config.data_source ──
  if (/UPDATE config\.data_source/i.test(t)) {
    const id = String(values[5])
    const row = { id, name: values[0], type: values[1], url: values[2], config: JSON.parse(String(values[3])), status: values[4], created_at: 'c', updated_at: 'u' }
    state.dataSources.set(id, row)
    return { rows: [row] }
  }
  if (/SELECT config FROM config\.data_source/i.test(t)) {
    const src = state.dataSources.get(String(values[0]))
    return { rows: src ? [{ config: src.config }] : [] }
  }
  if (/FROM config\.data_source WHERE id/i.test(t)) {
    const src = state.dataSources.get(String(values[0]))
    return { rows: src ? [src] : [] }
  }

  // ── config.data_spec ──
  if (/UPDATE config\.data_spec/i.test(t)) {
    const id = String(values[4])
    const row = { id, name: values[0], description: values[1], spec: JSON.parse(String(values[2])), source_id: values[3], created_at: 'c', updated_at: 'u' }
    state.dataSpecs.set(id, row)
    return { rows: [row] }
  }
  if (/FROM config\.data_spec WHERE id/i.test(t)) {
    const sp = state.dataSpecs.get(String(values[0]))
    return { rows: sp ? [sp] : [] }
  }

  return { rows: [] }
}

function fakePg(state: State): FastifyInstance['pg'] {
  const client = {
    query: async (text: string, values?: unknown[]) => runQuery(state, text, values),
    release() {},
  }
  return {
    query: async (text: string, values?: unknown[]) => runQuery(state, text, values),
    connect: async () => client,
  } as unknown as FastifyInstance['pg']
}

async function buildApp(state: State, identity?: JwtPayload): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { dataSpecsRoutes } = await import('./data-specs.js')
  const { dataSourcesRoutes } = await import('./data-sources.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')

  const app = Fastify()
  app.decorate('pg', fakePg(state))
  registerProblemErrorHandler(app)
  // Stamp the test identity (authPlugin is registered at configRoutes level in prod;
  // here the sub-plugins are mounted directly, so we inject jwtPayload for actor/roles).
  if (identity) app.addHook('onRequest', async (req) => { req.jwtPayload = identity })
  await app.register(dataSpecsRoutes, { prefix: '/api/config/data-specs' })
  await app.register(dataSourcesRoutes, { prefix: '/api/config/data-sources' })
  await app.ready()
  return app
}

const ADMIN: JwtPayload  = { sub: 'admin', iat: 0, exp: 9e9, roles: ['admin'] }
const EDITOR: JwtPayload = { sub: 'editor', iat: 0, exp: 9e9, roles: ['editor'] }

const SRC_ID  = '11111111-1111-1111-1111-111111111111'
const SPEC_ID = '22222222-2222-2222-2222-222222222222'

function seedSource(state: State, config: Record<string, unknown>): void {
  state.dataSources.set(SRC_ID, {
    id: SRC_ID, name: 'gdp', type: 'rest', url: null, config, status: 'connected',
    created_at: 'c', updated_at: 'u',
  })
}
function seedSpec(state: State, spec: Record<string, unknown>, source_id: string | null): void {
  state.dataSpecs.set(SPEC_ID, {
    id: SPEC_ID, name: 'gdp-series', description: null, spec, source_id,
    created_at: 'c', updated_at: 'u',
  })
}

// ════════════════════════════════════════════════════════════════════════════════
describe('FF-PUT-VALIDATED — invalid config bodies are rejected 422 with named violations', () => {
  it('the regional-datasetCode-flip: a PUT flipping datasetCode to a nonexistent code is REJECTED', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach', 'measure', 'geo'] })
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-sources/${SRC_ID}`,
      payload: { config: { datasetCode: 'GDP_ANNUAL_X', nonTimeDims: ['approach', 'measure', 'geo'] } },
    })

    expect(res.statusCode).toBe(422)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json() as { type: string; code: string; violations: { check: string; ref?: string }[] }
    expect(body.type).toMatch(/config-invalid$/)
    expect(body.code).toBe('CONFIG_INVALID')
    expect(body.violations.some((v) => v.check === 'dataset-exists' && v.ref === 'GDP_ANNUAL_X')).toBe(true)
    // NOT persisted — the current row + the revision log are untouched.
    expect((state.dataSources.get(SRC_ID) as { config: { datasetCode: string } }).config.datasetCode).toBe('GDP_ANNUAL')
    expect(state.revisions).toHaveLength(0)
  })

  it('the dims-outside-DSD class: a declared dim not in the dataset DSD is REJECTED (dims-subset)', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-sources/${SRC_ID}`,
      payload: { config: { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach', 'not_a_dim'] } },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json() as { violations: { check: string; ref?: string }[] }
    expect(body.violations.some((v) => v.check === 'dims-subset' && v.ref === 'not_a_dim')).toBe(true)
    expect(state.revisions).toHaveLength(0)
  })

  it('a data_spec with an unknown spec.type is REJECTED (shape)', async () => {
    const state = freshState()
    seedSpec(state, { type: 'timeseries', code: 'X', years: 'all' }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'not-a-real-kind' } },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json() as { violations: { check: string }[] }
    expect(body.violations.some((v) => v.check === 'shape')).toBe(true)
    expect(state.revisions).toHaveLength(0)
  })

  it('a bogus GOVERNED-looking id (resolves in neither registry) is REJECTED (code-resolves)', async () => {
    const state = freshState()
    seedSpec(state, { type: 'metric', metrics: ['gdp.current'] }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'metric', metrics: ['gdp.current', 'does.not.exist'] } },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json() as { violations: { check: string; path: string; ref?: string }[] }
    expect(body.violations.some(
      (v) => v.check === 'code-resolves' && v.ref === 'does.not.exist' && v.path === '/spec/metrics/1',
    )).toBe(true)
  })

  it('the J-LIFECYCLE gap: a pipeline steward head whose query.measure is a NONSENSE raw-looking code is REJECTED (code-resolves)', async () => {
    // Live-proven 2026-07-22 on dev :3011 — this exact class published 200 and the
    // grid rendered fake zeros. A code must resolve SOMEWHERE: governed catalog OR
    // live measure codelist. `nonexistent.metric.xyz` resolves in neither.
    const state = freshState()
    seedSpec(state, { type: 'pipeline', pipe: [{ op: 'source', query: { measure: 'B1GQ' } }], encoding: {} }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'pipeline', pipe: [{ op: 'source', query: { measure: 'nonexistent.metric.xyz' } }], encoding: {} } },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json() as { violations: { check: string; path: string; ref?: string }[] }
    expect(body.violations.some(
      (v) => v.check === 'code-resolves' && v.ref === 'nonexistent.metric.xyz' && v.path === '/spec/pipe/0/query/measure',
    )).toBe(true)
    expect(state.revisions).toHaveLength(0) // NOT persisted
  })

  it('a value-cell head with an unresolvable code is REJECTED at /spec/pipe/0/code (code-resolves)', async () => {
    const state = freshState()
    seedSpec(state, { type: 'timeseries', code: 'B1GQ', years: 'all' }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'pipeline', pipe: [{ op: 'source', over: 'time', code: 'bogus.code' }], encoding: {} } },
    })

    expect(res.statusCode).toBe(422)
    const body = res.json() as { violations: { check: string; path: string; ref?: string }[] }
    expect(body.violations.some(
      (v) => v.check === 'code-resolves' && v.ref === 'bogus.code' && v.path === '/spec/pipe/0/code',
    )).toBe(true)
  })

  it('a VALID raw measure code passes (200): raw codes share the namespace and resolve via stats.classifier', async () => {
    const state = freshState()
    seedSpec(state, { type: 'timeseries', code: 'B1GQ', years: 'all' }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'pipeline', pipe: [{ op: 'source', query: { measure: 'B1GQ' } }], encoding: {} } },
    })
    expect(res.statusCode).toBe(200)
    expect(state.revisions).toHaveLength(1)
  })

  it('honest stand-down: with NO measure codelist ingested yet, a raw-looking code cannot be judged (200, not a false 422)', async () => {
    // Half-provisioned DB (metrics catalog present, cube not ingested): non-resolution
    // cannot be PROVEN, so the check skips rather than false-positive a legit raw code
    // for a not-yet-ingested cube. Both registries must be judgeable to flag.
    const state = freshState()
    state.measureCodes = []
    seedSpec(state, { type: 'timeseries', code: 'B1GQ', years: 'all' }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'timeseries', code: 'not-ingested-yet', years: 'all' } },
    })
    expect(res.statusCode).toBe(200)
  })

  it('the orphan-0-row class is NOT invalid: a structurally-valid spec bound to a real dataset PERSISTS (200)', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    seedSpec(state, { type: 'timeseries', code: 'B1GQ', years: 'all' }, SRC_ID)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { name: 'gdp-series-renamed', spec: { type: 'timeseries', code: 'B1GQ', years: 'all' } },
    })

    // Emptiness / an orphan-but-well-formed spec is an HONEST state, never a 422.
    expect(res.statusCode).toBe(200)
    expect(state.revisions).toHaveLength(1)
  })

  it('a valid metric ref resolves (200) and appends a revision', async () => {
    const state = freshState()
    seedSpec(state, { type: 'metric', metrics: [] }, null)
    const app = await buildApp(state, EDITOR)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/data-specs/${SPEC_ID}`,
      payload: { spec: { type: 'metric', metrics: ['gdp.current'] } },
    })
    expect(res.statusCode).toBe(200)
    expect(state.revisions).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('FF-REVISION-ON-PUT — every PUT appends; restore appends with restoredFrom; history is immutable', () => {
  it('each successful PUT appends exactly one revision (full snapshot, monotonic number)', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    const app = await buildApp(state, ADMIN)

    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'error' } })
    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'connected' } })

    expect(state.revisions).toHaveLength(2)
    expect(state.revisions.map((r) => r.revision_number)).toEqual([1, 2])
    // Full snapshot: the revision body carries every logical field, not just the delta.
    const snap = state.revisions[1].body as { name: string; status: string; config: unknown }
    expect(snap.name).toBe('gdp')
    expect(snap.status).toBe('connected')
    expect(snap.config).toEqual({ datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    expect(state.revisions[1].actor).toBe('admin')
  })

  it('GET /:id/revisions returns the history newest-first; GET /:id/revisions/:revId returns the full body', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    const app = await buildApp(state, ADMIN)
    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'error' } })

    const list = await app.inject({ method: 'GET', url: `/api/config/data-sources/${SRC_ID}/revisions` })
    expect(list.statusCode).toBe(200)
    const summaries = (list.json() as { data: { revisionNumber: number; body?: unknown }[] }).data
    expect(summaries).toHaveLength(1)
    expect(summaries[0].revisionNumber).toBe(1)
    expect(summaries[0].body).toBeUndefined() // list omits bodies (weight rule)

    const revId = state.revisions[0].id
    const full = await app.inject({ method: 'GET', url: `/api/config/data-sources/${SRC_ID}/revisions/${revId}` })
    expect(full.statusCode).toBe(200)
    const rec = (full.json() as { data: { body: { status: string }; revisionNumber: number } }).data
    expect(rec.body.status).toBe('error')
  })

  it('restore appends a NEW revision (restoredFrom set) and re-applies the old body; history is UNCHANGED', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    const app = await buildApp(state, ADMIN)

    // r1 (status error) then r2 (status connected).
    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'error' } })
    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'connected' } })
    const r1 = state.revisions[0]
    const r1BodyBefore = JSON.stringify(r1.body)

    const res = await app.inject({ method: 'POST', url: `/api/config/data-sources/${SRC_ID}/revisions/${r1.id}/restore` })
    expect(res.statusCode).toBe(200)

    // A THIRD revision, restoredFrom = r1, body === r1's body (status 'error').
    expect(state.revisions).toHaveLength(3)
    const r3 = state.revisions[2]
    expect(r3.revision_number).toBe(3)
    expect(r3.restored_from).toBe(r1.id)
    expect((r3.body as { status: string }).status).toBe('error')
    // The live row is re-applied to the restored body.
    expect((state.dataSources.get(SRC_ID) as { status: string }).status).toBe('error')
    // History is IMMUTABLE — r1 is byte-identical to before the restore.
    expect(JSON.stringify(state.revisions[0].body)).toBe(r1BodyBefore)
  })

  it('restore is ADMIN-gated: an editor is 403 and no revision is appended', async () => {
    const state = freshState()
    seedSource(state, { datasetCode: 'GDP_ANNUAL', nonTimeDims: ['approach'] })
    const app = await buildApp(state, ADMIN)
    await app.inject({ method: 'PUT', url: `/api/config/data-sources/${SRC_ID}`, payload: { status: 'error' } })
    const r1 = state.revisions[0]

    const editorApp = await buildApp(state, EDITOR)
    const res = await editorApp.inject({ method: 'POST', url: `/api/config/data-sources/${SRC_ID}/revisions/${r1.id}/restore` })
    expect(res.statusCode).toBe(403)
    expect(state.revisions).toHaveLength(1) // no append
  })
})
