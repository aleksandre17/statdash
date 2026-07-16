// @vitest-environment jsdom
//
// ── Perspective-axis RENDER fitness — the user-facing axis, page by page ───────
//
//  Renders the REAL Geostat pages (gdp/accounts/regional) from the provisioning
//  manifest, in BOTH perspectives (year/range) × BOTH locales (ka/en), through the
//  SAME composition the live runner drives (SiteProvider → MemoryRouter → LocaleGuard
//  → AppChrome → NodePageRenderer). Perspective is driven by the URL (?mode=range) —
//  exactly as a real user toggling the bar writes it (the permalink path).
//
//  Asserts the THREE structural surfaces the perspective-axis refactor owns:
//    1. perspective-bar toggle  — 2 tabs, order [year,range], localized labels +
//                                 icons, aria-selected follows the URL.
//    2. KPI visibility (when)   — each strip shows EXACTLY its perspective's KPIs;
//                                 the other perspective's KPIs do NOT leak.
//    3. filter-item visibleWhen — year-select shows in `year`; from/to range
//                                 selects show in `range`; never both.
//
//  Data VALUES are NOT asserted here: no live API/DB is reachable in CI/this env, so
//  data-bound nodes resolve against the empty staticStore (the resolveStore fallback).
//  That is by design — interpretKpis filters by `when` BEFORE reading data, and the
//  bar + filter gates are pure config. Value correctness is the data-pipeline's own
//  concern (proven against the seeded stack in work/OVERNIGHT-5.md), not this axis's.
//
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

// ── Load the provisioning manifest (the live /api/bootstrap source) from disk ──
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
  const manifest = buildManifest()
  registerFormatters(manifest.i18n.locales)
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

// ── The perspective-axis yardstick (extracted from the provisioning configs) ──
//  EVERY display surface here is a {ka,en} bag resolved by the ACTIVE locale — the
//  perspective-bar tab labels, the range filter-select label, AND the KPI labels. The
//  engine localizes every display LocaleString at its boundary (resolveTemplate →
//  ctx.locale, wired from the URL), so the /en render reads the en values and the /ka
//  render the ka values. The yardstick is therefore locale-keyed on every surface;
//  asserting a KPI's ka label on the en render (or vice-versa) would be a leak, exactly
//  what FF-RENDER-NO-LOCALE-LEAK guards.
const TAB_LABELS = { ka: { year: 'წლიური', range: 'დინამიკა' }, en: { year: 'Annual', range: 'Dynamics' } } as const
//  The range from-select's aria-label (a bilingual filter label) per active locale.
const RANGE_LABEL = { ka: 'შუალედი:', en: 'Interval:' } as const

const SPEC = {
  gdp: {
    yearKpis: {
      ka: ['მშპ მიმდინარე ფასებში', 'რეალური ზრდა', 'მშპ ერთ სულზე', 'მშპ-ის დეფლატორი'],
      en: ['GDP at current prices', 'Real growth', 'GDP per capita', 'GDP deflator'],
    },
    rangeKpis: {
      ka: ['მშპ — საშ. წლიური ზრდა', 'ერთ სულზე — საშ. ზრდა', 'მშპ — საბოლოო წელი'],
      en: ['GDP — avg. annual growth', 'Per capita — avg. growth', 'GDP — final year'],
    },
  },
  accounts: {
    yearKpis: {
      ka: ['მთლიანი ეროვნული შემოსავალი', 'მთლიანი განკარგვადი შემოსავალი', 'მთლიანი დანაზოგი'],
      en: ['Gross National Income', 'Gross Disposable Income', 'Gross Saving'],
    },
    rangeKpis: {
      ka: ['შრომის წილი დამატებულ ღირებულებაში', 'გამოშვება — საშუალო წლიური ზრდა'],
      en: ['Labour share in value added', 'Output — average annual growth'],
    },
  },
  regional: {
    // YEAR strip (image6, admin C): 4 KPIs — GVA · nominal yoy growth · Share in GDP
    // (C2, renamed) · full-period average nominal growth (reg-cagr-year, spanFrom→spanTo).
    // The last is asserted by its token-free prefix "საშუალო ნომინალური ზრდა" /
    // "Average nominal growth" — distinct from the RANGE window KPI "საშუალო წლიური ზრდა" /
    // "Average annual growth" (reg-avg-growth), so the two never cross-leak. (The
    // ({spanFrom}–{spanTo}) year span renders empty here — empty staticStore has no time
    // dims — and resolves live to e.g. (2010–2024); the prefix is the stable yardstick.)
    yearKpis: {
      ka: ['მთლიანი დამატებული ღირებულება', 'წლიური ზრდა (წინა წელთან)', 'მშპ-ში წილი', 'საშუალო ნომინალური ზრდა'],
      en: ['Gross Value Added', 'Annual growth (year on year)', 'Share in GDP', 'Average nominal growth'],
    },
    // RANGE strip: 4 window KPIs bound to the user-selected fromYear/toYear span.
    // The {fromYear}/{toYear} title tokens resolve to em-dash here (empty staticStore
    // has no time dims — the HONEST unresolved state, same convention the year-strip
    // span comment above documents; live they resolve to e.g. 2010/2024). The from/to
    // pair therefore shares ONE rendered title "… — —", asserted once; the other two
    // are asserted by their token-free prefixes (same yardstick style as yearKpis).
    rangeKpis: {
      ka: ['დამატებული ღირებულება — საშუალო წლიური ზრდა', 'დამატებული ღირებულება — —', 'საშუალო წლიური ზრდა ('],
      en: ['Value added — average annual growth', 'Value added — —', 'Average annual growth ('],
    },
  },
} as const

