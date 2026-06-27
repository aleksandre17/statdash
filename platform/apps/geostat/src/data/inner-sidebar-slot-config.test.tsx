// ── End-to-end: per-element chrome config reaches the inner-sidebar ───────────
//
//  Proves the element-config-schema seam (ADR element-config-schema-seam) works
//  through the REAL composition path the live API drives:
//
//      manifest.chrome["InnerSidebar"].config.brandTitle
//        → SiteProvider(chrome) → useSiteChrome()
//        → <ChromeSlot slot="InnerSidebar"/> (InnerPageShell)
//        → ChromeSlotConfigProvider(config)
//        → useSlotConfig<InnerSidebarConfig>() in InnerSidebarShell
//        → rendered brand text in the DOM
//
//  This is the contract that brandTitle/sectionsLabel — migrated OFF the shared
//  ChromeConfig onto the inner-sidebar's OWN schema — still reach the shell at
//  runtime as per-slot config. If the wiring regresses (e.g. ChromeSlot stops
//  forwarding config, or the shell reverts to useChromeConfig), the brand goes
//  empty and this test fails.
//
//  Tenant-AGNOSTIC fixture (en-only): the app layer carries no tenant content
//  (ADR-0028); the brand string here is a synthetic sample, not Geostat brand.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18next from 'i18next'
import { SiteProvider } from '@statdash/react'
import { LocaleGuard } from '../app/LocaleGuard'
import { setupRegistrations } from '../setupRegistrations'
import { registerFormatters } from '../i18n/formatters'
import type { SiteManifest } from './site-manifest'

beforeAll(() => {
  i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
  registerFormatters(['en'])
})

afterEach(() => cleanup())

const BRAND    = 'Acme Stats Portal'
const SECTIONS = 'Sections'

// A minimal inner-page that mounts the InnerSidebar slot (InnerPageShell renders
// <ChromeSlot slot="InnerSidebar"/>), plus one nav entry so the sidebar has body.
function manifestWithSidebarConfig(): SiteManifest {
  return {
    schemaVersion: 1,
    indexPageId: 'home',
    pages: {
      home: {
        id:   'home',
        type: 'inner-page',
        path: '/home',
        children: [{ type: 'page-header', title: 'Home' }],
      } as SiteManifest['pages'][string],
    },
    nav: [{ id: 'home', path: '/home', label: 'Home', color: '#333', icon: 'bar-chart', items: [] }],
    // The per-element config under test: InnerSidebar gets brandTitle + sectionsLabel
    // as its SLOT config — NOT via the shared chromeConfig base.
    chrome: {
      InnerSidebar: {
        variant: 'default',
        config: {
          brandTitle:    BRAND,
          sectionsLabel: SECTIONS,
        },
      },
    },
    chromeConfig: { logoUrl: '', logoAlt: '' },
    i18n: { locales: ['en'], defaultLocale: 'en', fallbackLocale: 'en' },
    datasources: [],
  }
}

describe('Per-element chrome config — inner-sidebar reads brandTitle via useSlotConfig (ADR seam)', () => {
  it('renders the slot-config brandTitle + sectionsLabel in the sidebar DOM (not empty)', () => {
    const manifest = manifestWithSidebarConfig()
    render(
      <MemoryRouter initialEntries={['/en/home']}>
        <SiteProvider
          stores={{}}
          pages={manifest.pages}
          nav={manifest.nav}
          chrome={manifest.chrome}
          chromeConfig={manifest.chromeConfig}
          i18n={manifest.i18n}
        >
          <Routes>
            <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />} />
          </Routes>
        </SiteProvider>
      </MemoryRouter>,
    )

    // The brand + sections label reached the DOM — proof the per-slot config
    // flowed end to end into useSlotConfig(), NOT the shared ChromeConfig.
    expect(screen.getByText(BRAND)).toBeInTheDocument()
    expect(screen.getByText(SECTIONS)).toBeInTheDocument()
  })
})
