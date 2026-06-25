import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// env.ts parses process.env at IMPORT time and fail-fasts on a bad contract.
// To exercise boot behavior we mutate process.env, reset the module registry, and
// re-import — each import is a fresh "boot" against the current environment.
//
// Focus: the EMBED_SECRET production gate (a leaked/weak embed secret makes embed
// tokens forgeable), plus a guard that the dev path stays frictionless.

const BASE = {
  DATABASE_URL:   'postgres://test',
  JWT_SECRET:     'test-jwt-secret-at-least-32-chars-long!!',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'password1',
}

const STRONG_EMBED = 'a-production-grade-embed-secret-32+chars-long'
const DEV_DEFAULT  = 'dev-secret-change-in-prod'

let saved: NodeJS.ProcessEnv

beforeEach(() => {
  saved = { ...process.env }
  // Clear the vars under test so each case sets exactly what it means to set.
  for (const k of [...Object.keys(BASE), 'EMBED_SECRET', 'NODE_ENV']) {
    delete process.env[k]
  }
  for (const [k, v] of Object.entries(BASE)) process.env[k] = v
  vi.resetModules()
})

afterEach(() => {
  process.env = saved
  vi.resetModules()
})

/** Re-import env.ts as a fresh boot; resolves on success, rejects on fail-fast. */
async function boot() {
  vi.resetModules()
  return import('./env.js')
}

describe('env contract — boot fail-fast', () => {
  describe('EMBED_SECRET production gate', () => {
    it('throws in production when EMBED_SECRET is unset (falls back to the forgeable dev default)', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.EMBED_SECRET
      await expect(boot()).rejects.toThrow(/EMBED_SECRET/)
    })

    it('throws in production when EMBED_SECRET is explicitly the dev default', async () => {
      process.env.NODE_ENV = 'production'
      process.env.EMBED_SECRET = DEV_DEFAULT
      await expect(boot()).rejects.toThrow(/EMBED_SECRET/)
    })

    it('throws in production when EMBED_SECRET is set but weaker than the 32-char bar', async () => {
      process.env.NODE_ENV = 'production'
      process.env.EMBED_SECRET = 'too-short'
      await expect(boot()).rejects.toThrow(/EMBED_SECRET/)
    })

    it('boots in production when EMBED_SECRET is a strong override', async () => {
      process.env.NODE_ENV = 'production'
      process.env.EMBED_SECRET = STRONG_EMBED
      const { env } = await boot()
      expect(env.EMBED_SECRET).toBe(STRONG_EMBED)
      expect(env.NODE_ENV).toBe('production')
    })
  })

  describe('development / test stay frictionless', () => {
    it('uses the dev default for EMBED_SECRET when unset in development', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.EMBED_SECRET
      const { env } = await boot()
      expect(env.EMBED_SECRET).toBe(DEV_DEFAULT)
    })

    it('does not require the 32-char bar for EMBED_SECRET outside production', async () => {
      process.env.NODE_ENV = 'test'
      process.env.EMBED_SECRET = 'short-test-secret'
      const { env } = await boot()
      expect(env.EMBED_SECRET).toBe('short-test-secret')
    })
  })

  describe('siblings already fail-fast everywhere (no dev default)', () => {
    it('throws when JWT_SECRET is shorter than 32 chars', async () => {
      process.env.NODE_ENV = 'development'
      process.env.JWT_SECRET = 'too-short'
      await expect(boot()).rejects.toThrow()
    })

    it('throws when DATABASE_URL is missing', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.DATABASE_URL
      await expect(boot()).rejects.toThrow()
    })
  })
})
