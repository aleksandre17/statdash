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
})

// Parsed from process.env (dotenv is loaded in index.ts before this module runs).
export const env = schema.parse(process.env)

export type Env = z.infer<typeof schema>
