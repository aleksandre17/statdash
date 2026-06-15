import { createHmac, timingSafeEqual } from 'node:crypto'

// Minimal JWT (HS256) on node:crypto — no 3rd-party lib, zero supply-chain risk.
// Single-issuer, symmetric-key scenario: HMAC-SHA256 over base64url(header).base64url(payload).
//
// Token shape: { sub, iat, exp }. Header + payload are base64url-encoded JSON,
// signature is HMAC-SHA256 of `${header}.${payload}`.

export interface JwtPayload {
  sub: string // subject (username)
  iat: number // issued-at (epoch seconds)
  exp: number // expires (epoch seconds)
}

const now = (): number => Math.floor(Date.now() / 1000)

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(header: string, payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
}

export function issueToken(sub: string, secret: string, ttlSeconds = 86_400): string {
  const iat = now()
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const payload = b64urlJson({ sub, iat, exp: iat + ttlSeconds })
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
  return raw as JwtPayload
}
