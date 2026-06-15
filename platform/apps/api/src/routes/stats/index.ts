import type { FastifyPluginAsync } from 'fastify'
import { classifiersRoutes } from './classifiers.js'
import { datasetsRoutes } from './datasets.js'
import { observationsRoutes } from './observations.js'

// stats.* schema — read-only surface for the Engine + Constructor preview.
export const statsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(classifiersRoutes, { prefix: '/classifiers' })
  await app.register(datasetsRoutes, { prefix: '/datasets' })
  await app.register(observationsRoutes, { prefix: '/observations' })
}
