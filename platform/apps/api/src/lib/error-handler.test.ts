import { describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time by some transitively-imported modules;
// set the required vars before importing anything that reads env.ts.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

import { z } from 'zod'

// ── RFC 9457 Problem Details — central error handler conformance ──────────────
//
//  Pure handler test (no DB): a tiny Fastify app whose routes do nothing but
//  throw the representative problem kinds. Asserts the production serializer
//  (registerProblemErrorHandler) emits `application/problem+json` with a
//  conformant body — the five standard members + typed extensions — and the
//  correct status for each kind, INCLUDING the 409 forward-compat conflict
//  carrying its context as structured extension members (not a stringified blob).

async function buildApp(): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { registerProblemErrorHandler } = await import('./error-handler.js')
  const { Problem, problem, notFound } = await import('./problem.js')
  const { parseBody } = await import('./http.js')

  const app = Fastify()
  // Error handler FIRST so every route inherits it — the production discipline.
  registerProblemErrorHandler(app)

  app.get('/notfound', async () => { throw notFound('Page') })
  app.get('/unauthorized', async () => { throw problem('unauthorized', 'Missing authorization token') })
  app.get('/forbidden', async () => { throw problem('forbidden', 'admin role required') })
  app.get('/conflict', async () => { throw problem('conflict', "submission is 'received', not 'staged'") })
  app.get('/gone', async () => { throw problem('gone', 'Embed token has expired') })
  app.post('/validation', async (req) => {
    const Body = z.object({ slug: z.string().min(1) })
    parseBody(Body, req.body)
    return { data: 'never' }
  })
  app.get('/schema-ahead', async () => {
    throw new Problem(
      'config-schema-ahead',
      'The stored page config was written by a newer platform build than this server supports.',
      { code: 'CONFIG_SCHEMA_AHEAD', configSchemaVersion: 999, currentSchemaVersion: 1 },
    )
  })
  app.get('/boom', async () => { throw new Error('unexpected') })

  await app.ready()
  return app
}

/** Assert the five RFC 9457 standard members are present and well-formed. */
function expectConformant(body: Record<string, unknown>, status: number, typeUrn: string): void {
  expect(body.type).toBe(`urn:statdash:problem:${typeUrn}`)
  expect(typeof body.title).toBe('string')
  expect((body.title as string).length).toBeGreaterThan(0)
  expect(body.status).toBe(status)
  expect(typeof body.instance).toBe('string') // the request path
}

describe('RFC 9457 central error handler', () => {
  it('404 — emits application/problem+json with conformant body', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/notfound' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json()
    expectConformant(body, 404, 'not-found')
    expect(body.detail).toBe('Page not found')
    expect(body.instance).toBe('/notfound')
  })

  it('401 — authentication required', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/unauthorized' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expectConformant(res.json(), 401, 'unauthorized')
    expect(res.json().detail).toBe('Missing authorization token')
  })

  it('403 — forbidden (valid auth, wrong role)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/forbidden' })
    expect(res.statusCode).toBe(403)
    expectConformant(res.json(), 403, 'forbidden')
  })

  it('410 — gone (expired embed token)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/gone' })
    expect(res.statusCode).toBe(410)
    expectConformant(res.json(), 410, 'gone')
  })

  it('400 — validation failure carries Zod issues as a structured extension', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/validation', payload: { slug: '' } })
    expect(res.statusCode).toBe(400)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json()
    expectConformant(body, 400, 'validation')
    expect(Array.isArray(body.issues)).toBe(true)
    expect(body.issues.length).toBeGreaterThan(0)
    // Issues are the structured Zod issues, not a stringified message.
    expect(body.issues[0]).toHaveProperty('path')
  })

  it('409 forward-compat — carries version context as structured extension members', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/schema-ahead' })
    expect(res.statusCode).toBe(409)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json()
    expectConformant(body, 409, 'config-schema-ahead')
    // The forward-compat payload is STRUCTURED, machine-readable extension members.
    expect(body.code).toBe('CONFIG_SCHEMA_AHEAD')
    expect(body.configSchemaVersion).toBe(999)
    expect(body.currentSchemaVersion).toBe(1)
    // Crucially: NOT a stringified JSON blob stuffed into a message field.
    expect(typeof body.configSchemaVersion).toBe('number')
  })

  it('500 — an unexpected throw maps to the internal problem', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.headers['content-type']).toContain('application/problem+json')
    expectConformant(res.json(), 500, 'internal')
  })
})
