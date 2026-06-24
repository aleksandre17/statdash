import { describe, it, expect, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time (env.ts), so set required vars BEFORE
// importing any module that reads it. JWT_SECRET is fixed so the test can issue
// tokens with the same key the routes verify against.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

// Build a test app: the admin routes + the same global error boundary as index.ts.
// The audit logger is seeded with a few entries so the read route has data.
async function buildApp(): Promise<{
  app: FastifyInstance
  adminJwt: string
  userJwt: string
}> {
  const Fastify = (await import('fastify')).default
  const { adminRoutes } = await import('./index.js')
  const { createInMemoryAuditLogger } = await import('../../lib/audit-log.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
  const { issueToken } = await import('../../lib/auth.js')
  const { env } = await import('../../env.js')

  const audit = createInMemoryAuditLogger(100)
  audit.log({ userId: 'admin', action: 'config.save', resource: 'page-1' })
  audit.log({ userId: 'admin', action: 'snapshot.create', resource: 'tok-1' })

  const app = Fastify()
  // Error handler FIRST so the route plugin inherits it (mirrors index.ts).
  registerProblemErrorHandler(app)
  await app.register(adminRoutes(audit), { prefix: '/api/admin' })

  await app.ready()
  return {
    app,
    adminJwt: issueToken('admin', env.JWT_SECRET, undefined, ['admin']),
    userJwt:  issueToken('editor', env.JWT_SECRET, undefined, ['editor']),
  }
}

describe('GET /api/admin/audit-log [N41]', () => {
  let app: FastifyInstance
  let adminJwt: string
  let userJwt: string

  beforeAll(async () => {
    const built = await buildApp()
    app = built.app
    adminJwt = built.adminJwt
    userJwt = built.userJwt
  })

  it('returns audit entries for an admin (newest-first, default limit)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-log',
      headers: { authorization: `Bearer ${adminJwt}` },
    })
    expect(res.statusCode).toBe(200)
    const { data } = res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.map((e: { action: string }) => e.action)).toEqual(['snapshot.create', 'config.save'])
  })

  it('honours ?limit=N', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-log?limit=1',
      headers: { authorization: `Bearer ${adminJwt}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(1)
    expect(res.json().data[0].action).toBe('snapshot.create')
  })

  it('rejects a non-admin token with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-log',
      headers: { authorization: `Bearer ${userJwt}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a request with no token with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/audit-log' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects ?limit over the 500 cap with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-log?limit=999',
      headers: { authorization: `Bearer ${adminJwt}` },
    })
    expect(res.statusCode).toBe(400)
  })
})
