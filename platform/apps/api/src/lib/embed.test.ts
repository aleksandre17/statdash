import { describe, it, expect } from 'vitest'
import { mintToken, sign, verify } from './embed.js'

const SECRET = 'unit-test-secret'

describe('embed signing (HMAC-SHA256)', () => {
  it('sign/verify round-trips for a freshly minted token', () => {
    const token = mintToken()
    const sig = sign(token, SECRET)
    expect(verify(token, sig, SECRET)).toBe(true)
  })

  it('mintToken yields 24 hex chars (12 random bytes), unique per call', () => {
    const a = mintToken()
    const b = mintToken()
    expect(a).toMatch(/^[0-9a-f]{24}$/)
    expect(a).not.toBe(b)
  })

  it('rejects a tampered signature', () => {
    const token = mintToken()
    const sig = sign(token, SECRET)
    const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0')
    expect(verify(token, tampered, SECRET)).toBe(false)
  })

  it('rejects a signature minted under a different secret', () => {
    const token = mintToken()
    const sig = sign(token, 'other-secret')
    expect(verify(token, sig, SECRET)).toBe(false)
  })

  it('rejects a signature for a different token (no cross-token reuse)', () => {
    const sig = sign('token-a', SECRET)
    expect(verify('token-b', sig, SECRET)).toBe(false)
  })

  it('rejects a malformed (non-hex / empty) signature without throwing', () => {
    const token = mintToken()
    expect(verify(token, '', SECRET)).toBe(false)
    expect(verify(token, 'not-hex-zz', SECRET)).toBe(false)
  })
})
