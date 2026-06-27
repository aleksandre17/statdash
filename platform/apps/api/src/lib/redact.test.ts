import { describe, it, expect } from 'vitest'
import { redactSecrets, redactDataSourceConfig } from './redact.js'

describe('redactSecrets (API-08)', () => {
  it('strips the auth envelope wholesale', () => {
    const out = redactSecrets({ url: 'https://x', auth: { kind: 'bearer', token: 't' } })
    expect(out).toEqual({ url: 'https://x' })
  })

  it('strips secret-named keys at any depth', () => {
    const out = redactSecrets({
      a: { apiKey: 'k', nested: { password: 'p', keep: 1 } },
      token: 'x',
      keep: 'visible',
    })
    expect(out).toEqual({ a: { nested: { keep: 1 } }, keep: 'visible' })
  })

  it('recurses through arrays', () => {
    const out = redactSecrets({ list: [{ secret: 's', ok: 1 }, { ok: 2 }] })
    expect(out).toEqual({ list: [{ ok: 1 }, { ok: 2 }] })
  })

  it('does not mutate the input', () => {
    const input = { token: 't', keep: 1 }
    redactSecrets(input)
    expect(input).toEqual({ token: 't', keep: 1 })
  })

  it('passes non-secret config through unchanged', () => {
    const cfg = { refreshMs: 5000, baseUrl: '/public', display: { theme: 'dark' } }
    expect(redactSecrets(cfg)).toEqual(cfg)
  })
})

describe('redactDataSourceConfig (API-08)', () => {
  it('normalizes null/non-object to an empty object', () => {
    expect(redactDataSourceConfig(null)).toEqual({})
    expect(redactDataSourceConfig('nope')).toEqual({})
    expect(redactDataSourceConfig([1, 2])).toEqual({})
  })

  it('FITNESS: no secret-bearing field survives the public projection', () => {
    const config = {
      baseUrl: 'https://sdmx.example/rest',
      auth: { kind: 'apikey', value: 'SUPER-SECRET' },
      headers: { Authorization: 'Bearer leak', 'X-Api-Key': 'leak2' },
      bearerToken: 'leak3',
      refreshMs: 60000,
    }
    const safe = redactDataSourceConfig(config)
    const serialized = JSON.stringify(safe)
    expect(serialized).not.toContain('SUPER-SECRET')
    expect(serialized).not.toContain('leak')
    // The non-secret param is preserved (the renderer still binds it).
    expect(safe.refreshMs).toBe(60000)
    expect(safe.baseUrl).toBe('https://sdmx.example/rest')
  })
})
