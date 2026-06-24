import { describe, it, expect } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { CURRENT_SCHEMA_VERSION } from '@statdash/engine'

// Env contract is parsed at import time (env.ts), so set required vars BEFORE
// importing any module that reads it.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

const PAGE_ID = '11111111-1111-1111-1111-111111111111'

// ── Fake pg ─────────────────────────────────────────────────────────────────
//
// Inject a fake `pg` so the GET /:id route runs its real lazy-migration logic
// against a controlled config blob — no real database. The fake answers the one
// query the handler issues (the LATERAL join selecting the page + latest
// version) with a single row whose `config` is the supplied blob.
function fakePg(config: unknown): FastifyInstance['pg'] {
  return {
    async query(_text: string, _values?: unknown[]) {
      return {
        rows: [
          {
            id: PAGE_ID,
            slug: 'test-page',
            title: { ka: 'ტესტი', en: 'Test' },
            status: 'draft',
            metadata: {},
            created_at: '2026-06-22T00:00:00.000Z',
            updated_at: '2026-06-22T00:00:00.000Z',
            version_number: 1,
            config,
            data_specs: [],
            is_published: false,
          },
        ],
      }
    },
  } as unknown as FastifyInstance['pg']
}

// Build a test app: only the pages routes + the same global error boundary as
// index.ts. app.pg is decorated with the injected fake.
async function buildApp(config: unknown): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { pagesRoutes } = await import('./pages.js')
  const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')

  const app = Fastify()
  app.decorate('pg', fakePg(config))
  // Error handler FIRST so the route plugin inherits it (Fastify cascades the
  // handler into child contexts at their registration time) — same order as index.ts.
  registerProblemErrorHandler(app)
  await app.register(pagesRoutes(), { prefix: '/api/config/pages' })

  await app.ready()
  return app
}

