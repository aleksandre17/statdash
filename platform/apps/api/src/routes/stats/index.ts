import type { FastifyPluginAsync } from 'fastify'
import type { AuditLogger } from '../../lib/audit-log.js'
import { classifiersRoutes } from './classifiers.js'
import { datasetsRoutes } from './datasets.js'
import { observationsRoutes } from './observations.js'
import { releasesRoutes } from './releases.js'

// stats.* schema — read-only surface for the Engine + Constructor preview, plus
// the vintage-as-release sub-surface (ADR-0025): its GET reads are public like the
// rest of stats; its curator POSTs are JWT + write-role gated inside the plugin.
// audit is injected (port) so curator open/attach/publish land on the governance
// trail [N41] — same factory idiom as configRoutes / ingestRoutes.
export const statsRoutes = (audit?: AuditLogger): FastifyPluginAsync => async (app) => {
  await app.register(classifiersRoutes, { prefix: '/classifiers' })
  await app.register(datasetsRoutes, { prefix: '/datasets' })
  await app.register(observationsRoutes, { prefix: '/observations' })
  await app.register(releasesRoutes(audit), { prefix: '/releases' })
}
