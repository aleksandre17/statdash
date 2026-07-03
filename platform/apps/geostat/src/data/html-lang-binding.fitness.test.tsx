// @vitest-environment jsdom
//
// ── FF-HTML-LANG-BOUND — <html lang>/dir tracks the active locale ──────────────
//
//  THE INVARIANT (AR-37 P0, DESIGN-i18n-full-sync-and-integrity-badges.md §4):
//  `document.documentElement.lang === locale` and `dir === localeDirection(locale)`
//  for every manifest locale, on every page — root R1 was that NOTHING in the
//  running app ever wrote `document.documentElement.lang`; it stayed frozen at
//  index.html's `lang="en"` forever, regardless of the active `/:locale/*` route.
//
//  Mirrors the render harness in `localeString-render-guard.fitness.test.tsx`
//  (same manifest-derived page/locale matrix, same LocaleGuard mount) — this
//  gate asserts the DOCUMENT binding side effect instead of the LocaleString
//  render-boundary invariant.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import i18next from 'i18next'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SiteProvider, localeDirection } from '@statdash/react'
import { LocaleGuard } from '../app/LocaleGuard'
import { setupRegistrations } from '../setupRegistrations'
import { registerFormatters } from '../i18n/formatters'
import type { SiteManifest } from './site-manifest'

const here = dirname(fileURLToPath(import.meta.url))
const provPath = resolve(here, '../../../api/provisioning/geostat.provisioning.json')
/* eslint-disable @typescript-eslint/no-explicit-any */
const prov: any = JSON.parse(readFileSync(provPath, 'utf8'))
const sc: any = Object.fromEntries(prov.siteConfig.map((r: any) => [r.key, r.value]))
function buildManifest(): SiteManifest {
  return {
    pages: Object.fromEntries(prov.pages.map((p: any) => [p.slug, p.config])),
    indexPageId: sc.index_page_id,
    nav: sc.nav,
    chrome: sc.chrome,
    chromeConfig: sc.chrome_config,
    i18n: sc.i18n,
    datasources: [],
  } as unknown as SiteManifest
}
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(() => {
  i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
  registerFormatters(buildManifest().i18n.locales)
})
afterEach(() => cleanup())

function renderPage(slug: string, locale: string) {
  const manifest = buildManifest()
  const url = `/${locale}/${slug}`
  return render(
    <MemoryRouter initialEntries={[url]}>
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

// Manifest-derived, never hardcoded ka/en (Law 1) — the gate drives every locale
// the manifest actually ships, plus every page it ships.
const LOCALES: string[] = (buildManifest().i18n as { locales: string[] }).locales
const PAGES: string[] = (prov.pages as { slug: string }[]).map((p) => p.slug)

describe('FF-HTML-LANG-BOUND — <html lang>/dir tracks the active locale', () => {
  it('the matrix is manifest-derived and covers at least 2 locales + 1 page', () => {
    expect(LOCALES.length).toBeGreaterThanOrEqual(2)
    expect(PAGES.length).toBeGreaterThan(0)
  })

  for (const slug of PAGES) {
    for (const locale of LOCALES) {
      it(`${slug} @ /${locale} binds documentElement.lang/dir to "${locale}"`, () => {
        renderPage(slug, locale)
        expect(document.documentElement.lang).toBe(locale)
        expect(document.documentElement.dir).toBe(localeDirection(locale))
      })
    }
  }

  it('an invalid locale segment redirects — and binds the manifest default locale, not the raw segment', () => {
    const manifest = buildManifest()
    renderPage(PAGES[0], 'zz-not-a-real-locale')
    expect(document.documentElement.lang).toBe(manifest.i18n.defaultLocale)
  })
})

describe('FF-HTML-LANG-BOUND — i18next global language follows the active locale', () => {
  for (const locale of LOCALES) {
    it(`renders /${locale} → i18next.language reflects "${locale}"`, () => {
      renderPage(PAGES[0], locale)
      expect(i18next.language).toBe(locale)
    })
  }
})
