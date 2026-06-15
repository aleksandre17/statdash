import type { FastifyPluginAsync } from 'fastify'
import { authPlugin } from '../../auth.js'
import { pagesRoutes } from './pages.js'
import { dataSourcesRoutes } from './data-sources.js'
import { dataSpecsRoutes } from './data-specs.js'
import { siteRoutes } from './site.js'
import { navRoutes } from './nav.js'

// config.* schema — the Constructor's persistence surface (Layers 1/2/3).
export const configRoutes: FastifyPluginAsync = async (app) => {
  // Guard every config sub-route with Bearer-JWT. authPlugin is fp-wrapped, so
  // its onRequest hook attaches to this scope and cascades to all routes
  // registered after it. Must be first — registration order is hook order.
  await app.register(authPlugin)
  await app.register(pagesRoutes, { prefix: '/pages' })
  await app.register(dataSourcesRoutes, { prefix: '/data-sources' })
  await app.register(dataSpecsRoutes, { prefix: '/data-specs' })
  await app.register(siteRoutes, { prefix: '/site' })
  await app.register(navRoutes, { prefix: '/nav' })
}
