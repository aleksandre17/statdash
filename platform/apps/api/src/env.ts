import { z } from 'zod'

// Environment contract — fail-fast on boot if anything required is missing
// or malformed (no silent undefined leaking into the DB connection string).
const schema = z.object({
  PORT:         z.coerce.number().default(3001),
  HOST:         z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1), // postgres://user:pass@pgbouncer:5432/statdash
  CORS_ORIGIN:  z.string().default('http://localhost:5175'),
  NODE_ENV:     z.enum(['development', 'production', 'test']).default('development'),
  // Auth — symmetric-key JWT + single admin credential (Constructor write access).
  JWT_SECRET:     z.string().min(32), // ≥32 chars for HMAC-SHA256 key strength
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  // Embed signing — HMAC-SHA256 secret for snapshot embed tokens (N38). The dev
  // default keeps local boot frictionless; production MUST override it (the value
  // is the only thing standing between a leaked token and a forged one).
  EMBED_SECRET:   z.string().min(1).default('dev-secret-change-in-prod'),
  // P2-5 file-based provisioning (GitOps). DIR is scanned on boot for *.json /
  // *.yaml / *.yml config; DRY_RUN logs the planned upserts without writing (CI
  // validation). 12-Factor: both are config, parsed once here, never read ad-hoc.
  PROVISIONING_DIR:     z.string().default('./provisioning'),
  PROVISIONING_DRY_RUN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

// Parsed from process.env (dotenv is loaded in index.ts before this module runs).
export const env = schema.parse(process.env)

export type Env = z.infer<typeof schema>
