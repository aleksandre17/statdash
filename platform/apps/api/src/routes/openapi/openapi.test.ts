import { describe, it, expect, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

type Obj = Record<string, unknown>
/** Drill a nested object by keys, asserting each level is an object. */
function dig(root: unknown, ...keys: string[]): Obj {
  let cur = root as Obj
  for (const k of keys) cur = cur[k] as Obj
  return cur
}

// Build an app that registers the OpenAPI collector FIRST, then a few real route
// shapes, mirroring index.ts ordering. The doc must reflect the live router.
async function buildApp(): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { registerOpenApi } = await import('./index.js')

  const app = Fastify()
  registerOpenApi(app, { info: { title: 'statdash API', version: '0.0.1' } })

  // Stand-ins at the same paths the real plugins mount, so coverage is asserted
  // against genuine collected routes (not hand-listed paths).
  app.get('/api/bootstrap', async () => ({}))
  app.get('/api/data-sources', async () => ({}))
  app.get('/api/stats/observations', async () => ({}))
  app.post('/api/auth', async () => ({}))
  app.get('/api/embed/:token', async () => ({}))
  app.get('/health', async () => ({}))
  await app.ready()
  return app
}

describe('OpenAPI generation (API-16 fitness)', () => {
  let app: FastifyInstance
  let doc: Obj

  beforeAll(async () => {
    app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/openapi.json' })
    expect(res.statusCode).toBe(200)
    doc = res.json() as Obj
  })

  it('is a valid OpenAPI 3.1 document with info + paths + components', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect((doc.info as Obj).title).toBe('statdash API')
    expect(doc.paths).toBeTypeOf('object')
    expect(dig(doc, 'components', 'schemas')).toHaveProperty('ProblemDetails')
  })

  it('covers the public routes (harvested from the live router, not hand-listed)', () => {
    const paths = doc.paths as Obj
    expect(paths).toHaveProperty('/api/bootstrap')
    expect(paths).toHaveProperty('/api/data-sources')
    expect(paths).toHaveProperty('/api/stats/observations')
    expect(paths).toHaveProperty('/api/auth')
    // Fastify :param → OpenAPI {param}.
    expect(paths).toHaveProperty('/api/embed/{token}')
    expect(paths).toHaveProperty('/health')
    // The doc/scrape endpoints are excluded from the spec.
    expect(paths).not.toHaveProperty('/api/openapi.json')
  })

  it('generates the login request body FROM the Zod SSOT', () => {
    const schema = dig(doc, 'paths', '/api/auth', 'post', 'requestBody', 'content', 'application/json', 'schema')
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('username')
    expect(schema.properties).toHaveProperty('password')
    expect(schema.required).toEqual(expect.arrayContaining(['username', 'password']))
  })

  it('expands path + query params for the embed read', () => {
    const op = dig(doc, 'paths', '/api/embed/{token}', 'get')
    const params = op.parameters as Array<Obj>
    const byName = Object.fromEntries(params.map((p) => [p.name as string, p]))
    expect((byName.token as Obj).in).toBe('path')
    expect((byName.token as Obj).required).toBe(true)
    expect((byName.sig as Obj).in).toBe('query')
  })

  it('attaches the RFC 9457 problem response to every operation', () => {
    const content = dig(doc, 'paths', '/api/bootstrap', 'get', 'responses', '4XX', 'content')
    expect(content).toHaveProperty('application/problem+json')
  })
})
