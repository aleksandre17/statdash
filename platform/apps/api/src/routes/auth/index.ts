import type { FastifyPluginAsync } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ok, parseBody, HttpError } from '../../lib/http.js'
import { issueToken } from '../../lib/auth.js'
import { env } from '../../env.js'
import { findUserByUsername, verifyPassword, hasAdminUser } from '../../lib/users.js'

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

// Constant-time string equality (used only on the env-var bootstrap path).
// Comparing UTF-8 byte buffers; the length guard short-circuits before
// timingSafeEqual (which throws on length mismatch). A differing length is
// already a mismatch, so this leaks no more than "wrong".
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Public login route — the one config-adjacent endpoint that is NOT JWT-guarded.
// Exchanges credentials for a signed JWT.
//
// IDENTITY SOURCE (P2-2): real DB-backed users in config.user, looked up by
// username. The single hardcoded env-var admin survives ONLY as a bootstrap
// fallback, active exclusively while no admin user exists in the DB — so a fresh
// install can still log in, and the moment a real admin is created the env
// credential is ignored (no permanent backdoor).
//
// 401 vs 403 (RFC 7235 / correct status semantics): a missing user OR a wrong
// password both return the SAME 401 (no username enumeration). A disabled
// account returns 403 — we will not say "right password" but we do say "this
// account may not log in", which is the honest distinction once the password is
// known correct.
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (req) => {
    const { username, password } = parseBody(LoginBody, req.body)

    // Bootstrap mode: no admin user yet → accept the env credential and mint an
    // admin token. Once an admin exists in config.user, this branch is dead and
    // the env vars are inert (the DB is the single source of truth for identity).
    if (!(await hasAdminUser(app.pg))) {
      const userMatch = safeEqual(username, env.ADMIN_USERNAME)
      const passMatch = safeEqual(password, env.ADMIN_PASSWORD)
      if (!userMatch || !passMatch) throw new HttpError(401, 'Invalid credentials')
      return ok({ token: issueToken(username, env.JWT_SECRET, undefined, ['admin']) })
    }

    // Normal mode: look the user up by username. A missing user still runs a
    // password verification against no hash? No — instead we return the SAME 401
    // the wrong-password branch returns, so the response is indistinguishable and
    // the username is not enumerable. (verifyPassword on a bogus digest is also
    // constant-false, but skipping the DB-absent case avoids a needless KDF run.)
    const user = await findUserByUsername(app.pg, username)
    if (!user) throw new HttpError(401, 'Invalid credentials')

    const passOk = await verifyPassword(user.passwordHash, password)
    if (!passOk) throw new HttpError(401, 'Invalid credentials')

    // Password is correct — now authorize the account state. A disabled account
    // is a known identity that may not proceed: 403, not 401.
    if (!user.enabled) throw new HttpError(403, 'Account disabled')

    return ok({
      token: issueToken(user.username, env.JWT_SECRET, undefined, user.roles, user.id),
    })
  })
}
