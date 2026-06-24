import { describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time (env.ts), so set required vars BEFORE
// importing any module that reads it. JWT_SECRET is fixed so the test can decode
// the minted tokens with the same key the route signed with. ADMIN_* back the
// env-var bootstrap path.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME   = 'bootstrap-admin'
process.env.ADMIN_PASSWORD   = 'bootstrap-pass-123'
process.env.NODE_ENV         = 'test'

import type { Queryable } from '../../lib/users.js'

// ── Fake Queryable ─────────────────────────────────────────────────────────────
//
// Inject a fake `pg` (just an object satisfying Queryable) so the route runs its
// real branching logic against controlled rows — no real database. The fake
// dispatches on SQL fingerprint, mirroring exactly the two queries the login path
// issues: hasAdminUser (EXISTS … 'admin' = ANY(roles)) and findUserByUsername
// (SELECT … WHERE username = $1).
interface DbRow extends Record<string, unknown> {
  id:            string
  username:      string
  password_hash: string
  roles:         string[]
  enabled:       boolean
}

function fakePg(opts: { hasAdmin: boolean; users?: DbRow[] }): Queryable {
  const users = opts.users ?? []
  return {
    async query<R extends Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: R[] }> {
      // hasAdminUser — EXISTS query returning a single { exists } row.
      if (text.includes('EXISTS')) {
        return { rows: [{ exists: opts.hasAdmin }] as unknown as R[] }
      }
      // findUserByUsername — WHERE username = $1.
      if (text.includes('WHERE username = $1')) {
        const username = values?.[0] as string
        const row = users.find((u) => u.username === username)
        return { rows: (row ? [row] : []) as unknown as R[] }
      }
      throw new Error(`fakePg: unexpected query: ${text}`)
    },
  }
}

// Build a test app: only the auth routes + the same global error boundary as
// index.ts. app.pg is decorated with the injected fake (production decorates it
// via @fastify/postgres) so the route's app.pg calls hit the fake.
async function buildApp(pg: Queryable): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { authRoutes } = await import('./index.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')

  const app = Fastify()
  // The routes consume app.pg only through the Queryable port (findUserByUsername,
  // hasAdminUser take Queryable). Decorate with the fake; the cast bridges the
  // @fastify/postgres PostgresDb decoration type, of which Queryable is the only
  // surface the login path touches.
  app.decorate('pg', pg as unknown as FastifyInstance['pg'])
  // Error handler FIRST so the route plugin inherits it (mirrors index.ts).
  registerProblemErrorHandler(app)
  await app.register(authRoutes, { prefix: '/api/auth' })

  await app.ready()
  return app
}

// Decode a minted token (signature-verified) so tests can assert claims.
async function decode(token: string): Promise<{ sub: string; uid?: string; roles?: string[] }> {
  const { verifyToken } = await import('../../lib/auth.js')
  return verifyToken(token, process.env.JWT_SECRET!)
}

async function login(
  app: FastifyInstance,
  body: Record<string, unknown>,
): Promise<{ status: number; token?: string; message?: string }> {
  const res = await app.inject({ method: 'POST', url: '/api/auth', payload: body })
  const json = res.json()
  // On success the token is in the { data } envelope; on failure the human message
  // is the RFC 9457 `detail` member (problem+json), not a bare `message`.
  return { status: res.statusCode, token: json.data?.token, message: json.detail }
}

describe('POST /api/auth — bootstrap path (no enabled admin in DB)', () => {
  it('accepts the env credential → 200 with a token', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))
    const res = await login(app, { username: 'bootstrap-admin', password: 'bootstrap-pass-123' })
    expect(res.status).toBe(200)
    expect(typeof res.token).toBe('string')
  })

  it('mints an admin token (roles: [admin], no uid)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))
    const res = await login(app, { username: 'bootstrap-admin', password: 'bootstrap-pass-123' })
    const claims = await decode(res.token!)
    expect(claims.roles).toEqual(['admin'])
    expect(claims.sub).toBe('bootstrap-admin')
    // Env-bootstrap tokens carry no uid (there is no config.user row behind them).
    expect(claims.uid).toBeUndefined()
  })

  it('rejects the wrong env-var password → 401', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))
    const res = await login(app, { username: 'bootstrap-admin', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown username with the SAME 401 message (no enumeration)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))
    const unknown = await login(app, { username: 'nobody', password: 'bootstrap-pass-123' })
    const wrongPass = await login(app, { username: 'bootstrap-admin', password: 'wrong' })
    expect(unknown.status).toBe(401)
    expect(wrongPass.status).toBe(401)
    expect(unknown.message).toBe(wrongPass.message)
  })
})

describe('POST /api/auth — DB path (at least one enabled admin)', () => {
  // A real scrypt digest for the password the DB-path tests log in with. Hashed
  // once at module load so the route's verifyPassword runs against a genuine hash.
  let validHash: string
  const PASSWORD = 'editor-password-1'

  async function dbUsers(overrides: Partial<DbRow> = {}): Promise<DbRow[]> {
    const { hashPassword } = await import('../../lib/users.js')
    validHash ??= await hashPassword(PASSWORD)
    return [
      {
        id:            '11111111-1111-1111-1111-111111111111',
        username:      'alice',
        password_hash: validHash,
        roles:         ['editor'],
        enabled:       true,
        ...overrides,
      },
    ]
  }

  it('correct username + password → 200, token has correct roles and uid', async () => {
    const app = await buildApp(fakePg({ hasAdmin: true, users: await dbUsers() }))
    const res = await login(app, { username: 'alice', password: PASSWORD })
    expect(res.status).toBe(200)
    const claims = await decode(res.token!)
    expect(claims.sub).toBe('alice')
    expect(claims.roles).toEqual(['editor'])
    expect(claims.uid).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('wrong password → 401', async () => {
    const app = await buildApp(fakePg({ hasAdmin: true, users: await dbUsers() }))
    const res = await login(app, { username: 'alice', password: 'not-the-password' })
    expect(res.status).toBe(401)
  })

  it('unknown username → 401 with the SAME message as wrong password (no enumeration)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: true, users: await dbUsers() }))
    const unknown = await login(app, { username: 'ghost', password: PASSWORD })
    const wrongPass = await login(app, { username: 'alice', password: 'not-the-password' })
    expect(unknown.status).toBe(401)
    expect(wrongPass.status).toBe(401)
    expect(unknown.message).toBe(wrongPass.message)
  })

  it('disabled user + correct password → 403 (known identity, may not log in)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: true, users: await dbUsers({ enabled: false }) }))
    const res = await login(app, { username: 'alice', password: PASSWORD })
    expect(res.status).toBe(403)
  })

  it('DB path takes precedence over env vars once an admin exists', async () => {
    // hasAdmin: true means the env-var branch is dead. The env credential must be
    // rejected — it is not a config.user row, so findUserByUsername misses → 401.
    const app = await buildApp(fakePg({ hasAdmin: true, users: await dbUsers() }))
    const res = await login(app, { username: 'bootstrap-admin', password: 'bootstrap-pass-123' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth — request validation', () => {
  it('missing fields → 400 (validated at the boundary, never reaches the DB)', async () => {
    const app = await buildApp(fakePg({ hasAdmin: false }))
    const res = await app.inject({ method: 'POST', url: '/api/auth', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
