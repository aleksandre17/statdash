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
