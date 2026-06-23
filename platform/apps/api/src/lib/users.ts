import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

// ── User repository + password hashing (P2-2) ────────────────────────────────
//
// Replaces the single hardcoded env-var admin with real, DB-backed identities so
// RBAC (DisplaySpec.visibleToRoles, wired in the renderer) has more than one
// identity to gate against.
//
// PASSWORD HASHING — Node built-in scrypt, NOT bcrypt. The task allowed bcrypt
// "if available"; it is not in package.json and pulls a native build. crypto.scrypt
// is a memory-hard KDF in the standard library (12-Factor: no avoidable dependency,
// no native toolchain in the image). The cost parameters travel WITH the hash
// (self-describing format) so cost can be raised later without a schema change —
// expand-contract for the hash format.

// promisify collapses scrypt to its 3-arg overload, dropping the options form we
// need (N/r/p/maxmem). Re-type the promisified handle to the options overload so
// the cost parameters are accepted with no `any`.
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

// scrypt cost parameters. N=2^15 (32768) is the OWASP-recommended floor for
// interactive logins; r/p left at the defaults that pair with it. keyLen 32B.
const SCRYPT_N = 2 ** 15
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32
const SALT_LEN = 16

// Self-describing digest: "scrypt$N$r$p$salt_b64$hash_b64". Parameters are stored
// alongside the hash so verifyPassword reconstructs the exact derivation that
// produced a stored digest — older hashes keep verifying after the cost is raised.
const PREFIX = 'scrypt'

export interface User {
  id:       string
  username: string
  roles:    string[]
  enabled:  boolean
}

// Minimal port over the pg pool/client. `app.pg` (a Pool) and an acquired
// PoolClient both satisfy this — the repository depends on the capability to run
// a parameterized query, not on a concrete pg class (Dependency Inversion, ISP).
export interface Queryable {
  query<R extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>
}

// ── Password hashing ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    // scrypt's internal memory guard scales with N*r*p; raise maxmem so N=2^15
    // does not trip the default 32 MiB ceiling.
    maxmem: 256 * 1024 * 1024,
  })
  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$')
}

// Constant-time verification. Re-derives the key using the parameters parsed FROM
// the stored digest (not the current constants) so it stays correct across cost
// upgrades. Any malformed digest verifies to false — fail-closed, never throw a
// 500 into the login path.
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 6 || parts[0] !== PREFIX) return false

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltB64, 'base64')
    expected = Buffer.from(hashB64, 'base64')
  } catch {
    return false
  }
  if (expected.length === 0) return false

  let derived: Buffer
  try {
    derived = await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    })
  } catch {
    return false
  }

  // Lengths are equal by construction (we derived `expected.length` bytes), so
  // timingSafeEqual never throws here; the comparison is constant-time.
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

// ── Repository ────────────────────────────────────────────────────────────────

// Row shape as it comes back from Postgres (snake_case). Mapped to the camelCase
// domain type at the boundary so callers never see DB column naming.
interface UserRow extends Record<string, unknown> {
  id:            string
  username:      string
  password_hash: string
  roles:         string[]
  enabled:       boolean
}

const mapUser = (row: UserRow): User => ({
  id:       row.id,
  username: row.username,
  roles:    row.roles,
  enabled:  row.enabled,
})

// Login lookup. Returns the password hash alongside the user (the ONLY place the
// hash leaves the DB) so the caller can verify; every other query omits it.
export async function findUserByUsername(
  pg: Queryable,
  username: string,
): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await pg.query<UserRow>(
    `SELECT id, username, password_hash, roles, enabled
       FROM config.user
      WHERE username = $1`,
    [username],
  )
  const row = rows[0]
  if (!row) return null
  return { ...mapUser(row), passwordHash: row.password_hash }
}

export async function listUsers(pg: Queryable): Promise<User[]> {
  const { rows } = await pg.query<UserRow>(
    `SELECT id, username, roles, enabled
       FROM config.user
      ORDER BY username`,
  )
  return rows.map(mapUser)
}

export async function countUsers(pg: Queryable): Promise<number> {
  const { rows } = await pg.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM config.user`)
  return Number(rows[0]?.n ?? '0')
}

// True iff at least one ENABLED user carries the 'admin' role. Drives the
// bootstrap fallback (env-var login) and the self-disabling setup route.
export async function hasAdminUser(pg: Queryable): Promise<boolean> {
  const { rows } = await pg.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM config.user WHERE enabled AND 'admin' = ANY(roles)
     ) AS exists`,
  )
  return rows[0]?.exists ?? false
}

export async function createUser(
  pg: Queryable,
  username: string,
  password: string,
  roles: string[],
): Promise<User> {
  const passwordHash = await hashPassword(password)
  const { rows } = await pg.query<UserRow>(
    `INSERT INTO config.user (username, password_hash, roles)
     VALUES ($1, $2, $3)
     RETURNING id, username, roles, enabled`,
    [username, passwordHash, roles],
  )
  return mapUser(rows[0])
}

// Partial update of roles and/or enabled. Both optional; COALESCE leaves an
// omitted field untouched. Returns null when the id does not exist (caller → 404).
export async function updateUser(
  pg: Queryable,
  id: string,
  patch: { roles?: string[]; enabled?: boolean },
): Promise<User | null> {
  const { rows } = await pg.query<UserRow>(
    `UPDATE config.user
        SET roles   = COALESCE($2, roles),
            enabled = COALESCE($3, enabled)
      WHERE id = $1
      RETURNING id, username, roles, enabled`,
    [id, patch.roles ?? null, patch.enabled ?? null],
  )
  return rows[0] ? mapUser(rows[0]) : null
}

// Returns true iff a row was deleted (false → id not found, caller → 404).
export async function deleteUser(pg: Queryable, id: string): Promise<boolean> {
  const { rows } = await pg.query<{ id: string }>(
    `DELETE FROM config.user WHERE id = $1 RETURNING id`,
    [id],
  )
  return rows.length > 0
}
