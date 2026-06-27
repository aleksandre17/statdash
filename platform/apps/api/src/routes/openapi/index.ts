// ── OpenAPI serve (API-16) ────────────────────────────────────────────────────
//
//  Harvests the live Fastify route table (an onRoute hook → the routing SSOT) and
//  serves the generated OpenAPI 3.1 document at GET /api/openapi.json. The doc is
//  assembled from that route list + the curated API_OPERATIONS (which reference the
//  real Zod boundary schemas), so it can never drift from what the server serves or
//  validates.
//
//  ORDERING: call registerOpenApi(app, …) EARLY at the app layer — BEFORE the
//  feature route registrations — so its onRoute hook (added to the root context,
//  where hooks cascade to every child plugin) captures every subsequently-
//  registered route. Routes registered before this call are not collected; in
//  index.ts only the error handler / cors / db precede it (none add app routes).

import type { FastifyInstance } from 'fastify'
import { buildOpenApiDocument, type RouteRef, type OpenApiInfo } from '../../lib/openapi/document.js'
import { API_OPERATIONS } from './operations.js'

export interface OpenApiServeOptions {
  readonly info: OpenApiInfo
}

/** Register the route collector + the GET /api/openapi.json endpoint. */
export function registerOpenApi(app: FastifyInstance, opts: OpenApiServeOptions): void {
  const routes: RouteRef[] = []

  // Collect every route registered after this hook (cascades into child plugins).
  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
    for (const method of methods) {
      routes.push({ method, url: routeOptions.url })
    }
  })

  // GET /api/openapi.json — the generated contract. Built per request (cheap; the
  // route set is fixed after boot) so it always reflects the registered routes.
  app.get('/api/openapi.json', async (_req, reply) => {
    const doc = buildOpenApiDocument({ info: opts.info, routes, operations: API_OPERATIONS })
    return reply.header('content-type', 'application/json; charset=utf-8').send(doc)
  })
}
