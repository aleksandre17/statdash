// @vitest-environment jsdom
//
// ── FF-CHROME-FAILSOFT — the ADR-0028 empty-manifest fail-soft guarantee ───────
//
//  THE INVARIANT: when the runner boots to emptyManifest() (/api/bootstrap
//  unreachable / unconfigured), the app header degrades to minimal, tenant-neutral
//  chrome — it MUST NOT crash. This locks the regression it was born from:
//  AppHeaderShell rendered the brand block UNCONDITIONALLY (`t(config.logoAlt)`),
//  so an empty chromeConfig ({}) dereferenced `undefined['en']` →
//  "Cannot read properties of undefined (reading 'en')" and, with no error
//  boundary, unmounted the whole tree to a blank white page at every route.
//
//  emptyManifest() lives in apps/geostat (outside the dependency arrow — plugins
//  may not import it), so we reconstruct its chrome-relevant shape inline:
//  chromeConfig={}, nav=[], one 'en' locale — byte-for-byte the fields this shell
//  reads. The fix: render the brand link ONLY when logo + alt are both present.
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                 from '@testing-library/react'
import { MemoryRouter }                    from 'react-router-dom'
import { SiteProvider }                    from '@statdash/react'
import type { ChromeConfig, I18nConfig, NavEntry } from '@statdash/react'
import type { DataStore }                  from '@statdash/engine'
import { AppHeaderShell }                  from './AppHeaderShell'

afterEach(() => cleanup())

// The emptyManifest() i18n: a single active locale, no tenant catalog.
const EMPTY_I18N: I18nConfig = { locales: ['en'], defaultLocale: 'en', fallbackLocale: 'en' }

function renderHeader(chromeConfig: ChromeConfig, nav: NavEntry[] = []) {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <SiteProvider
        stores={{} as Record<string, DataStore>}
        nav={nav}
        chromeConfig={chromeConfig}
        i18n={EMPTY_I18N}
      >
        <AppHeaderShell />
      </SiteProvider>
    </MemoryRouter>,
  )
}

describe('FF-CHROME-FAILSOFT — AppHeaderShell degrades, never crashes, on emptyManifest()', () => {
  it('renders a header WITHOUT throwing when chromeConfig is empty ({})', () => {
    // The exact emptyManifest() chromeConfig — no logoUrl, no logoAlt.
    const { container } = renderHeader({} as ChromeConfig)
    expect(
      container.querySelector('header.app-header'),
      'the header must still render (fail-soft), not unmount to a blank page',
    ).not.toBeNull()
  })

  it('the empty-config header is BRAND-FREE — no logo asset, no brand link', () => {
    const { container } = renderHeader({} as ChromeConfig)
    expect(container.querySelector('img'), 'no logo image with an empty chromeConfig').toBeNull()
    expect(
      container.querySelector('.app-header__brand'),
      'no brand link without brand identity',
    ).toBeNull()
  })

  it('carries no tenant/brand identity literal (Law 4 — agnostic fallback)', () => {
    const { container } = renderHeader({} as ChromeConfig)
    const text = container.textContent ?? ''
    expect(text, 'no tenant identity may leak into the neutral shell').not.toMatch(/geostat/i)
    // No Georgian script (a tenant locale) may leak into the shared, agnostic shell.
    expect(text, 'no Georgian tenant literal in the neutral shell').not.toMatch(/[Ⴀ-ჿ]/)
  })

  it('positive control — a populated chromeConfig STILL renders the brand logo (guard is scoped)', () => {
    const { container } = renderHeader({ logoUrl: '/logo.svg', logoAlt: { en: 'Home' } } as ChromeConfig)
    const img = container.querySelector('img')
    expect(img, 'a real brand config must still render the logo — the guard is scoped to the empty case').not.toBeNull()
    expect(img?.getAttribute('src')).toBe('/logo.svg')
    expect(img?.getAttribute('alt')).toBe('Home')
  })
})
