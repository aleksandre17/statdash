import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ok, parseBody, HttpError } from '../../lib/http.js'
import { hasAdminUser, createUser } from '../../lib/users.js'

// ── setupRoutes — first-admin bootstrap [P2-2] ────────────────────────────────
//
// POST /setup creates the very first admin user. It is intentionally UNAUTHENTICATED
// (there is no admin yet to authenticate as) but self-disabling: the instant an
// enabled admin exists in config.user, it returns 409 forever. This removes the
// need to run a seed script by hand to stand up the first identity.
//
// MOUNTED OUTSIDE adminRoutes on purpose: adminRoutes' JWT + admin-role guard
// cascades to everything in its scope, which would make a chicken-and-egg lock
// (you'd need an admin token to create the first admin). This sibling scope has
// no such guard — its ONLY protection is the zero-admin precondition, which is
// the correct gate for a bootstrap endpoint.
//
// Idempotency / race: createUser hits the UNIQUE(username) constraint, so two
// concurrent setup calls cannot both win; the loser surfaces as a 409-class
// conflict from PG. The hasAdminUser check is the fast, friendly path.

const SetupBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8),
})

export const setupRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (req, reply) => {
    if (await hasAdminUser(app.pg)) {
      throw new HttpError(409, 'Admin user already exists; setup is closed')
    }

    const { username, password } = parseBody(SetupBody, req.body)
    const user = await createUser(app.pg, username, password, ['admin'])
    return reply.status(201).send(ok(user))
  })
}
