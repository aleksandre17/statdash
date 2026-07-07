// @vitest-environment jsdom
//
// ── AppHeader primary-nav gate ─────────────────────────────────────────────
//
//  The header's top-nav is a duplicate of the useSiteNav() SSOT that the inner
//  sidebar + hero cards also surface. A tenant can suppress the redundant header
//  copy declaratively via `config.showNav: false` WITHOUT emptying the shared
//  nav (which would also strip the sidebar). This locks:
//    • default (showNav omitted) → nav renders (backward-compatible)
//    • showNav:false             → NO <nav> element at all (no empty flex gap),
//                                   while brand + action slots still render
//    • empty nav SSOT            → NO <nav> even when showNav is true
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                 from '@testing-library/react'
import { MemoryRouter }                    from 'react-router-dom'
import { SiteProvider }                    from '@statdash/react'
import { ChromeSlotConfigProvider }        from '@statdash/react/engine'
import type { ChromeConfig, I18nConfig, NavEntry } from '@statdash/react'
import type { DataStore }                  from '@statdash/engine'
import { AppHeaderShell }                  from './AppHeaderShell'

afterEach(() => cleanup())

const I18N: I18nConfig = { locales: ['en'], defaultLocale: 'en', fallbackLocale: 'en' }
const BRAND: ChromeConfig = { logoUrl: '/logo.svg', logoAlt: { en: 'Home' } } as ChromeConfig
const NAV: NavEntry[] = [
  { id: 'a', path: '/a', label: { en: 'Alpha' }, color: '#000', icon: 'bar-chart', items: [] },
  { id: 'b', path: '/b', label: { en: 'Beta' },  color: '#000', icon: 'document',  items: [] },
]

function renderHeader(chromeConfig: ChromeConfig, nav: NavEntry[], slotConfig: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <SiteProvider
        stores={{} as Record<string, DataStore>}
        nav={nav}
        chromeConfig={chromeConfig}
        i18n={I18N}
      >
        <ChromeSlotConfigProvider config={slotConfig}>
          <AppHeaderShell />
        </ChromeSlotConfigProvider>
      </SiteProvider>
    </MemoryRouter>,
  )
}

describe('AppHeaderShell — primary-nav gate (config.showNav)', () => {
  it('renders the nav by default (showNav omitted) — backward-compatible', () => {
    const { container } = renderHeader(BRAND, NAV, {})
    expect(container.querySelector('nav.app-header__nav')).not.toBeNull()
    expect(container.querySelectorAll('.app-header__nav-link')).toHaveLength(2)
  })

  it('showNav:false omits the <nav> ENTIRELY (no empty flex gap)', () => {
    const { container } = renderHeader(BRAND, NAV, { showNav: false })
    expect(
      container.querySelector('nav.app-header__nav'),
      'the nav element must not be rendered at all — not merely emptied',
    ).toBeNull()
    expect(container.querySelector('.app-header__nav-link')).toBeNull()
  })

  it('showNav:false KEEPS the rest of the header (brand + actions still render)', () => {
    const { container } = renderHeader(BRAND, NAV, { showNav: false })
    expect(container.querySelector('.app-header__brand'), 'brand/logo stays').not.toBeNull()
    expect(container.querySelector('.app-header__actions'), 'action slot stays').not.toBeNull()
  })

  it('an empty nav SSOT renders no <nav> even when showNav is true', () => {
    const { container } = renderHeader(BRAND, [], { showNav: true })
    expect(container.querySelector('nav.app-header__nav')).toBeNull()
  })
})
