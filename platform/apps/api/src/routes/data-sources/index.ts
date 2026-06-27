// ── Public data-sources read surface (P3-4) ──────────────────────────────────
//
//  GET /api/data-sources — the UNGUARDED, minimal-projection read the geostat
//  client calls at boot to build its store manifest from config.data_source.
//
//  WHY a separate route from config/data-sources.ts (the admin CRUD):
//    config/* is Bearer-JWT guarded (the Constructor's authenticated surface).
//    The public dashboard has no token at boot, yet needs to know which data
//    sources to wire. Rather than weaken the admin guard, this is a sibling
//    scope (mounted at /api/data-sources in index.ts) — same isolation pattern
//    as setupRoutes / embedRoutes. ISP: it exposes ONLY the read the client
//    needs, never create/update/delete.
//
//  WHY only status='connected' and a trimmed projection:
//    Least-privilege at the boundary. An 'idle' / 'error' / 'pending' source is
//    not safe to bind a live store to, so it is filtered server-side (the client
//    never sees, nor decides about, half-provisioned connections). id and status
//    are internal governance fields — omitted so the public surface stays minimal
//    (no leak of internal identifiers / lifecycle state).

import type { FastifyPluginAsync } from 'fastify'
import { ok } from '../../lib/http.js'
import { redactDataSourceConfig } from '../../lib/redact.js'

/** Public projection of a connected data source — the minimal surface the client binds a store to. */
export interface PublicDataSourceRow {
  name:   string
  type:   string
  url:    string | null
  config: Record<string, unknown>
}

export const publicDataSourcesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/data-sources — connected sources only, minimal projection.
  // No auth: this is the boot-time read for the public dashboard. The SELECT
  // enforces the status filter and column projection; the config JSONB is then
  // REDACTED (API-08) at this serialization boundary so no credential-bearing
  // field (the auth envelope / any token/secret/apiKey) ever reaches the anonymous
  // client — defense in depth even though today's sources carry no secrets.
  app.get('/', async () => {
    const { rows } = await app.pg.query<PublicDataSourceRow>(
      `SELECT name, type, url, config
         FROM config.data_source
        WHERE status = 'connected'
        ORDER BY name ASC`,
    )
    return ok(rows.map((r) => ({ ...r, config: redactDataSourceConfig(r.config) })))
  })
}
