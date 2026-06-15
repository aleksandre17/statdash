import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, parseBody } from '../../lib/http.js'

// site_config is typed key/value JSONB — the body is an open map of settings
// (name, default_locale, theme_overrides, …). Extensible without migration.
const SiteBody = z.record(z.unknown())

export const siteRoutes: FastifyPluginAsync = async (app) => {
  // GET / — collapse the key/value rows back into one settings object.
  app.get('/', async () => {
    const { rows } = await app.pg.query(
      `SELECT key, value FROM config.site_config`,
    )
    return ok(
      Object.fromEntries(
        (rows as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
      ),
    )
  })

  // PUT / — upsert each supplied key. One transaction so a multi-key save is
  // all-or-nothing (no half-applied site identity).
  app.put('/', async (req) => {
    const body = parseBody(SiteBody, req.body)
    const entries = Object.entries(body)

    const client = await app.pg.connect()
    try {
      await client.query('BEGIN')
      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO config.site_config (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
          [key, JSON.stringify(value)],
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally {
      client.release()
    }

    return ok(body)
  })
}
