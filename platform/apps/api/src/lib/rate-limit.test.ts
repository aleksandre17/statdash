import { describe, it, expect, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Env contract is parsed at import time — set required vars before importing.
process.env.DATABASE_URL   ??= 'postgres://test'
process.env.JWT_SECRET     ??= 'test-jwt-secret-at-least-32-chars-long!!'
process.env.ADMIN_USERNAME ??= 'admin'
process.env.ADMIN_PASSWORD ??= 'password1'
process.env.NODE_ENV        = 'test'

import { createFixedWindowLimiter } from './rate-limit.js'

describe('createFixedWindowLimiter (pure)', () => {
  it('allows up to the limit then blocks within the window', () => {
    const t = 1_000
    const lim = createFixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => t })
    expect(lim.check('ip').allowed).toBe(true)
    expect(lim.check('ip').allowed).toBe(true)
    expect(lim.check('ip').allowed).toBe(true)
    const blocked = lim.check('ip')
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    let t = 0
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 1_000, now: () => t })
    expect(lim.check('ip').allowed).toBe(true)
    expect(lim.check('ip').allowed).toBe(false)
    t = 1_001 // window elapsed
    expect(lim.check('ip').allowed).toBe(true)
  })

  it('keys are independent', () => {
    const lim = createFixedWindowLimiter({ limit: 1, windowMs: 60_000 })
    expect(lim.check('a').allowed).toBe(true)
    expect(lim.check('b').allowed).toBe(true) // different key, own budget
    expect(lim.check('a').allowed).toBe(false)
  })
})

// ── HTTP fitness — the login throttle ─────────────────────────────────────────
async function buildApp(): Promise<FastifyInstance> {
  const Fastify = (await import('fastify')).default
  const { registerProblemErrorHandler } = await import('./error-handler.js')
  const { registerRateLimiting, defaultBuckets } = await import('./rate-limit.js')
  const { createMetricsRegistry, registerHttpMetrics } = await import('./metrics.js')

  const app = Fastify()
  registerProblemErrorHandler(app)
  const metrics = createMetricsRegistry()
  registerHttpMetrics(metrics)
  registerRateLimiting(app, {
    metrics,
    buckets: defaultBuckets({ authPerMinute: 5, ingestPerMinute: 20, globalPerMinute: 1000 }),
  })
  // A stand-in for the real auth route (we only test the throttle, not the login).
  app.post('/api/auth', async () => ({ ok: true }))
  await app.ready()
  return app
}

describe('rate limiting — login throttle (API-11 fitness)', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await buildApp() })

  it('throttles the 6th login in the window with a 429 + Retry-After + problem+json', async () => {
    const hit = () => app.inject({ method: 'POST', url: '/api/auth', payload: { username: 'a', password: 'b' } })
    for (let i = 0; i < 5; i++) {
      expect((await hit()).statusCode).toBe(200)
    }
    const sixth = await hit()
    expect(sixth.statusCode).toBe(429)
    expect(sixth.headers['retry-after']).toBeDefined()
    expect(sixth.headers['content-type']).toContain('application/problem+json')
    const body = sixth.json()
    expect(body.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
  })
})
