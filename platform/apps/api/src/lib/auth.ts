import { createHmac, timingSafeEqual } from 'node:crypto'

// Minimal JWT (HS256) on node:crypto — no 3rd-party lib, zero supply-chain risk.
// Single-issuer, symmetric-key scenario: HMAC-SHA256 over base64url(header).base64url(payload).
//
// Token shape: { sub, iat, exp, roles? }. Header + payload are base64url-encoded
// JSON, signature is HMAC-SHA256 of `${header}.${payload}`.

export interface JwtPayload {
  sub:    string   // subject (username) — kept as the human identity
  uid?:   string   // user id (config.user.id) [P2-2]; absent ⇒ env-bootstrap or pre-P2-2 token
  iat:    number   // issued-at (epoch seconds)
  exp:    number   // expires (epoch seconds)
  roles?: string[] // RBAC roles [N41]; absent ⇒ no roles (back-compat with pre-N41 tokens)
}

const now = (): number => Math.floor(Date.now() / 1000)

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(header: string, payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
}

export function issueToken(
  sub: string,
  secret: string,
  ttlSeconds = 86_400,
  roles: string[] = [],
  uid?: string,
): string {
  const iat = now()
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  // Build the payload additively so every claim that carries no information is
  // omitted: the pre-N41 / pre-P2-2 token shape is preserved for the no-role,
  // no-uid case (smaller token, no spurious claim, byte-identical to old tokens).
  const claims: JwtPayload = { sub, iat, exp: iat + ttlSeconds }
  if (uid !== undefined) claims.uid = uid
  if (roles.length > 0) claims.roles = roles
  const payload = b64urlJson(claims)
  const sig = sign(header, payload, secret)
  return `${header}.${payload}.${sig}`
}

// verifyToken — fail-fast: any structural, signature, or expiry fault throws.
// Order matters: signature is checked (timing-safe) BEFORE the payload is trusted,
// so we never read claims off an unverified body.
export function verifyToken(token: string, secret: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed token')
  const [header, payload, sig] = parts

  const expectedSig = sign(header, payload, secret)
  const sigBuf = Buffer.from(sig, 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')
  // Length check guards timingSafeEqual (it throws on mismatched lengths) and is
  // itself constant-time-safe: a wrong length is already a wrong signature.
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature')
  }

  const claims = parseClaims(payload)
  if (claims.exp < now()) throw new Error('Token expired')
  return claims
}

// Decode + validate the claim set. A truncated or non-conforming payload is a
// malformed token, not a 500 — keep the boundary strict.
function parseClaims(payload: string): JwtPayload {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    throw new Error('Malformed token payload')
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    typeof (raw as JwtPayload).sub !== 'string' ||
    typeof (raw as JwtPayload).iat !== 'number' ||
    typeof (raw as JwtPayload).exp !== 'number'
  ) {
    throw new Error('Malformed token claims')
  }
  // roles is optional (back-compat) but, when present, must be a string[].
  const roles = (raw as JwtPayload).roles
  if (roles !== undefined && (!Array.isArray(roles) || !roles.every(r => typeof r === 'string'))) {
    throw new Error('Malformed token roles')
  }
  // uid is optional (env-bootstrap + pre-P2-2 tokens omit it); when present, a string.
  const uid = (raw as JwtPayload).uid
  if (uid !== undefined && typeof uid !== 'string') {
    throw new Error('Malformed token uid')
  }
  return raw as JwtPayload
}
