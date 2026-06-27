// ── Second-tenant fitness fixture — "BrewMetrics" (ADR-0026/0028 DoD) ──────────
//
//  The capstone fitness INPUT for the de-tenanting effort. This is a SiteManifest
//  for a tenant deliberately UNLIKE Geostat in every tenant-shaped axis, so that
//  feeding it through the SAME runner composition path the live API drives
//  (bootstrapSite → SiteProvider → LocaleGuard → AppChrome → NodePageRenderer)
//  PROVES the runner is genuinely tenant-agnostic (Law 1: no privileged dims) with
//  ZERO code change. If the runner can render THIS, it can render any tenant.
//
//  How it is unlike Geostat (every assertion in the fitness test keys off these):
//    • Domain    — coffee-retail demo, not national statistics.
//    • Dimensions — `product`, `channel`, `quarter` (NOT measure/geo/approach/account).
//    • Pages     — 2 pages (`overview`, `sales`), NOT landing/gdp/accounts/regional.
//    • Branding  — BrewMetrics logo/alt/copyright, NOT GeoStat.
//    • Locales   — { en, de }, default `de` (NOT ka/en, no Georgian).
//    • Filters   — product + channel `select` bars (NOT account/year/measure).
//    • Modes     — `quarterly` / `annual` (NOT year/range/compare).
//    • indexPageId — `overview` (NOT `landing`).
//
//  Pure JSON-serializable data: it uses ONLY registered node/panel/page/chrome/
//  control types via their public discriminants — no functions, no Geostat strings.
//  This is exactly the shape /api/bootstrap returns; the runner cannot tell the
//  difference between this fixture and a real backend payload.
//
import type { SiteManifest } from '../site-manifest'

// ── Brand constants — surfaced so the fitness test can assert them by reference ──
export const BREW = {
  pages:   { overview: 'overview', sales: 'sales' },
  locales: ['en', 'de'] as const,
  defaultLocale: 'de' as const,
  logoUrl: 'https://brewmetrics.example/logo.svg',
  logoAlt: 'BrewMetrics — Coffee Retail Analytics',
  copyright: 'BrewMetrics GmbH',
  // Dimension param keys (NOT measure/geo/approach/account) — Law 1 stress.
  dims: ['product', 'channel', 'quarter'] as const,
  // Option labels rendered by the select control shells — asserted in the DOM.
  products: [
    { value: 'espresso', label: 'Espresso Beans' },
    { value: 'cold-brew', label: 'Cold Brew Kit' },
    { value: 'filter',    label: 'Filter Grounds' },
  ],
  channels: [
    { value: 'retail',    label: 'Retail Store' },
    { value: 'online',    label: 'Online Shop' },
    { value: 'wholesale', label: 'Wholesale' },
  ],
  modes: ['quarterly', 'annual'] as const,
} as const

// ── overview page — canonical anatomy: page-header → section ────────────────────
//
//  No filterSchema: proves a page with NO filters still composes (the runner must
//  not assume a filter bar exists). Follows the ONS/Eurostat page anatomy the
//  platform enforces (PageHeader → Sections). The section's own title is tenant
//  content that flows through the full render pipeline (resolveTemplate → DOM) — a
//  data-free render target (no store/observations needed; DB-independent).

function overviewPage(): SiteManifest['pages'][string] {
  return {
    id:   BREW.pages.overview,
    type: 'inner-page',
    // No sidebar for this demo tenant — chrome override hides InnerSidebar so the
    // page renders without tenant nav (different chrome from Geostat default).
    chrome: { InnerSidebar: 'hidden' },
    children: [
      {
        type:  'page-header',
        title: 'BrewMetrics Overview',
      },
      {
        type:  'section',
        id:    'overview-intro',
        title: 'Coffee Performance Summary',
      },
    ],
  } as SiteManifest['pages'][string]
}

