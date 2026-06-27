// ── Rate limiting + load shedding (API-11) ────────────────────────────────────
//
//  The api had NO rate limiting anywhere: the login was brute-forceable, the
//  public reads were a cheap DoS amplifier. This adds a per-IP fixed-window
//  limiter behind ONE onRequest seam, with a bucket table so a route gets a
//  tighter budget than the global default (OCP: a new bucket = one table entry,
//  no hook edit).
//
//  WHY hand-rolled (no @fastify/rate-limit): the zero-supply-chain stance of the
//  hand-rolled JWT/HMAC. A fixed-window counter per (bucket, ip) is the right,
//  simple algorithm for brute-force + amplification defence; it is exact at the
//  window boundary cost of a small burst, which is acceptable for these budgets
//  (the alternative, a sliding log, costs more memory for no security gain here).
//
//  WHY in-process (not Redis): single-instance today. The Limiter is a PORT shape
//  (check(key)) so a Redis-backed token bucket can replace it for multi-instance
//  without touching the plugin — the API-readiness law. Documented as the scale
//  trigger, not built speculatively (YAGNI).
//
//  429 is emitted through the RFC 9457 Problem registry (too-many-requests) with a
//  Retry-After header (set centrally in error-handler.ts from retryAfterSeconds).
//  Every rejection increments the rate_limit_rejections_total metric, by bucket —
//  dogfooding the telemetry port (API-10).

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { tooManyRequests } from './problem.js'
import type { MetricsPort } from './metrics.js'
import { METRIC } from './metrics.js'

// ── The pure limiter (testable without Fastify) ───────────────────────────────

export interface LimitDecision {
  readonly allowed: boolean
  /** Requests left in the current window (0 when blocked). */
  readonly remaining: number
  /** Seconds until the window resets — the Retry-After value when blocked. */
  readonly retryAfterSeconds: number
}

export interface Limiter {
  check(key: string): LimitDecision
}

interface WindowState {
  count: number
  /** Epoch ms when this window resets. */
  resetAt: number
}

export interface FixedWindowOptions {
  /** Max requests per window per key. */
  readonly limit: number
  /** Window length in milliseconds. */
  readonly windowMs: number
  /** Injectable clock (tests). Defaults to Date.now. */
  readonly now?: () => number
}

// Bound memory under a distinct-key flood (many IPs): when the table grows past
// this, expired windows are swept on the next check. A fixed-window entry is tiny
// and short-lived, so this cap is generous.
const SWEEP_THRESHOLD = 10_000

/**
 * Fixed-window per-key limiter. Lazy expiry: a key whose window has elapsed is
 * reset on its next check. Memory is bounded by a periodic sweep of expired keys.
 */
export function createFixedWindowLimiter(opts: FixedWindowOptions): Limiter {
  const { limit, windowMs } = opts
  const now = opts.now ?? Date.now
  const windows = new Map<string, WindowState>()

  const sweep = (t: number): void => {
    for (const [k, w] of windows) {
      if (w.resetAt <= t) windows.delete(k)
    }
  }

  return {
    check(key) {
      const t = now()
      if (windows.size > SWEEP_THRESHOLD) sweep(t)

      let w = windows.get(key)
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + windowMs }
        windows.set(key, w)
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((w.resetAt - t) / 1000))
      if (w.count >= limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds }
      }
      w.count += 1
      return { allowed: true, remaining: limit - w.count, retryAfterSeconds }
    },
  }
}

// ── Bucket table — route → budget ─────────────────────────────────────────────
//
//  Each bucket pairs a matcher with its own limiter. The FIRST matching bucket
//  applies; an unmatched request is unlimited (there is always a catch-all
//  `default` bucket last, so in practice everything is covered). Ordering is
//  significant: specific buckets (auth, ingest) precede the catch-all.

export interface RateBucket {
  /** Stable name — the metric label + the limiter key prefix. */
  readonly name: string
  /** True when this bucket governs the request. */
  readonly match: (req: FastifyRequest) => boolean
  readonly limiter: Limiter
}

export interface RateLimitConfig {
  /** Per-IP login budget — anti-brute-force on POST /api/auth. */
  readonly authPerMinute: number
  /** Per-IP ingest-upload budget — pairs with the bulkhead (concurrency). */
  readonly ingestPerMinute: number
  /** Per-IP global default — protects the public reads from amplification. */
  readonly globalPerMinute: number
  /** Injectable clock (tests). */
  readonly now?: () => number
}

/** Does the request target the login route (POST …/api/auth)? */
function isLogin(req: FastifyRequest): boolean {
  return req.method === 'POST' && /\/api\/auth\/?$/.test(req.url.split('?')[0])
}

/** Does the request target the canonical ingest upload (POST …/api/ingest/canonical)? */
function isIngestUpload(req: FastifyRequest): boolean {
  return req.method === 'POST' && req.url.split('?')[0].includes('/api/ingest/canonical')
}

/**
 * Build the standard bucket table from a tunable config. The catch-all `default`
 * bucket is appended last so every request has a budget.
 */
export function defaultBuckets(cfg: RateLimitConfig): RateBucket[] {
  const win = 60_000
  const mk = (limit: number): Limiter =>
    createFixedWindowLimiter({ limit, windowMs: win, now: cfg.now })
  return [
    { name: 'auth',    match: isLogin,        limiter: mk(cfg.authPerMinute) },
    { name: 'ingest',  match: isIngestUpload, limiter: mk(cfg.ingestPerMinute) },
    { name: 'default', match: () => true,     limiter: mk(cfg.globalPerMinute) },
  ]
}

// ── The Fastify seam ──────────────────────────────────────────────────────────

export interface RateLimitDeps {
  readonly buckets: RateBucket[]
  readonly metrics: MetricsPort
  /** Override the client key (default: req.ip). */
  readonly keyOf?: (req: FastifyRequest) => string
}

/**
 * Register the global rate-limit onRequest hook. Install BEFORE routes (root app)
 * so it governs every surface. The /metrics and /health endpoints are exempt
 * (operational scrape/probe must never be throttled).
 */
export function registerRateLimiting(app: FastifyInstance, deps: RateLimitDeps): void {
  const { buckets, metrics } = deps
  const keyOf = deps.keyOf ?? ((req) => req.ip)

  app.addHook('onRequest', async (req) => {
    const path = req.url.split('?')[0]
    if (path === '/metrics' || path === '/health') return

    const bucket = buckets.find((b) => b.match(req))
    if (!bucket) return

    const decision = bucket.limiter.check(`${bucket.name}:${keyOf(req)}`)
    if (!decision.allowed) {
      metrics.incCounter(METRIC.rateLimited, { bucket: bucket.name })
      throw tooManyRequests(
        `Rate limit exceeded for ${bucket.name}; retry in ${decision.retryAfterSeconds}s`,
        decision.retryAfterSeconds,
        'RATE_LIMITED',
      )
    }
  })
}