const kpiText = (c: HTMLElement) => (c.querySelector('.kpi-strip')?.textContent ?? '')
const comboLabels = () => screen.queryAllByRole('combobox').map(c => c.getAttribute('aria-label') ?? '')

for (const slug of ['gdp', 'accounts', 'regional'] as const) {
  for (const locale of ['ka', 'en'] as const) {
    describe(`${slug} / ${locale}`, () => {
      // ── 1. perspective-bar toggle ────────────────────────────────────────────
      it('renders the 2-button axis toggle: order [year,range], localized labels + icons, active follows URL', () => {
        const { container: cy } = renderPage(slug, locale /* default = year */)
        const tabsY = screen.getAllByRole('tab')
        expect(tabsY).toHaveLength(2)
        expect(tabsY[0]).toHaveTextContent(TAB_LABELS[locale].year)
        expect(tabsY[1]).toHaveTextContent(TAB_LABELS[locale].range)
        expect(tabsY[0].querySelector('[data-icon="calendar"]')).toBeTruthy()
        expect(tabsY[1].querySelector('[data-icon="calendar-range"]')).toBeTruthy()
        expect(tabsY[0]).toHaveAttribute('aria-selected', 'true')   // default perspective active
        expect(tabsY[1]).toHaveAttribute('aria-selected', 'false')
        cleanup()

        // ?mode=range deep-link → range tab active (the permalink restores the view)
        renderPage(slug, locale, 'range')
        const tabsR = screen.getAllByRole('tab')
        expect(tabsR[0]).toHaveAttribute('aria-selected', 'false')
        expect(tabsR[1]).toHaveAttribute('aria-selected', 'true')
        void cy
      })

      // ── 2. KPI visibility partition (KpiSpec.when → perspective-is) ───────────
      it('shows EXACTLY the active perspective KPIs; the other perspective KPIs do not leak', () => {
        const yearKpis  = SPEC[slug].yearKpis[locale]
        const rangeKpis = SPEC[slug].rangeKpis[locale]
        const { container: cy } = renderPage(slug, locale)
        const yText = kpiText(cy)
        for (const k of yearKpis)  expect(yText, `year KPI "${k}" present`).toContain(k)
        for (const k of rangeKpis) expect(yText, `range KPI "${k}" hidden in year`).not.toContain(k)
        cleanup()

        const { container: cr } = renderPage(slug, locale, 'range')
        const rText = kpiText(cr)
        for (const k of rangeKpis) expect(rText, `range KPI "${k}" present`).toContain(k)
        for (const k of yearKpis)  expect(rText, `year KPI "${k}" hidden in range`).not.toContain(k)
      })

      // ── 3. filter-item visibility partition (ParamMeta.visibleWhen) ──────────
      it('year-select shows in `year`; from/to range selects show in `range`; never both', () => {
        renderPage(slug, locale)
        const yCombos = comboLabels()
        expect(yCombos, 'year-select present in year').toContain('Year')
        expect(yCombos, 'from-range hidden in year').not.toContain(RANGE_LABEL[locale])
        cleanup()

        renderPage(slug, locale, 'range')
        const rCombos = comboLabels()
        expect(rCombos, 'from-range present in range').toContain(RANGE_LABEL[locale])
        expect(rCombos, 'year-select hidden in range').not.toContain('Year')
      })
    })
  }
}

// ── 4. permalink default-elision at the page level (Law 9) ────────────────────
//  The dedicated FilterProvider round-trip proof lives in
//  packages/react/src/context/perspectivePermalink.fitness.test.tsx (deep-link,
//  derived param, default-elision, full cycle). Here we confirm the page-level
//  consequence: the DEFAULT perspective renders from a CLEAN url (no ?mode=) and
//  reads back as active — the elided default round-trips.
it('the default perspective renders active from a clean URL (no ?mode= param)', () => {
  renderPage('gdp', 'ka')   // no perspective param in the URL
  const tabs = screen.getAllByRole('tab')
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')   // year (default) active despite elided param
})
