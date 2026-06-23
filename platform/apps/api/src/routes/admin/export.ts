import type { FastifyPluginAsync } from 'fastify'
import { HttpError } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import type { ProvisioningManifest, PageProvision } from '../../provisioning/loader.js'

// ── exportRoutes — admin-guarded config → provisioning-manifest export [P2-5] ──
//
// The inverse of the provisioning loader: read the current published config out of
// config.* and emit it as a valid ProvisioningManifest JSON. This closes the
// GitOps loop — "export current config → commit to git → redeploy" — so the DB is
// never the only home of a config (SSOT can move back to the repo).
//
// Same two-layer guard as adminRoutes (JWT then admin role); 401 vs 403 are kept
// distinct (RFC 7235). Mounted under /api/admin so it shares that surface.

export const exportRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPlugin)

  app.addHook('onRequest', async (req) => {
    const roles = req.jwtPayload?.roles ?? []
    if (!roles.includes('admin')) throw new HttpError(403, 'Admin role required')
  })

  // GET /export/provisioning — every non-archived page + its latest version,
  // rendered as a ProvisioningManifest. Re-importing the result is a no-op
  // (idempotent round-trip: export → loader → unchanged).
  app.get('/export/provisioning', async (_req, reply) => {
    const { rows } = await app.pg.query<{
      slug: string
      title: Record<string, string>
      status: string
      config: unknown
      data_specs: unknown
    }>(
      `SELECT p.slug, p.title, p.status,
              v.config, v.data_specs
         FROM config.page p
         LEFT JOIN LATERAL (
           SELECT config, data_specs
             FROM config.page_version
            WHERE page_id = p.id
            ORDER BY version_number DESC
            LIMIT 1
         ) v ON true
        WHERE p.status != 'archived'
        ORDER BY p.slug`,
    )

    const pages: PageProvision[] = rows.map((r) => ({
      slug:      r.slug,
      title:     r.title,
      config:    r.config ?? {},
      dataSpecs: Array.isArray(r.data_specs) ? r.data_specs : [],
      status:    r.status === 'published' || r.status === 'draft' ? r.status : 'draft',
    }))

    const manifest: ProvisioningManifest = { version: 1, pages }

    // Content-Disposition so a browser hitting the URL downloads a ready-to-commit
    // file; the JSON body is identical either way.
    return reply
      .header('content-type', 'application/json; charset=utf-8')
      .header('content-disposition', 'attachment; filename="provisioning.json"')
      .send(manifest)
  })
}
