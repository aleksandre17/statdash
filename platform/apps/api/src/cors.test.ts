import { describe, it, expect, beforeAll } from 'vitest'

// env.ts parses process.env at IMPORT time and fail-fasts on a bad contract, so
// we must seed a valid contract BEFORE importing it (mirrors env.test.ts). The
// mapping under test (corsOrigin) is pure w.r.t. its argument — every case below
// passes the value explicitly, so the seeded CORS_ORIGIN is irrelevant to assertions.
let corsOrigin: (value?: string) => string | false

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgres://test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-chars-long!!'
  process.env.ADMIN_USERNAME ??= 'admin'
  process.env.ADMIN_PASSWORD ??= 'password1'
  ;({ corsOrigin } = await import('./env.js'))
})

// corsOrigin() maps the string CORS_ORIGIN contract onto the `origin` option
// @fastify/cors wants (ADR adr-deployment-topology, D3). The same-origin
// reverse-proxy topology needs CORS OFF — a sentinel maps to boolean `false`
// (no Access-Control-Allow-Origin emitted); a real origin passes through.
// Pass the value explicitly so the mapping is tested independent of the
// import-time env (which env.test.ts already exercises).
describe('corsOrigin — CORS_ORIGIN string → @fastify/cors origin option', () => {
  it("maps the 'false' sentinel to boolean false (CORS disabled, same-origin prod)", () => {
    expect(corsOrigin('false')).toBe(false)
  })

  it('maps the empty-string sentinel to boolean false (CORS disabled)', () => {
    expect(corsOrigin('')).toBe(false)
  })

  it('treats surrounding whitespace around a sentinel as the sentinel', () => {
    expect(corsOrigin('  false  ')).toBe(false)
    expect(corsOrigin('   ')).toBe(false)
  })

  it('passes a real origin through verbatim (cross-origin dev allowance)', () => {
    expect(corsOrigin('http://localhost:5175')).toBe('http://localhost:5175')
    expect(corsOrigin('https://app.example.com')).toBe('https://app.example.com')
  })

  it("never silently widens to '*' — a wildcard stays the literal string, not the off-switch", () => {
    // Guards the invariant: '*' is NOT a disabling sentinel. If someone sets it,
    // it is passed through as-is (visibly wrong) rather than being treated as
    // "disabled" — the mapping must not paper over a wildcard.
    expect(corsOrigin('*')).toBe('*')
  })
})
