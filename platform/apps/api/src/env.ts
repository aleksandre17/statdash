import { z } from 'zod'

// Secret-strength bar shared by every HMAC/JWT key in this service: ≥32 chars so
// the key has full SHA-256 entropy. Named once (SSOT) — JWT_SECRET and the
// production EMBED_SECRET gate both reference it, so the bar can't drift apart.
const SECRET_MIN_LEN = 32

// The dev-only fallback for EMBED_SECRET. Kept as a named constant so the prod
// gate can reject *exactly this value* — shipping the well-known dev secret to
// production is as forgeable as shipping no secret at all.
const EMBED_DEV_DEFAULT = 'dev-secret-change-in-prod'

// Environment contract — fail-fast on boot if anything required is missing
// or malformed (no silent undefined leaking into the DB connection string).
const schema = z.object({
  PORT:         z.coerce.number().default(3001),
  HOST:         z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1), // postgres://user:pass@pgbouncer:5432/statdash
  // CORS allow-list origin. In the single-origin reverse-proxy topology (ADR
  // adr-deployment-topology) the browser issues NO cross-origin requests, so CORS
  // must be OFF in production — @fastify/cors disables it entirely with the boolean
  // `origin: false` (no Access-Control-Allow-Origin emitted), which is correct for
  // same-origin. But this var is a string, so we accept a sentinel ('false' or '')
  // that maps to the boolean off-switch (see corsOrigin() below). Never '*': a
  // wildcard re-opens the cross-origin surface the proxy topology exists to close.
  CORS_ORIGIN:  z.string().default('http://localhost:5175'),
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  // Auth — symmetric-key JWT + single admin credential (Constructor write access).
  JWT_SECRET:     z.string().min(SECRET_MIN_LEN), // ≥32 chars for HMAC-SHA256 key strength
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  // Embed signing — HMAC-SHA256 secret for snapshot embed tokens (N38). The dev
  // default keeps local boot frictionless; production MUST override it (the value
  // is the only thing standing between a leaked token and a forged one). The
  // production strength/override gate is enforced cross-field in superRefine below
  // (it depends on NODE_ENV, so it can't live on the field alone).
  EMBED_SECRET:   z.string().min(1).default(EMBED_DEV_DEFAULT),
  // P2-5 file-based provisioning (GitOps). DIR is scanned on boot for *.json /
  // *.yaml / *.yml config; DRY_RUN logs the planned upserts without writing (CI
  // validation). 12-Factor: both are config, parsed once here, never read ad-hoc.
  PROVISIONING_DIR:     z.string().default('./provisioning'),
  PROVISIONING_DRY_RUN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // ── Rate limiting + load shedding (API-11) — per-IP budgets, 12-Factor config.
  // Defaults: tight on login (anti-brute-force), moderate on the expensive ingest
  // upload, generous global so the public reads tolerate a real dashboard's burst.
  RATE_LIMIT_AUTH_PER_MIN:   z.coerce.number().int().positive().default(5),
  RATE_LIMIT_INGEST_PER_MIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(300),
  // ── Ingest bulkhead (API-11/API-14) — bounded concurrency on the synchronous
  // canonical drive. At most N uploads run at once; a small queue absorbs a burst;
  // beyond that, uploads are load-shed (429) rather than saturating the pg pool.
  INGEST_MAX_CONCURRENT:     z.coerce.number().int().positive().default(2),
  INGEST_MAX_QUEUE:          z.coerce.number().int().nonnegative().default(8),
})
  // Production secret gate — fail-fast, LOUD, at boot (not at first embed request).
  //
  // EMBED_SECRET is the only secret that carries a dev default (the others —
  // JWT_SECRET, ADMIN_PASSWORD, DATABASE_URL — have no default and so already
  // fail-fast in every environment). A dev default is frictionless locally but
  // FORGEABLE in production: an unset (→ well-known default) or weak secret lets
  // anyone mint a valid embed token. So in production we demand the same bar as
  // JWT_SECRET — present, ≥32 chars, and never the shipped dev default.
  //
  // This is a cross-field invariant (the requirement depends on NODE_ENV), which
  // is why it lives here rather than on the field. Encoded as a class-level rule:
  // any future secret-with-dev-default can be added to PROD_REQUIRED_SECRETS and
  // inherits the identical gate — the seam, not a per-secret patch.
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return

    const PROD_REQUIRED_SECRETS = [
      { key: 'EMBED_SECRET' as const, value: cfg.EMBED_SECRET, devDefault: EMBED_DEV_DEFAULT },
    ]

    for (const { key, value, devDefault } of PROD_REQUIRED_SECRETS) {
      if (value === devDefault) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be set in production (the dev default is forgeable). Provide a strong secret of ≥${SECRET_MIN_LEN} chars.`,
        })
      } else if (value.length < SECRET_MIN_LEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be ≥${SECRET_MIN_LEN} chars in production for HMAC-SHA256 key strength (got ${value.length}).`,
        })
      }
    }
  })

// Parsed from process.env (dotenv is loaded in index.ts before this module runs).
export const env = schema.parse(process.env)

export type Env = z.infer<typeof schema>

// The sentinel values of CORS_ORIGIN that mean "no cross-origin allowance" —
// the same-origin proxy topology needs none. Named once (SSOT) so the mapping
// can't drift from the .env.prod that sets it.
const CORS_DISABLED_SENTINELS = new Set(['false', ''])

/**
 * Maps the string CORS_ORIGIN contract onto the `origin` option @fastify/cors
 * actually wants. A sentinel ('false' or empty) → boolean `false`, which makes
 * @fastify/cors emit NO CORS headers at all (correct for same-origin); any other
 * value is a real allow-list origin passed through verbatim.
 *
 * Why a function and not a transform on the field: the field stays a plain
 * `z.string()` (so `.env` files, examples and the existing contract are
 * unchanged), and the string→boolean widening lives at the single seam that
 * consumes it (index.ts), not smeared across the schema.
 */
export function corsOrigin(value: string = env.CORS_ORIGIN): string | false {
  return CORS_DISABLED_SENTINELS.has(value.trim()) ? false : value
}
