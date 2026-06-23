import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, HttpError, parseQuery } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import { exportRoutes } from './export.js'
import { usersRoutes } from './users.js'
import type { AuditLogger } from '../../lib/audit-log.js'

// ── adminRoutes — JWT-guarded + role-guarded admin surface [N41] ──────────────
//
// Two-layer guard, fail-fast in order:
//   1. authPlugin (registered first) — Bearer JWT or 401. Populates req.jwtPayload.
//   2. requireAdmin onRequest hook   — JWT present but lacks the 'admin' role → 403.
//
// 401 vs 403 is deliberate (RFC 7235 / correct status semantics): 401 = "who are
// you?" (no/invalid token), 403 = "I know who you are, you may not" (valid token,
// wrong role). Tunnelling both through one code would lie to the client.
//
// The AuditLogger is injected (port, not module global) so the same instance the
// producers write to is the one this route reads — mirrors the snapshot-store
// wiring in index.ts.

// limit: default 50, capped at 500 to bound response size. coerce so ?limit=10
// (a string in the query) becomes a number; reject non-positive / non-integer.
const AuditLogQuery = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50),
})

export const adminRoutes = (audit: AuditLogger): FastifyPluginAsync => async (app) => {
  await app.register(authPlugin)

  // Role gate — runs after authPlugin's hook, so jwtPayload is already verified.
  app.addHook('onRequest', async (req) => {
    const roles = req.jwtPayload?.roles ?? []
    if (!roles.includes('admin')) {
      throw new HttpError(403, 'Admin role required')
    }
  })

  // GET /audit-log — most-recent-first audit entries (default 50, max 500).
  app.get('/audit-log', async (req) => {
    const { limit } = parseQuery(AuditLogQuery, req.query)
    return ok(audit.recent(limit))
  })

  // /export/* — config → provisioning-manifest export (P2-5). Registered in a
  // child scope: it owns its own auth + admin guard, so it is self-contained and
  // independently testable, while still living under the /api/admin prefix.
  await app.register(exportRoutes)

  // /users/* — user-management CRUD (P2-2). Own child scope, re-declares the same
  // JWT + admin guard so it is self-contained and independently testable. NOTE:
  // the first-admin bootstrap (POST /api/admin/setup) is deliberately NOT here —
  // it must escape the admin guard and is registered unguarded in index.ts.
  await app.register(usersRoutes, { prefix: '/users' })
}
