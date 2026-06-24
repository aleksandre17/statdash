import type { FastifyPluginAsync } from 'fastify'
import type { SiteConfigResponse } from '@statdash/contracts'
import { z } from 'zod'
import { ok, parseBody } from '../../lib/http.js'

// site_config is typed key/value JSONB — the body is an open map of settings
// (name, default_locale, theme_overrides, …). Extensible without migration.
const SiteBody = z.record(z.unknown())

// Active-locale projection from the SSOT registry (config.locale, V13). The
// panel's locale editor reads these instead of hardcoding ['ka','en'] (I18N-4).
// activeLocales is the ordered active set; defaultLocale is the is_default row,
// falling back to the first active code so the field is always populated. We
// READ this from config.locale on every GET — it is NEVER duplicated into the
// site_config blob, so the locale set has exactly one home (Law 1 / SSOT).
interface LocaleRow { code: string; is_default: boolean }

export const siteRoutes: FastifyPluginAsync = async (app) => {
  // GET / — collapse the key/value rows back into one settings object, then
  // layer the config.locale projection on top (activeLocales / defaultLocale).
  app.get('/', async () => {
    const [{ rows: settingsRows }, { rows: localeRows }] = await Promise.all([
      app.pg.query(`SELECT key, value FROM config.site_config`),
      // is_active set, in display order — ord first, code as a stable tiebreaker.
      app.pg.query<LocaleRow>(
        `SELECT code, is_default
           FROM config.locale
          WHERE is_active
          ORDER BY ord, code`,
      ),
    ])

    const settings = Object.fromEntries(
      (settingsRows as Array<{ key: string; value: unknown }>).map((r) => [r.key, r.value]),
    )

    const activeLocales = localeRows.map((r) => r.code)
    // is_default code; fall back to the first active code when none is flagged.
    const defaultLocale =
      localeRows.find((r) => r.is_default)?.code ?? activeLocales[0] ?? ''

    const body: SiteConfigResponse = { ...settings, activeLocales, defaultLocale }
    return ok(body)
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
