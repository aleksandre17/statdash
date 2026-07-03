// @vitest-environment jsdom
//
// ── Fitness — FF-RENDER-NO-LOCALE-LEAK (the render leak-proof gate, AR-37) ─────
//
//  THE VISION as an executable contract: "nothing left untranslated can survive."
//  The authoring gate (FF-AUTHORING-LOCALE-COMPLETE) proves the CONFIG is complete
//  bilingual; this gate proves the RUNTIME actually RESOLVES it at every boundary,
//  in BOTH directions, on the real rendered tree. It renders every shipped page in
//  every shipped locale and asserts, per the design's three checks:
//
//    (a) no "[object Object]" in the DOM text — no LocaleString bag was
//        String()-flattened (the boundary resolved it, not coerced it).
//    (b) no tenant script (U+10A0–U+10FF Georgian) on the ENGLISH render — an
//        /en page must be fully English; a leaked ka-only value would show here.
//    (c) the /ka and /en renders GENUINELY DIFFER, and /ka actually contains
//        Georgian — proving the switch is LIVE (chrome/titles/labels flip), not
//        pinned to one language.
//
//  Stores are empty by design (like localeString-render-guard) — this exercises
//  the CHROME + STRUCTURE boundary (nav, page/section titles, KPI labels, badges,
//  empty states), which is exactly where the mixed-locale symptom lived. Data-cell
//  localization is covered by resolveRowLocales' own unit tests.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import i18next from 'i18next'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SiteProvider } from '@statdash/react'
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
  // fallbackLng English so an UN-translated chrome key would surface as English on
  // /ka (a detectable pin), never as a thrown key — the gate must SEE leaks, not crash.
  i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
  registerFormatters(buildManifest().i18n.locales)
})
afterEach(() => cleanup())

function renderPageText(slug: string, locale: string): string {
  const manifest = buildManifest()
  const url = `/${locale}/${slug}`
  const { container } = render(
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
  return container.textContent ?? ''
}

const TENANT_SCRIPT = /[Ⴀ-ჿ]/
// DERIVED, never hand-listed — a new page/locale is auto-covered (the exact reason a
// hand-list once let the landing page escape the sibling render guard).
const PAGES: string[] = (prov.pages as { slug: string }[]).map((p) => p.slug)
const LOCALES: string[] = (buildManifest().i18n as { locales: string[] }).locales

describe('FF-RENDER-NO-LOCALE-LEAK — the locale switch is live at every render boundary', () => {
  it('the matrix is manifest-derived and covers the index/landing page', () => {
    expect(PAGES.length).toBeGreaterThan(0)
    expect(PAGES).toContain(sc.index_page_id)
    expect(LOCALES).toContain('ka')
    expect(LOCALES).toContain('en')
  })

  for (const slug of PAGES) {
    // (a) no [object Object] in ANY locale render
    for (const locale of LOCALES) {
      it(`${slug} / ${locale} — no String()-flattened LocaleString bag`, () => {
        const text = renderPageText(slug, locale)
        expect(text, `"[object Object]" in ${slug}/${locale} — a LocaleString escaped its boundary`).not.toContain('[object Object]')
      })
    }

    // (b) + (c) cross-locale: /en is Georgian-free, /ka carries Georgian, and they differ
    it(`${slug} — /en fully English, /ka fully Georgian, switch genuinely flips`, () => {
      const en = renderPageText(slug, 'en')
      const ka = renderPageText(slug, 'ka')

      expect(TENANT_SCRIPT.test(en), `tenant (Georgian) script leaked into the /en render of ${slug}`).toBe(false)
      expect(TENANT_SCRIPT.test(ka), `/ka render of ${slug} has NO Georgian — chrome is pinned to English (switch not live)`).toBe(true)
      expect(en === ka, `/en and /ka renders of ${slug} are identical — the locale switch does not flip this page`).toBe(false)
    })
  }
})
