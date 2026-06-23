import { describe, it, expect, beforeAll } from 'vitest'
import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from 'fastify'

// Env contract is parsed at import time (env.ts), so set the required vars BEFORE
// importing any module that reads it. EMBED_SECRET is fixed so the test can sign
// tokens with the same key the routes verify against.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.EMBED_SECRET    = 'test-embed-secret'
process.env.NODE_ENV        = 'test'

const EMBED_SECRET = process.env.EMBED_SECRET

// A minimal but faithful snapshot: only generatedAt is load-bearing at this boundary.
const snapshot = { generatedAt: '2026-06-17T00:00:00.000Z', nodes: [], status: 'ok' }

// Build a test app that registers exactly the N38 routes plus the same global
// error boundary as index.ts — no DB plugin, no listen(). One store shared by
// both routes, mirroring production wiring.
async function buildApp(): Promise<{ app: FastifyInstance; jwt: string }> {
  const Fastify = (await import('fastify')).default
  const { snapshotsRoutes, embedRoutes, createSnapshotStore } = await import('./index.js')
  const { ValidationError } = await import('../../lib/http.js')
  const { issueToken } = await import('../../lib/auth.js')
  const { env } = await import('../../env.js')

  const app = Fastify()
  const store = createSnapshotStore(100)
  await app.register(snapshotsRoutes(store), { prefix: '/api/snapshots' })
  await app.register(embedRoutes(store), { prefix: '/api/embed' })

  app.setErrorHandler((error: FastifyError, _req: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: error.name, message: error.message, issues: error.issues })
    }
    const statusCode = error.statusCode ?? 500
    return reply.status(statusCode).send({ error: error.name, message: error.message })
  })

  await app.ready()
  return { app, jwt: issueToken('admin', env.JWT_SECRET) }
}

// Sign with the same algorithm the route verifies against.
async function sign(token: string): Promise<string> {
  const { sign } = await import('../../lib/embed.js')
  return sign(token, EMBED_SECRET)
}

// POST a snapshot, return the minted token + signed URL.
async function createSnapshot(
  app: FastifyInstance,
  jwt: string,
  body: Record<string, unknown> = { snapshot },
): Promise<{ status: number; token?: string; url?: string; expiresAt?: number }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/snapshots',
    headers: { authorization: `Bearer ${jwt}` },
    payload: body,
  })
  if (res.statusCode !== 201) return { status: res.statusCode }
  const { data } = res.json()
  return { status: res.statusCode, ...data }
}

describe('N38 embed routes', () => {
  let app: FastifyInstance
  let jwt: string

  beforeAll(async () => {
    const built = await buildApp()
    app = built.app
    jwt = built.jwt
  })

  it('POST /api/snapshots → 201 with token + signed url', async () => {
    const res = await createSnapshot(app, jwt)
    expect(res.status).toBe(201)
    expect(res.token).toMatch(/^[0-9a-f]{24}$/)
    expect(res.url).toBe(`/embed/${res.token}?sig=${await sign(res.token!)}`)
  })

  it('POST /api/snapshots without a JWT → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/snapshots', payload: { snapshot } })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/snapshots with a malformed body (no generatedAt) → 400', async () => {
    const res = await createSnapshot(app, jwt, { snapshot: { nodes: [] } })
    expect(res.status).toBe(400)
  })

  it('GET /api/embed/:token with a valid sig → 200 + the stored snapshot', async () => {
    const created = await createSnapshot(app, jwt)
    const sig = await sign(created.token!)
    const res = await app.inject({ method: 'GET', url: `/api/embed/${created.token}?sig=${sig}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(snapshot) // raw snapshot, NOT the { data } envelope
  })

  it('GET /api/embed/:token with a bad sig → 403', async () => {
    const created = await createSnapshot(app, jwt)
    const res = await app.inject({ method: 'GET', url: `/api/embed/${created.token}?sig=deadbeef` })
    expect(res.statusCode).toBe(403)
  })

  it('GET /api/embed/:token for an unknown token (valid sig) → 404', async () => {
    const token = 'a'.repeat(24)
    const sig = await sign(token)
    const res = await app.inject({ method: 'GET', url: `/api/embed/${token}?sig=${sig}` })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/embed/:token for an expired token → 410 Gone', async () => {
    const created = await createSnapshot(app, jwt, {
      snapshot,
      embed: { expiresAt: Date.now() - 1_000 }, // already in the past
    })
    const sig = await sign(created.token!)
    const res = await app.inject({ method: 'GET', url: `/api/embed/${created.token}?sig=${sig}` })
    expect(res.statusCode).toBe(410)
  })

  it('POST with embed.expiresAt echoes expiresAt in the response', async () => {
    const expiresAt = Date.now() + 60_000
    const res = await createSnapshot(app, jwt, { snapshot, embed: { expiresAt } })
    expect(res.expiresAt).toBe(expiresAt)
  })
})
