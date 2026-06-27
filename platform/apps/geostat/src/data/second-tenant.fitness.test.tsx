// ── Second-tenant fitness function — the de-tenanting Definition-of-Done ───────
//
//  ADR-0026/0028 capstone: PROVE the runner renders a COMPLETELY DIFFERENT tenant
//  (BrewMetrics — coffee retail, dims product/channel/quarter, locales en/de) with
//  ZERO code change, through the SAME composition path the live API drives:
//
//      bootstrapSite → SiteProvider → MemoryRouter → LocaleGuard
//                    → AppChrome → NodePageRenderer (nodeRegistry dispatch)
//
//  This is an EVOLUTIONARY-ARCHITECTURE fitness function (skill §5/§8): it fails if
//  a Geostat assumption (a hardcoded ka/en, a privileged dim, a GDP/geo string) is
//  reintroduced into the runner shell. It is DB-INDEPENDENT — the synthetic manifest
//  IS the /api/bootstrap payload, so no backend is needed.
//
//  The composition under test mirrors apps/geostat/src/app/App.tsx + LocaleGuard.tsx
//  EXACTLY (same providers, same route shape). We do NOT call bootstrapSite() (that
//  fetches the live API); we inject the manifest at the SiteProvider seam — the same
//  seam App fills from boot.manifest. The render path below is the runner's; only the
//  manifest SOURCE differs (fixture vs API), which is the whole point of de-tenanting.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import i18next from 'i18next'
import { SiteProvider } from '@statdash/react'
import { perspectiveRegistry } from '@statdash/engine'
import { LocaleGuard } from '../app/LocaleGuard'
import { setupRegistrations } from '../setupRegistrations'
import { registerFormatters } from '../i18n/formatters'
import { secondTenantManifest, BREW } from './__fixtures__/second-tenant.manifest'
import type { SiteManifest } from './site-manifest'

// ── Boot the runner exactly as main.tsx does ───────────────────────────────────
//  i18next.init() then setupRegistrations() registers every node/panel/page/chrome/
//  control slice + the dev middleware. This is the runner's capability surface; the
//  fixture uses ONLY what is registered here (no tenant-specific registration).
beforeAll(() => {
  i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
})

afterEach(() => cleanup())

// ── renderTenant — the App.tsx composition, manifest injected at the seam ──────
//
//  Replicates App.tsx verbatim: register manifest.modes + formatters at boot, then
//  SiteProvider(stores, pages, nav, chrome, chromeConfig, i18n) wrapping the locale
//  route → LocaleGuard. `initialEntry` is the tenant URL the runner would route to.
function renderTenant(manifest: SiteManifest, initialEntry: string) {
  // Boot-time registration from manifest data (App.tsx useEffect) — modes + locale
  // formatters come from the ACTIVE manifest, not from compiled-in code.
  manifest.modes.forEach((m) => perspectiveRegistry.register(m))
  registerFormatters(manifest.i18n.locales)

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
          <Route path="*" element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
        </Routes>
      </SiteProvider>
    </MemoryRouter>,
  )
}

