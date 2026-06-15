import type { FastifyPluginAsync } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ok, parseBody, HttpError } from '../../lib/http.js'
import { issueToken } from '../../lib/auth.js'
import { env } from '../../env.js'

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// Constant-time string equality. Comparing UTF-8 byte buffers; the length guard
// short-circuits before timingSafeEqual (which throws on length mismatch). A
// differing length is already a mismatch, so this leaks no more than "wrong".
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Public login route — the one config-adjacent endpoint that is NOT JWT-guarded.
// Exchanges admin credentials (from env) for a signed JWT.
export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST / — credentials → token. Both comparisons run unconditionally (no &&
  // short-circuit) so the work done does not reveal which field was wrong.
  app.post('/', async (req) => {
    const { username, password } = parseBody(LoginBody, req.body)

    const userMatch = safeEqual(username, env.ADMIN_USERNAME)
    const passMatch = safeEqual(password, env.ADMIN_PASSWORD)
    if (!userMatch || !passMatch) throw new HttpError(401, 'Invalid credentials')

    return ok({ token: issueToken(username, env.JWT_SECRET) })
  })
}
