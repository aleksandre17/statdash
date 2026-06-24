// ── DB-gated — GET /api/config/site projects config.locale (I18N-4) ───────────
//
// CONTRACT: against a fresh-migrated DB (V13 seeds config.locale), the site-config
// GET response carries an ORDERED activeLocales (the is_active set, ORDER BY ord,
// code) and a defaultLocale (the is_default code), both projected straight from
// config.locale — the SSOT registry, NOT the site_config blob. This is the field
// the Constructor panel's locale editor reads instead of hardcoding ['ka','en'].
//
// The site route is JWT-guarded (configRoutes registers authPlugin), so the test
// boots the full config scope and presents an admin Bearer token — exactly the
// path the panel uses. No mocks: real dbPlugin (app.pg) + real route + real SQL,
// so the projection + ordering are exercised against the seeded registry.
//
// Requires a live migrated DB → describe.skip when DATABASE_URL is absent (the
// bootstrap-parity / upsert.scd2 pattern): a no-op locally, a real gate in CI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time (env.ts); set required vars BEFORE any
// import that reads it. DATABASE_URL is the real gate — only present in CI.
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

const DATABASE_URL = process.env.DATABASE_URL
const suite = DATABASE_URL ? describe : describe.skip

interface SiteResponse {
  activeLocales: string[]
  defaultLocale: string
  [key: string]: unknown
}

suite('GET /api/config/site — config.locale projection (I18N-4)', () => {
  let app: FastifyInstance
  let auth: string

  beforeAll(async () => {
    const Fastify = (await import('fastify')).default
    const { dbPlugin } = await import('../../db.js')
    const { configRoutes } = await import('./index.js')
    const { issueToken } = await import('../../lib/auth.js')
    const { env } = await import('../../env.js')

    app = Fastify()
    await app.register(dbPlugin)
    await app.register(configRoutes(), { prefix: '/api/config' })
    await app.ready()

    auth = `Bearer ${issueToken('tester', env.JWT_SECRET, 3600, ['admin'])}`
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  it('returns activeLocales ordered by (ord, code) from config.locale WHERE is_active', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/site/',
      headers: { authorization: auth },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data as SiteResponse

    // Expected order computed straight from the SSOT registry — the response must
    // equal it exactly (same WHERE + ORDER BY the route runs).
    const { rows } = await app.pg.query<{ code: string }>(
      `SELECT code FROM config.locale WHERE is_active ORDER BY ord, code`,
    )
    const expected = rows.map((r) => r.code)

    expect(Array.isArray(body.activeLocales)).toBe(true)
    expect(body.activeLocales).toEqual(expected)
    // V13 seeds 'ka' (ord 1) before 'en' (ord 2) — proves it is the registry, not
    // a hardcoded set, and that ordering is honoured.
    expect(body.activeLocales).toEqual(['ka', 'en'])
  })

  it('returns defaultLocale = the is_default code in config.locale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/config/site/',
      headers: { authorization: auth },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data as SiteResponse

    const { rows } = await app.pg.query<{ code: string }>(
      `SELECT code FROM config.locale WHERE is_default`,
    )
    const flagged = rows[0]?.code
    // V13 flags 'ka' as the default; when none is flagged the route falls back to
    // the first active code (still a config.locale projection, never hardcoded).
    expect(body.defaultLocale).toBe(flagged ?? body.activeLocales[0])
    expect(body.activeLocales).toContain(body.defaultLocale)
  })
})
