# geo-map.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — GeoMapNode: library-agnostic geographic visualization
 *
 * Platform model: Grafana Geomap panel (data source + geometry source separate).
 * Shell handles map library (Leaflet / MapLibre / Mapbox). Config is JSON.
 * data?: own DataSpec or inherit ctx.rows. source: GeoSource (3 tiers).
 * onSelect: filter param updated on click — agnostic, not hardcoded.
 */

import type { NodeDef, GeoMapNode, LinksNode, PageHeaderNode } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// GeoSource tiers — same pattern as DatasourceInstanceConfig classifiers
// ═══════════════════════════════════════════════════════════════════════════

// Tier 1 — inline (dev/test only, zero HTTP)
const inlineSource: GeoMapNode['source'] = {
  type:    'inline',
  geojson: { type: 'FeatureCollection', features: [] },   // embedded test data
}

// Tier 2 — registered at bootstrap (setupRegistrations.ts)
const keySource: GeoMapNode['source'] = {
  type: 'key',
  key:  'georgia-regions',   // engine.geoRegistry.register('georgia-regions', geojson)
}

// Tier 3 — URL fetch + cache (ttl: seconds, default 86400 = 24h)
const urlSource: GeoMapNode['source'] = {
  type: 'url',
  href: 'https://cdn.geostat.ge/geo/georgia-regions.geojson',
  ttl:  604800,   // 7 days — geometry rarely changes
}


// ═══════════════════════════════════════════════════════════════════════════
// Pattern A: section owns data, map inherits — chart/table/map toggle
// ═══════════════════════════════════════════════════════════════════════════
//
// Grafana equivalent: row with geomap panel + table panel sharing same datasource.
// All three children inherit ctx.rows from section.data.

const patternA_sectionWithMap: NodeDef = {
  type:   'section',
  layout: { position: 'flow', order: 3, span: 'full' },
  id:     'gva-regional',
  navLabel: 'რეგიონული განაწილება',    // ← appears in sidebar TOC
  data: {
    type:      'timeseries',
    indicator: 'GVA_TOTAL',
    dims:      { time: { $ctx: 'time' } },
  },
  view: { subtitle: 'მლნ ₾', exportable: true },
  children: [
    {
      type:   'geo-map',
      layout: { role: 'map', label: 'რუკა' },
      source:    { type: 'key', key: 'georgia-regions' },
      geoField:  'geo',     // ctx.rows[i]['geo'] matches feature.properties['geo']
      valueField: 'value',  // choropleth intensity
      options: {
        tooltipField: 'label',
        onSelect:     'geo',  // click → filter['geo'] = region code → all sections re-query
      },
    },
    {
      type:   'chart',
      layout: { role: 'chart', label: 'გრაფიკი' },
    },
    {
      type:   'table',
      layout: { role: 'table', label: 'ცხრილი' },
    },
  ],
} as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// Pattern B: standalone map with own data (dashboard/embed style)
// ═══════════════════════════════════════════════════════════════════════════
//
// Grafana equivalent: standalone geomap panel in a grid row.
// No section wrapper — map has its own DataSpec.

const patternB_standaloneMap: NodeDef = {
  type:       'geo-map',
  layout:     { position: 'flow', order: 2, span: 'full' },
  data: {
    type:      'timeseries',
    indicator: 'POPULATION',
    dims:      { time: { $ctx: 'time' } },
  },
  source:     { type: 'key', key: 'georgia-municipalities' },
  geoField:   'muni_code',
  valueField: 'value',
  options: {
    tooltipField: 'label',
    onSelect:     'municipality',
    center:       [42.0, 43.5],   // Georgia center
    zoom:         7,
    interactive:  true,
  },
} as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// Pattern C: display-only map (no click, Tier 3 URL source)
// ═══════════════════════════════════════════════════════════════════════════

const patternC_displayOnly: NodeDef = {
  type:       'geo-map',
  layout:     { position: 'flow', order: 4, span: 'full' },
  data: {
    type:      'row-list',
    indicators: ['POVERTY_RATE'],
    dims:      { time: { $ctx: 'time' } },
  },
  source:     { type: 'url', href: 'https://cdn.geostat.ge/geo/georgia.geojson', ttl: 604800 },
  valueField: 'value',
  options: {
    interactive:  false,        // display-only — no click, no cursor pointer
    tooltipField: 'label',
    // onSelect absent → read-only choropleth
  },
} as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// GeoRegistry bootstrap (setupRegistrations.ts)
// ═══════════════════════════════════════════════════════════════════════════

