import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// ── Embed token signing (N38) ─────────────────────────────────────────────────
// HMAC-SHA256 over the opaque token, mirroring lib/auth.ts: node:crypto only,
// zero supply-chain surface. The signature is the proof a token was minted by us;
// without it, anyone who guessed a token id could pull a snapshot.
//
// Token (the id) and signature (the proof) are kept separate so the embed URL is
// /embed/:token?sig=:sig — the path carries the lookup key, the query the proof.

/** Mint an unguessable opaque token. 12 random bytes → 24 hex chars. */
export function mintToken(): string {
  return randomBytes(12).toString('hex')
}

/** HMAC-SHA256 of `token` under `secret`, hex-encoded. */
export function sign(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex')
}

// verify — constant-time signature check. The length guard short-circuits before
// timingSafeEqual (which throws on length mismatch) and leaks nothing beyond
// "wrong length is already wrong". Never compare hex strings with ===.
export function verify(token: string, sig: string, secret: string): boolean {
  const expected = sign(token, secret)
  const sigBuf = Buffer.from(sig, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  return (
    sigBuf.length === expectedBuf.length &&
    sigBuf.length > 0 &&
    timingSafeEqual(sigBuf, expectedBuf)
  )
}
