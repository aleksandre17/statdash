import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, parseBody, parseParams, HttpError, notFound } from '../../lib/http.js'
import { authPlugin } from '../../auth.js'
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  findUserByUsername,
} from '../../lib/users.js'

// ── usersRoutes — admin-guarded user management CRUD [P2-2] ───────────────────
//
// Same two-layer guard as exportRoutes (JWT then admin role), self-contained in
// this child scope so it is independently testable. 401 vs 403 kept distinct
// (RFC 7235): 401 = no/invalid token, 403 = valid token but not an admin.

const KNOWN_ROLES = ['admin', 'editor', 'viewer'] as const

// roles must be a non-empty set drawn from the known RBAC vocabulary. Rejecting
// unknown roles at the boundary keeps the DB CHECK (cardinality > 0) from being
// the only line of defence and prevents typo'd roles ("admln") that silently
// grant nothing — fail-fast at the edge.
const RolesField = z
  .array(z.enum(KNOWN_ROLES))
  .min(1)
  .transform((r) => [...new Set(r)]) // de-dupe; the array is a set semantically

const CreateUserBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
  roles:    RolesField,
})

// PATCH is a partial update: roles and/or enabled. At least one must be present —
// an empty patch is a client mistake, not a no-op success.
const PatchUserBody = z
  .object({
    roles:   RolesField.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((b) => b.roles !== undefined || b.enabled !== undefined, {
    message: 'Provide at least one of: roles, enabled',
  })

const IdParam = z.object({ id: z.string().uuid() })

export const usersRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authPlugin)

  app.addHook('onRequest', async (req) => {
    const roles = req.jwtPayload?.roles ?? []
    if (!roles.includes('admin')) throw new HttpError(403, 'Admin role required')
  })

  // GET / — list all users (never returns password hashes; listUsers omits them).
  app.get('/', async () => ok(await listUsers(app.pg)))

  // POST / — create a user. Duplicate username → 409 (the UNIQUE constraint also
  // guards this; we check first for a clean error instead of a raw PG fault).
  app.post('/', async (req, reply) => {
    const { username, password, roles } = parseBody(CreateUserBody, req.body)

    const existing = await findUserByUsername(app.pg, username)
    if (existing) throw new HttpError(409, 'Username already exists')

    const user = await createUser(app.pg, username, password, roles)
    return reply.status(201).send(ok(user))
  })

  // PATCH /:id — update roles and/or enabled. 404 if the id is unknown.
  app.patch('/:id', async (req) => {
    const { id } = parseParams(IdParam, req.params)
    const patch = parseBody(PatchUserBody, req.body)

    const updated = await updateUser(app.pg, id, patch)
    if (!updated) throw notFound('User')
    return ok(updated)
  })

  // DELETE /:id — remove a user. An admin may not delete THEIR OWN account
  // (locking yourself out / removing the last admin by accident): 409. Self is
  // identified by the uid claim minted at login (env-bootstrap tokens have no
  // uid and so can never match a real row — they cannot reach here anyway, the
  // env admin is not a config.user row).
  app.delete('/:id', async (req, reply) => {
    const { id } = parseParams(IdParam, req.params)

    if (req.jwtPayload?.uid === id) {
      throw new HttpError(409, 'Cannot delete your own account')
    }

    const removed = await deleteUser(app.pg, id)
    if (!removed) throw notFound('User')
    return reply.status(204).send()
  })
}