import { engine } from '@geostat/engine'

// src/app/setupRegistrations.ts:
async function setupGeoData() {
  // Tier 2: registered statically (bundled JSON — small datasets)
  const { default: georgiaRegions } = await import('../data/geo/georgia-regions.json')
  engine.geoRegistry.register('georgia-regions', georgiaRegions)

  // Tier 2: pre-fetched at bootstrap (larger datasets with long cache)
  const municipalities = await fetch('/geo/municipalities.geojson').then(r => r.json())
  engine.geoRegistry.register('georgia-municipalities', municipalities)

  // Tier 3 sources: NOT pre-fetched here — shell fetches lazily on first render
  // source: { type:'url', href:'…' } → shell resolves at render time
}
// Result: Tier 2 sources are instant at render (no Suspense).
// Tier 3 sources: shell throws Promise → Suspense skeleton → fetch → render. ✅


// ═══════════════════════════════════════════════════════════════════════════
// LinksNode — methodology / reference links (ONS/Eurostat standard)
// ═══════════════════════════════════════════════════════════════════════════

const methodologyLinks: LinksNode = {
  type:  'links',
  layout: { position: 'flow', order: 99, span: 'full' },
  title: 'მეთოდოლოგია და წყაროები',
  items: [
    {
      label:       'ეროვნული ანგარიშების მეთოდოლოგია',
      href:        'https://www.geostat.ge/media/methodology-na.pdf',
      icon:        'file-text',
      description: 'PDF · 1.2 MB',
    },
    {
      label:    'SNA 2008 — გაეროს სახელმძღვანელო',
      href:     'https://unstats.un.org/unsd/nationalaccount/sna2008.asp',
      icon:     'external-link',
      external: true,
    },
    {
      label:       'Excel — ეროვნული ანგარიშები 2000–2024',
      href:        '/downloads/national-accounts-2000-2024.xlsx',
      icon:        'download',
      description: 'XLSX · 4.7 MB',
      external:    false,   // internal download link — no target="_blank"
    },
  ],
} as LinksNode


// ═══════════════════════════════════════════════════════════════════════════
// PageHeaderNode — title + badge + description (ONS publication style)
// ═══════════════════════════════════════════════════════════════════════════

// Pattern A: static badge (always preliminary for this dataset)
const pageHeaderStatic: PageHeaderNode = {
  type:     'page-header',
  layout:   { position: 'flow', order: 1, span: 'full' },
  subtitle: { op: 'template', tmpl: 'SNA 2008 · {time} · საქართველო' },
  badge:    { type: 'static', label: 'წინასწარი', variant: 'warning' },
} as PageHeaderNode

// Pattern B: data-driven badge (reads obs_status from ctx.rows[0])
const pageHeaderDataDriven: PageHeaderNode = {
  type:   'page-header',
  layout: { position: 'flow', order: 1, span: 'full' },
  data:   { type: 'row-list', indicators: ['B1G'], dims: { time: { $ctx: 'time' } } },
  badge: {
    type:  'data',
    field: 'obs_status',
    map: {
      'P': { label: 'წინასწარი',   variant: 'warning' },
      'E': { label: 'შეფასებული', variant: 'info'    },
      'F': { label: 'საბოლოო',    variant: 'success'  },
      'R': { label: 'გადახედული', variant: 'info'    },
    },
  },
} as PageHeaderNode

// Pattern C: description paragraph (WorldBank/IMF note style)
const pageHeaderWithDescription: PageHeaderNode = {
  type:        'page-header',
  layout:      { position: 'flow', order: 1, span: 'full' },
  description: 'მთლიანი შიდა პროდუქტი (მშპ) — ეს არის ეროვნული ანგარიშების სისტემის (SNA 2008) მიხედვით გამოანგარიშებული ყველა საქონლისა და მომსახურების ღირებულება, რომელიც წარმოებულია ქვეყნის ტერიტორიაზე გარკვეული პერიოდის განმავლობაში.',
} as PageHeaderNode


