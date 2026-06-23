import { describe, it, expect } from 'vitest'
import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify'

// Env contract is parsed at import time (env.ts), so set required vars BEFORE
// importing any module that reads it.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV         = 'test'

import type { Queryable } from '../../lib/users.js'

// ── Fake Queryable ─────────────────────────────────────────────────────────────
//
// Dispatches on SQL fingerprint, mirroring the two queries the setup route issues:
// hasAdminUser (EXISTS … 'admin' = ANY(roles)) and createUser (INSERT … RETURNING).
// No real database — the route runs its real precondition + create logic against
// controlled rows.
interface DbRow extends Record<string, unknown> {
  id:       string
  username: string
  roles:    string[]
  enabled:  boolean
}

function fakePg(opts: { hasAdmin: boolean; onInsert?: (values: unknown[]) => void }): Queryable {
  return {
    async query<R extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: R[] }> {
      if (text.includes('EXISTS')) {
        return { rows: [{ exists: opts.hasAdmin }] as unknown as R[] }
      }
      if (text.includes('INSERT INTO config.user')) {
        opts.onInsert?.(values ?? [])
        const [username] = (values ?? []) as [string, string, string[]]
        const row: DbRow = {
          id:       '22222222-2222-2222-2222-222222222222',
          username,
          roles:    ['admin'],
          enabled:  true,
        }
        return { rows: [row] as unknown as R[] }
      }
      throw new Error(`fakePg: unexpected query: ${text}`)
    },
  }
}

async function buildApp(pg: Queryable): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { setupRoutes } = await import('./setup.js')
  const { ValidationError } = await import('../../lib/http.js')

  const app = Fastify()
  // The route consumes app.pg only through the Queryable port (hasAdminUser,
  // createUser take Queryable). The cast bridges the @fastify/postgres PostgresDb
  // decoration type, of which Queryable is the only surface setup touches.
  app.decorate('pg', pg as unknown as FastifyInstance['pg'])
  // Mounted at the same prefix index.ts uses (sibling to the guarded adminRoutes).
  await app.register(setupRoutes, { prefix: '/api/admin/setup' })

  app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: error.name, message: error.message, issues: error.issues })
    }
    const statusCode = error.statusCode ?? 500
    return reply.status(statusCode).send({ error: error.name, message: error.message })
  })

  await app.ready()
  return app
}

describe('POST /api/admin/setup — first-admin bootstrap', () => {
  it('creates the first admin when zero admins exist → 201', async () => {
    let inserted: unknown[] | undefined
    const app = await buildApp(fakePg({ hasAdmin: false, onInsert: (v) => (inserted = v) }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/setup',
      payload: { username: 'root', password: 'longenough1' },
    })
    expect(res.statusCode).toBe(201)
    const { data } = res.json()
    expect(data.username).toBe('root')
    expect(data.roles).toEqual(['admin'])
    // The created user is given the admin role (values[2]).
    expect(inserted?.[0]).toBe('root')
    expect(inserted?.[2]).toEqual(['admin'])
  })

  it('returns 409 once an admin already exists (self-disabling)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: true }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/setup',
      payload: { username: 'root', password: 'longenough1' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('rejects a missing/short body → 400 (validated at the boundary)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))

    // Missing fields entirely.
    const missing = await app.inject({ method: 'POST', url: '/api/admin/setup', payload: {} })
    expect(missing.statusCode).toBe(400)

    // Password below the 8-char minimum.
    const short = await app.inject({
      method: 'POST',
      url: '/api/admin/setup',
      payload: { username: 'root', password: 'short' },
    })
    expect(short.statusCode).toBe(400)
  })
})
