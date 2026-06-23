import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './users.js'

// ── Unit tests: password layer (P2-2) ─────────────────────────────────────────
//
// scrypt is intentionally cost-heavy (N=2^15), so each hash/verify is in the tens
// of ms range. These tests issue only a handful of derivations, which keeps the
// file well within a normal unit-test budget while exercising the security
// invariants the login path depends on.

describe('hashPassword', () => {
  it('returns a scrypt$ self-describing digest', async () => {
    const hash = await hashPassword('correct horse battery staple')
    // Format: "scrypt$N$r$p$salt_b64$hash_b64" — six $-delimited fields.
    const parts = hash.split('$')
    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('scrypt')
    // N/r/p are integers; the OWASP floor N=2^15 is baked in.
    expect(Number(parts[1])).toBe(2 ** 15)
    expect(Number.isInteger(Number(parts[2]))).toBe(true)
    expect(Number.isInteger(Number(parts[3]))).toBe(true)
    // salt + derived key are non-empty base64.
    expect(parts[4].length).toBeGreaterThan(0)
    expect(parts[5].length).toBeGreaterThan(0)
  })

  it('produces a different digest each call for the same password (salt randomness)', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
    // Specifically the salt field differs — the randomness is in the salt, not luck.
    expect(a.split('$')[4]).not.toBe(b.split('$')[4])
  })
})

describe('verifyPassword', () => {
  it('verifies a hash against the correct password → true', async () => {
    const hash = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword(hash, 's3cret-passphrase')).toBe(true)
  })

  it('rejects the wrong password → false (no throw)', async () => {
    const hash = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword(hash, 'wrong-passphrase')).toBe(false)
  })

  it('rejects an empty-string password → false (edge case, no throw)', async () => {
    const hash = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword(hash, '')).toBe(false)
  })

  it('verifies a hash whose password was the empty string', async () => {
    // Empty is a valid password to hash; it must round-trip and not collide with
    // a non-empty password.
    const hash = await hashPassword('')
    expect(await verifyPassword(hash, '')).toBe(true)
    expect(await verifyPassword(hash, 'x')).toBe(false)
  })

  it('fails closed on a malformed digest → false (no throw)', async () => {
    expect(await verifyPassword('malformed-not-a-hash', 'any')).toBe(false)
  })

  it('fails closed on a wrong-prefix / wrong-arity digest → false', async () => {
    // Right field count, wrong prefix.
    expect(await verifyPassword('bcrypt$1$2$3$c2FsdA==$aGFzaA==', 'any')).toBe(false)
    // Right prefix, too few fields.
    expect(await verifyPassword('scrypt$32768$8', 'any')).toBe(false)
    // Right prefix, non-integer cost params.
    expect(await verifyPassword('scrypt$x$y$z$c2FsdA==$aGFzaA==', 'any')).toBe(false)
    // Empty string.
    expect(await verifyPassword('', 'any')).toBe(false)
  })

  it('does not cross-contaminate: hash of A never verifies password B', async () => {
    const hashA = await hashPassword('password-A')
    const hashB = await hashPassword('password-B')
    expect(await verifyPassword(hashA, 'password-B')).toBe(false)
    expect(await verifyPassword(hashB, 'password-A')).toBe(false)
    // Sanity: each still verifies its own password.
    expect(await verifyPassword(hashA, 'password-A')).toBe(true)
    expect(await verifyPassword(hashB, 'password-B')).toBe(true)
  })
})