// ═══════════════════════════════════════════════════════════════════════════
// Full regional page — all new nodes combined
// ═══════════════════════════════════════════════════════════════════════════

export const REGIONAL_PAGE: NodeDef = {
  type:     'inner-page',
  id:       'regional',
  title:    'რეგიონული სტატისტიკა',
  storeKey: 'regional',

  children: [
    // Sticky filter bar
    {
      type:   'filter-bar',
      layout: { position: 'sticky-top', order: 1 },
      bars: {
        main: {
          position: 'sticky',
          order:    1,
          filters: {
            time: { type: 'year-select', years: { type: 'inline', items: { $cl: 'time' }, field: 'code' }, defaultValue: { from: 'options', pick: 'last' } },
            // chip-select: visible toggle buttons (≤ 4 options) — ONS metric selector pattern
            indicator: {
              type:         'chip-select',
              options:      { type: 'static', items: [
                { value: 'GVA_TOTAL',  label: 'მთლიანი დამატებული ღირ.' },
                { value: 'POPULATION', label: 'მოსახლეობა'              },
                { value: 'GVA_PC',     label: 'მშპ სულ მოსახლეზე'       },
              ]},
              defaultValue: 'GVA_TOTAL',
              multiple:     false,
            },
          },
        },
      },
    },

    // Publication-style page header with data-driven badge
    {
      type:   'page-header',
      layout: { position: 'flow', order: 2, span: 'full' },
      data:   { type: 'row-list', indicators: [{ $ctx: 'indicator' }], dims: { time: { $ctx: 'time' } } },
      badge:  { type: 'data', field: 'obs_status', map: {
        'P': { label: 'წინასწარი', variant: 'warning' },
        'F': { label: 'საბოლოო',  variant: 'success'  },
      }},
    },

    // Section with map + chart + table toggle
    {
      type:     'section',
      id:       'regional-breakdown',
      navLabel: 'რეგიონული განაწილება',
      layout:   { position: 'flow', order: 3, span: 'full' },
      data: {
        type:      'timeseries',
        indicator: { $ctx: 'indicator' },
        dims:      { time: { $ctx: 'time' } },
      },
      view: { exportable: true },
      children: [
        { type: 'geo-map', layout: { role: 'map', label: 'რუკა' },
          source: { type: 'key', key: 'georgia-regions' },
          options: { tooltipField: 'label', onSelect: 'geo' } },
        { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
        { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
      ],
    },

    // Methodology links (ONS/Eurostat standard footer)
    {
      type:  'links',
      layout: { position: 'flow', order: 4 },
      title: 'მეთოდოლოგია',
      items: [
        { label: 'რეგიონული სტატისტიკის მეთოდოლოგია', href: '/docs/regional-methodology.pdf', icon: 'file-text', description: 'PDF' },
        { label: 'NUTS კლასიფიკაცია — ევროსტატი', href: 'https://ec.europa.eu/eurostat/web/nuts', icon: 'external-link', external: true },
      ],
    },
  ],
} as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// Anti-patterns
// ═══════════════════════════════════════════════════════════════════════════

// ❌ Map library in node config:
//    { type: 'geo-map', leafletOptions: { zoomControl: false }, mapboxToken: '...' }
// ✅ Library options in shell. GeoMapOptions = semantic (center, zoom, interactive).
//    Library-specific options: shell reads theme tokens or shell-level config.

// ❌ Hardcoded geo field:
//    { type: 'geo-map' }  // shell assumes 'region_code' field
// ✅ geoField: 'geo' (explicit, or explicit default 'geo' documented in types)

// ❌ onSelect hardcoded to specific filter key in shell:
//    // shell always sets filter['geo'] on click
// ✅ options: { onSelect: 'geo' } — parameterized. Display-only: omit onSelect.

// ❌ GeoJSON fetched in config at definition time:
//    const geojson = await fetch('...')  // async in config — impossible (JSON requirement)
// ✅ source: { type: 'url', href: '...' } — shell fetches lazily at render time.

declare const React: { createElement: Function }
```
