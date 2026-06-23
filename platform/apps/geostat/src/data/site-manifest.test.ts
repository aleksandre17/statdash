// ── site-manifest fail-soft test (ADR-0028 VERIFY-GENERIC) ────────────────
//
//  The de-tenanted runner carries NO tenant content; its primary boot path is
//  the live API (GET /api/bootstrap + config.data_source). This test asserts the
//  resilience contract: when the API is UNAVAILABLE at boot, bootstrapSite()
//  fails soft to the generic emptyManifest — it does NOT crash, and it renders a
//  tenant-AGNOSTIC empty state (no Geostat brand/content). This is the boot gate
//  that proves the runner is genuinely generic and never hard-depends on a
//  configured backend (graceful degradation / Principle of Least Astonishment).
//
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bootstrapSite, emptyManifest } from './site-manifest'

describe('bootstrapSite — fail-soft to generic empty manifest (ADR-0028)', () => {
  beforeEach(() => {
    // Simulate the API being down/unconfigured: every fetch rejects.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    // Silence the expected fallback warnings.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('boots without throwing when the API is unreachable', async () => {
    await expect(bootstrapSite()).resolves.toBeDefined()
  })

  it('falls back to the generic empty manifest (offline page, empty nav)', async () => {
    const { manifest, stores } = await bootstrapSite()

    // Index resolves to the offline page, which exists in the manifest.
    expect(manifest.indexPageId).toBe('__offline')
    expect(manifest.pages[manifest.indexPageId]).toBeDefined()

    // Tenant-agnostic empty chrome: no nav, no modes, no datasources, no stores.
    expect(manifest.nav).toEqual([])
    expect(manifest.modes).toEqual([])
    expect(manifest.datasources).toEqual([])
    expect(stores).toEqual({})

    // Single active locale, English only (the runner's neutral baseline).
    expect(manifest.i18n.locales).toEqual(['en'])
    expect(manifest.i18n.defaultLocale).toBe('en')
  })

  it('the empty manifest carries ZERO tenant/brand content', () => {
    // The baked-in fallback must be brand-free (Law 1 — no privileged tenant).
    const serialized = JSON.stringify(emptyManifest())
    for (const brand of ['geostat', 'georgia', 'gdp', 'accounts', 'regional']) {
      expect(serialized.toLowerCase()).not.toContain(brand)
    }
    // No Georgian script anywhere in the baked fallback.
    expect(/[Ⴀ-ჿ]/.test(serialized)).toBe(false)
  })
})
