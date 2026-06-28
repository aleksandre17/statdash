// @vitest-environment jsdom
//
// ── LocaleString RENDER guard — no raw { ka, en } bag may reach output ─────────
//
//  THE INVARIANT (a regression-class gate, the permanent sibling of the
//  perspective-render-validation render fitness): every display LocaleString is
//  resolved to a concrete active-locale string AT ITS BOUNDARY before it reaches a
//  rendered React child or a String()-flattened template. A raw bilingual bag that
//  escapes its resolve-at-boundary seam fails the render in one of two observable
//  ways, and this gate asserts NEITHER occurs across every real Geostat page × every
//  locale × every perspective:
//
//    1. JSX-child object  — `{ {ka,en} }` as a React child throws "Objects are not
//       valid as a React child (found: object with keys {ka, en})". Per-node
//       NodeErrorBoundaries SWALLOW the throw into a fallback, so a plain render
//       wouldn't surface it — but React still logs the violation to console.error,
//       which we capture.
//    2. String()-flatten  — a primitive that String()s the bag (a template var, a
//       concat) bakes the literal "[object Object]" into the DOM text. We scan the
//       rendered textContent for it.
//
//  This is the regression that shipped when ~255 provisioning display strings became
//  { ka, en } LocaleStrings while several render/parse boundaries (page-header title +
//  crumbs, KPI unit/trendSub, nav labels, section view-toggle labels, resolveTemplate)
//  still passed the raw bag through. The fix resolved each boundary via the canonical
//  resolveLocaleString / resolveTemplate seam (driven by the ctx active locale, Law 1);
//  this gate holds that line so the class cannot return.
//
//  WHY render (not a static label scan): the existing labelCompleteness gate proves
//  authoring labels are COMPLETE bilingual bags; this gate proves the runtime RESOLVES
//  them. Complementary halves — authoring completeness vs render resolution.
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
  i18next.init({ lng: 'ka', fallbackLng: 'ka', resources: {}, interpolation: { escapeValue: false } })
  setupRegistrations()
  registerFormatters(buildManifest().i18n.locales)
})
afterEach(() => cleanup())

function renderPage(slug: string, locale: string, perspective?: string) {
  const manifest = buildManifest()
  const url = `/${locale}/${slug}${perspective ? `?mode=${perspective}` : ''}`
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

// The locales the manifest actually ships (DERIVED, never hardcoded — Law 1). The gate
// drives EVERY shipped locale, so a bag resolved only in the default locale still fails.
const LOCALES: string[] = (buildManifest().i18n as { locales: string[] }).locales
// EVERY shipped page, the index/landing/PORTAL page INCLUDED. The landing page
// (hero + stats-carousel) was originally OUTSIDE this matrix, which is exactly how a
// raw { ka, en } unit bag (StatItem.unit) shipped to a React child below the 3 cards
// after the 255-string bilingualization. The portal composition is now in the gate.
const PAGES = ['landing', 'gdp', 'accounts', 'regional'] as const
// undefined = the page default perspective; 'range' = the non-default (its own owned
// filter/KPI/badge surfaces, a distinct set of LocaleStrings to resolve).
const PERSPECTIVES: (string | undefined)[] = [undefined, 'range']

// Signature of a raw LocaleString reaching a React child, captured from console.error:
// React's child-object violation ("Objects are not valid as a React child (found:
// object with keys {ka, en})"). This is the PRECISE signal for the regression class.
// We deliberately do NOT key off the generic "[renderNode] shell crashed" log — an
// unrelated environmental crash (e.g. `Worker is not defined`, which jsdom lacks, in
// the geograph map) is a shell crash but not a LocaleString defect, and would be a
// false positive. The String()-flatten half of the class is covered by the
// "[object Object]" textContent scan below.
const REACT_CHILD_VIOLATION = /not valid as a React child/i

describe('LocaleString render guard — every display bag resolves at its boundary', () => {
  for (const slug of PAGES) {
    for (const locale of LOCALES) {
      for (const perspective of PERSPECTIVES) {
        const label = `${slug} / ${locale} / ${perspective ?? 'default'}`
        it(`renders ${label} with no raw { ka, en } bag in any child or template`, () => {
          const errors: string[] = []
          const orig = console.error
          console.error = (...a: unknown[]) => {
            errors.push(
              a.map(x => (typeof x === 'string' ? x : x instanceof Error ? (x.stack ?? x.message) : (() => { try { return JSON.stringify(x) } catch { return String(x) } })())).join(' '),
            )
          }
          let textContent = ''
          try {
            const { container } = renderPage(slug, locale, perspective)
            textContent = container.textContent ?? ''
          } finally {
            console.error = orig
          }

          // (1) JSX-child object — React logged a child-type violation: a raw bag
          //     reached a child unresolved.
          const childViolations = errors.filter(e => REACT_CHILD_VIOLATION.test(e))
          expect(childViolations, `raw LocaleString reached a React child in ${label}:\n${childViolations.join('\n')}`).toEqual([])

          // (2) String()-flatten — the bag was coerced into DOM text.
          expect(textContent, `"[object Object]" in rendered text of ${label} — a LocaleString was String()-flattened`).not.toContain('[object Object]')
        })
      }
    }
  }
})
