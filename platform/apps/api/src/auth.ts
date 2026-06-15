import fp from 'fastify-plugin'
import { verifyToken, type JwtPayload } from './lib/auth.js'
import { env } from './env.js'
import { HttpError } from './lib/http.js'

// Make the verified identity visible to downstream handlers, typed — no casts.
declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload?: JwtPayload
  }
}

// authPlugin — wrapped with fastify-plugin (fp) ON PURPOSE.
//
// fp makes this plugin transparent so its onRequest hook attaches to the PARENT
// scope rather than this plugin's own (empty) encapsulation context. Registered
// first inside configRoutes, the hook therefore cascades to every config
// sub-route registered after it — and ONLY those. Stats/health, in sibling
// scopes, are untouched. This mirrors the dbPlugin pattern in this codebase.
//
// Bearer JWT is validated fail-fast: a missing or invalid token throws
// HttpError(401), which the global error boundary maps to the { error, message }
// envelope. The verified payload is attached to the request for downstream use.
export const authPlugin = fp(async (app) => {
  app.addHook('onRequest', async (req) => {
    const raw = req.headers['authorization']
    if (!raw?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing authorization token')
    }
    const token = raw.slice('Bearer '.length)
    try {
      req.jwtPayload = verifyToken(token, env.JWT_SECRET)
    } catch (err) {
      throw new HttpError(401, err instanceof Error ? err.message : 'Invalid token')
    }
  })
})
