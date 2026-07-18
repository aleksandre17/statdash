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
//  (d) — added 0093 — the SAME three checks run over the ACCESSIBLE-NAME
//        ATTRIBUTES (aria-label, title, alt, placeholder, aria-description), not
//        only visible textContent. This closes the exact gap that let the header
//        social links ship with an accessible name of "[object Object]": a
//        LocaleString bag authored into a bare-string aria slot flattens in the
//        ATTRIBUTE, which textContent never sees. The a11y tree is chrome too —
//        it must resolve like everything else (WCAG 4.1.2 / 3.1.2).
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

// The locale switcher is the ONE control whose job is to present EVERY locale so a
// reader can find their language — it renders each locale's ENDONYM (ქარ / ENG) in its
// own script, on every page in every locale (config.localeLabels, WCAG: a Georgian
// reader must recognise "ქარ" even on an /en page). Its Georgian text is therefore NOT
// a content leak; excluding this one control from the tenant-script scan keeps the
// guarantee honest ("/en content is fully English") without falsely flagging the
// language-switch affordance. Scoped by the stable `.locale-switcher` class — the app
// CONTENT (titles, KPI labels, badges, nav) is still fully guarded.
// Accessible-name attributes — the a11y tree the previous gate never scanned.
const A11Y_NAME_ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'aria-description'] as const

function renderPage(slug: string, locale: string): { text: string; names: string[] } {
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
  // The locale switcher intentionally renders every locale's endonym in its own
  // script (ქარ / ENG) — excluded from BOTH the text and the a11y-name scan for
  // the same reason (it is the language-choice affordance, not content).
  container.querySelectorAll('.locale-switcher').forEach((el) => el.remove())
  const names: string[] = []
  for (const el of container.querySelectorAll('*')) {
    for (const attr of A11Y_NAME_ATTRS) {
      const v = el.getAttribute(attr)
      if (v) names.push(v)
    }
  }
  return { text: container.textContent ?? '', names }
}

function renderPageText(slug: string, locale: string): string {
  return renderPage(slug, locale).text
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

    // (d) the ACCESSIBLE-NAME tree, the seam the header social links escaped from:
    //     no LocaleString bag may String()-flatten into an aria-label/title/alt,
    //     in ANY locale. (The exact 0093 defect — accessible name "[object Object]".)
    for (const locale of LOCALES) {
      it(`${slug} / ${locale} — no [object Object] in the accessible-name tree`, () => {
        const { names } = renderPage(slug, locale)
        const flattened = names.filter((n) => n.includes('[object Object]'))
        expect(
          flattened,
          `accessible name(s) in ${slug}/${locale} are String()-flattened LocaleString bags — a bag reached an aria/title/alt slot without resolution`,
        ).toEqual([])
      })
    }
  }

  // (d′) accessible-name locale integrity — an aria-label/title on /en must be
  //      Georgian-free (a KA-only value leaking into the a11y tree is invisible to
  //      the textContent gate but read aloud to an /en AT user). The locale-switcher
  //      endonyms are already excluded in renderPage.
  it('the accessible-name tree of /en pages carries no leaked tenant script', () => {
    for (const slug of PAGES) {
      const { names } = renderPage(slug, 'en')
      const leaked = names.filter((n) => TENANT_SCRIPT.test(n))
      expect(
        leaked,
        `Georgian leaked into an accessible name on the /en render of ${slug} (aria/title/alt): ${JSON.stringify(leaked)}`,
      ).toEqual([])
    }
  })
})
