import { describe, it, expect, afterEach } from 'vitest'
import { studioShellEnabled, STUDIO_SHELL_FLAG } from './flags'

// The env default is off in the test environment (no VITE_STUDIO_SHELL set), so
// these assert the localStorage-override precedence + the off-by-default contract.
describe('studioShellEnabled — feature flag reader', () => {
  afterEach(() => localStorage.removeItem(STUDIO_SHELL_FLAG))

  it('is OFF by default (no override, no env) — the wizard stays default', () => {
    expect(studioShellEnabled()).toBe(false)
  })

  it('a localStorage override of "on"/"true"/"1" turns it ON (no rebuild)', () => {
    for (const v of ['on', 'true', '1', 'YES']) {
      localStorage.setItem(STUDIO_SHELL_FLAG, v)
      expect(studioShellEnabled()).toBe(true)
    }
  })

  it('a localStorage override of "off"/"false" forces it OFF', () => {
    for (const v of ['off', 'false', '0', 'no']) {
      localStorage.setItem(STUDIO_SHELL_FLAG, v)
      expect(studioShellEnabled()).toBe(false)
    }
  })

  it('an unrecognized override value falls through to the (off) env default', () => {
    localStorage.setItem(STUDIO_SHELL_FLAG, 'maybe')
    expect(studioShellEnabled()).toBe(false)
  })
})