// ── sales page — inner-page driven by a NON-Geostat filterSchema ───────────────
//
//  filterSchema.bars carries TWO select bars keyed on `product` and `channel`
//  (dimensions Geostat never had). The page hosts a `filter-bar` node, which reads
//  the derived bars from FilterProvider and renders the select controls. The
//  fitness test asserts the option LABELS reach the DOM — i.e. the filterSchema
//  genuinely drives the filter bars through the generic pipeline.

function salesPage(): SiteManifest['pages'][string] {
  return {
    id:   BREW.pages.sales,
    type: 'inner-page',
    chrome: { InnerSidebar: 'hidden' },
    filterSchema: {
      // ContextMapping wires flat params → SectionContext dims. Dimension NAMES are
      // tenant-chosen (`product`/`channel`/`quarter`) — the engine treats them as
      // opaque keys (no privileged dimension; Law 1). The active perspective is the
      // `mode` URL param (page.perspectives), not a context dim.
      context: {
        dims: { product: 'product', channel: 'channel', quarter: 'quarter' },
      },
      bars: {
        'dimension-bar': {
          position: 'sticky',
          order: 0,
          filters: {
            // hidden time-mode param (quarterly/annual) — generic, not year/range.
            mode: { type: 'hidden', default: 'quarterly' },
            quarter: { type: 'hidden', default: 'Q1' },
            product: {
              type: 'select',
              label: 'Product',
              emptyLabel: 'All products',
              default: '',
              options: { type: 'static', items: [...BREW.products] },
            },
            channel: {
              type: 'select',
              label: 'Channel',
              emptyLabel: 'All channels',
              default: '',
              options: { type: 'static', items: [...BREW.channels] },
            },
          },
        },
      },
    },
    children: [
      {
        type:  'page-header',
        title: 'BrewMetrics Sales',
      },
      // filter-bar reads the derived bars from FilterProvider (no props needed).
      { type: 'filter-bar' },
      {
        type:  'section',
        id:    'sales-detail',
        title: 'Sales By Channel',
      },
    ],
  } as SiteManifest['pages'][string]
}

// ── The manifest — exact shape /api/bootstrap returns ──────────────────────────

export function secondTenantManifest(): SiteManifest {
  return {
    schemaVersion: 1,
    indexPageId: BREW.pages.overview,
    pages: {
      [BREW.pages.overview]: overviewPage(),
      [BREW.pages.sales]:    salesPage(),
    },
    // Top-bar nav: 2 entries routing to the 2 pages (NOT gdp/accounts/regional).
    nav: [
      { id: BREW.pages.overview, path: '/overview', label: 'Overview', color: '#6F4E37', icon: 'bar-chart', items: [] },
      { id: BREW.pages.sales,    path: '/sales',    label: 'Sales',    color: '#6F4E37', icon: 'document',  items: [] },
    ],
    // Chrome slot → variant routing. AppHeader 'default' renders brand + locale
    // switcher; the page itself hides the inner sidebar (per-page chrome above).
    chrome: {
      AppHeader: 'default',
      AppBanner: 'hidden',
    },
    chromeConfig: {
      logoUrl: BREW.logoUrl,
      logoAlt: BREW.logoAlt,
      // Locale display labels — German + English, NOT 'ქარ'/'ENG'.
      localeLabels: { en: 'EN', de: 'DE' },
      copyright: BREW.copyright,
    },
    // Locale set: en + de, default de. NO ka, no Georgian script.
    i18n: {
      locales: [...BREW.locales],
      defaultLocale: BREW.defaultLocale,
      fallbackLocale: 'en',
    },
    // Rendering modes: quarterly / annual (NOT year/range/compare).
    modes: [
      { id: 'quarterly', label: 'Quarterly', dataKey: 'quarter' },
      { id: 'annual',    label: 'Annual',    dataKey: 'year' },
    ],
    // No datasources — the pages bind to no store (the fitness target is the
    // manifest/render path, not real observations; the empty-store path is valid).
    datasources: [],
  }
}