describe('Second-tenant fitness — runner renders BrewMetrics with ZERO code change (ADR-0026/0028 DoD)', () => {
  // ── 1. indexPageId routes to the right page ──────────────────────────────────
  it('routes the index page (indexPageId) to the 2nd tenant overview, NOT a Geostat page', () => {
    renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}`)

    // The overview page-header + its section render — the NodeDef tree resolved
    // through nodeRegistry (inner-page → page-header + section). The section's title
    // is tenant content driven through the render pipeline into the DOM.
    expect(screen.getByRole('heading', { name: 'BrewMetrics Overview' })).toBeInTheDocument()
    expect(screen.getByText('Coffee Performance Summary')).toBeInTheDocument()

    // It is NOT a Geostat landing page.
    expect(screen.queryByText(/GDP/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/national accounts/i)).not.toBeInTheDocument()
  })

  // ── 2. The NodeDef tree of a SECOND page resolves via nodeRegistry ───────────
  it('renders the 2nd tenant sales page tree (a different page id than landing/gdp)', () => {
    renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}/${BREW.pages.sales}`)

    expect(screen.getByRole('heading', { name: 'BrewMetrics Sales' })).toBeInTheDocument()
    expect(screen.getByText('Sales By Channel')).toBeInTheDocument()
  })

  // ── 3. The filterSchema drives the filter bars ───────────────────────────────
  it('the tenant filterSchema (product/channel dims) drives the rendered filter bars', () => {
    renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}/${BREW.pages.sales}`)

    // Two select controls reach the DOM, labelled by the tenant's dims.
    const product = screen.getByRole('combobox', { name: 'Product' })
    const channel = screen.getByRole('combobox', { name: 'Channel' })
    expect(product).toBeInTheDocument()
    expect(channel).toBeInTheDocument()

    // The static options of the tenant's NON-Geostat dimensions render as <option>s —
    // i.e. the filterSchema genuinely flowed through the generic filter pipeline.
    for (const p of BREW.products) {
      expect(within(product).getByRole('option', { name: p.label })).toBeInTheDocument()
    }
    for (const c of BREW.channels) {
      expect(within(channel).getByRole('option', { name: c.label })).toBeInTheDocument()
    }
  })

  // ── 4. Branding (chromeConfig) applies ───────────────────────────────────────
  it('applies the tenant branding (chromeConfig logo), NOT GeoStat brand', () => {
    renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}`)

    const logo = screen.getByRole('img', { name: BREW.logoAlt })
    expect(logo).toHaveAttribute('src', BREW.logoUrl)

    // No Geostat brand leaks.
    expect(screen.queryByText(/geostat/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /geostat/i })).not.toBeInTheDocument()
  })

  // ── 5. The locale set is honored — tenant locales, not ka/en ─────────────────
  it('honors the tenant locale set (en + de) in the locale switcher, NOT ka/en', () => {
    renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}`)

    // The locale switcher renders one button per declared locale.
    const langNav = screen.getByRole('navigation', { name: 'Language' })
    expect(within(langNav).getByRole('button', { name: 'DE' })).toBeInTheDocument()
    expect(within(langNav).getByRole('button', { name: 'EN' })).toBeInTheDocument()

    // The active (default) locale is German, marked aria-current.
    expect(within(langNav).getByRole('button', { name: 'DE' })).toHaveAttribute('aria-current', 'true')

    // No Georgian locale label anywhere.
    expect(within(langNav).queryByRole('button', { name: 'ქარ' })).not.toBeInTheDocument()
  })

  // ── 6. indexPageId routing + locale guard redirect both work generically ─────
  it('redirects an unknown locale to the tenant defaultLocale (de), not a hardcoded ka', () => {
    // 'ka' is NOT in this tenant's locale set → LocaleGuard must redirect to default (de),
    // then render the index page. If the runner hardcoded ka as valid, this would break.
    renderTenant(secondTenantManifest(), '/ka/overview')

    expect(screen.getByRole('heading', { name: 'BrewMetrics Overview' })).toBeInTheDocument()
  })

  // ── 7. NO Geostat string/assumption leaks into the full render ───────────────
  it('no Geostat content (ka/en hardcode, GDP/geo, Georgian script) leaks into the render', () => {
    const { container } = renderTenant(secondTenantManifest(), `/${BREW.defaultLocale}/${BREW.pages.sales}`)
    const html = container.innerHTML

    for (const leak of ['geostat', 'georgia', 'gdp', 'accounts', 'regional', 'საქსტატი']) {
      expect(html.toLowerCase()).not.toContain(leak.toLowerCase())
    }
    // No Georgian script anywhere in the rendered tenant DOM.
    expect(/[Ⴀ-ჿ]/.test(html)).toBe(false)
  })

  // ── 8. The manifest fixture itself carries zero Geostat content (Law 1) ──────
  it('the 2nd-tenant manifest is brand-clean and uses non-privileged dimension names', () => {
    const manifest = secondTenantManifest()
    const serialized = JSON.stringify(manifest).toLowerCase()

    // Tenant-clean: no Geostat brand/domain tokens.
    for (const brand of ['geostat', 'georgia', 'gdp', 'measure', 'approach']) {
      expect(serialized).not.toContain(brand)
    }
    // Uses its OWN dimensions — the proof that the engine has no privileged dim names.
    for (const dim of BREW.dims) {
      expect(serialized).toContain(dim)
    }
    // No Georgian script in the fixture.
    expect(/[Ⴀ-ჿ]/.test(JSON.stringify(manifest))).toBe(false)
  })
})