describe('GET /api/config/pages/:id — lazy schema migration [N19 / P3-3]', () => {
  it('stamps schemaVersion on a v0 config (no schemaVersion field)', async () => {
    const app = await buildApp({ title: 'A v0 config', nodes: [] })
    const res = await app.inject({ method: 'GET', url: `/api/config/pages/${PAGE_ID}` })
    expect(res.statusCode).toBe(200)
    const { data } = res.json()
    // A v0 blob is forward-migrated and stamped to CURRENT_SCHEMA_VERSION.
    expect(data.config.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    // Original fields are preserved (migration is non-destructive).
    expect(data.config.title).toBe('A v0 config')
  })

  it('returns a current-schema config unchanged (idempotent)', async () => {
    const app = await buildApp({ schemaVersion: CURRENT_SCHEMA_VERSION, title: 'Current' })
    const res = await app.inject({ method: 'GET', url: `/api/config/pages/${PAGE_ID}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.config.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('returns a 409 problem+json for a future config, with structured version extensions', async () => {
    const app = await buildApp({ schemaVersion: 999, title: 'From the future' })
    const res = await app.inject({ method: 'GET', url: `/api/config/pages/${PAGE_ID}` })
    expect(res.statusCode).toBe(409)
    expect(res.headers['content-type']).toContain('application/problem+json')
    const body = res.json()
    // RFC 9457 required members.
    expect(body.type).toBe('urn:statdash:problem:config-schema-ahead')
    expect(body.status).toBe(409)
    expect(typeof body.title).toBe('string')
    // Forward-compat context is STRUCTURED extension members, not a stringified blob.
    expect(body.code).toBe('CONFIG_SCHEMA_AHEAD')
    expect(body.configSchemaVersion).toBe(999)
    expect(body.currentSchemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('leaves a null config untouched (no migration attempted)', async () => {
    const app = await buildApp(null)
    const res = await app.inject({ method: 'GET', url: `/api/config/pages/${PAGE_ID}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.config).toBeNull()
  })
})

// ── Publish-role gate (C4 RBAC — editor saves, admin publishes) ───────────────
//
// POST /:id/publish is gated to the admin role on top of authPlugin's JWT. This
// suite proves the three-way contract WITHOUT a real DB: the gate runs in an
// onRequest hook BEFORE the handler/transaction, so the 401 (no token) and 403
// (wrong role) cases never touch pg.connect. The admin (200) case DOES reach the
// handler, so the fake pg below also stubs connect() with a transaction-shaped
// client returning the latest-version row the publish handler expects.
//
// The app is built via configRoutes (NOT pagesRoutes alone) because authPlugin is
// registered there — the JWT hook must be present for the role gate to read
// req.jwtPayload.roles, exactly as in production.
describe('POST /api/config/pages/:id/publish — publish-role gate (C4)', () => {
  // A fake pg whose connect() returns a client that satisfies the publish
  // transaction: BEGIN/COMMIT are no-ops; the latest-version SELECT yields one row;
  // the two UPDATEs return nothing. Only used by the authorised (admin) path.
  function publishFakePg(): FastifyInstance['pg'] {
    const client = {
      async query(text: string) {
        // Publish: the latest page_version SELECT must yield a row to promote.
        if (/FROM config\.page_version/i.test(text) && /ORDER BY version_number DESC/i.test(text)) {
          return { rows: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }] }
        }
        // Save (PUT): the FOR UPDATE existence lock must find the page.
        if (/FROM config\.page WHERE id = \$1 FOR UPDATE/i.test(text)) {
          return { rows: [{ id: PAGE_ID }] }
        }
        return { rows: [] }
      },
      release() {},
    }
    return {
      async query() { return { rows: [] } },
      async connect() { return client },
    } as unknown as FastifyInstance['pg']
  }

  async function buildPublishApp(): Promise<FastifyInstance> {
    const Fastify = (await import('fastify')).default
    const { configRoutes } = await import('./index.js')
    const { registerProblemErrorHandler } = await import('../../lib/error-handler.js')
    const app = Fastify()
    app.decorate('pg', publishFakePg())
    registerProblemErrorHandler(app)
    await app.register(configRoutes(), { prefix: '/api/config' })
    await app.ready()
    return app
  }

  async function token(roles: string[]): Promise<string> {
    const { issueToken } = await import('../../lib/auth.js')
    const { env } = await import('../../env.js')
    return issueToken('tester', env.JWT_SECRET, 3600, roles)
  }

  it('401 when no Bearer token is present (authPlugin)', async () => {
    const app = await buildPublishApp()
    const res = await app.inject({ method: 'POST', url: `/api/config/pages/${PAGE_ID}/publish` })
    expect(res.statusCode).toBe(401)
  })

  it('403 when an editor (write but not publish role) tries to publish', async () => {
    const app = await buildPublishApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/config/pages/${PAGE_ID}/publish`,
      headers: { authorization: `Bearer ${await token(['editor'])}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('403 when a viewer tries to publish', async () => {
    const app = await buildPublishApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/config/pages/${PAGE_ID}/publish`,
      headers: { authorization: `Bearer ${await token(['viewer'])}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('200 when an admin publishes (reaches the handler past the gate)', async () => {
    const app = await buildPublishApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/config/pages/${PAGE_ID}/publish`,
      headers: { authorization: `Bearer ${await token(['admin'])}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.id).toBe(PAGE_ID)
  })

  it('an editor CAN still save (PUT) — only publish is admin-gated', async () => {
    const app = await buildPublishApp()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/config/pages/${PAGE_ID}`,
      headers: { authorization: `Bearer ${await token(['editor'])}` },
      payload: { title: { ka: 'შენახვა', en: 'Save' } },
    })
    // The save reaches the handler (no role-gate rejection); the fake pg's connect
    // transaction yields a benign result. The point is it is NOT 401/403.
    expect(res.statusCode).toBe(200)
  })
})
