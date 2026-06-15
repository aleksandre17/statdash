import type { DataSourceDef, NamedDataSpec, SiteDef, CanvasPage } from '../types/constructor'

// ── Mock seed data for the Constructor prototype ──────────────────────────────
// Seeded once at app start (App.tsx) so every step is immediately runnable.
// Replaced by the real config API in Phase 2.5 — `src/data` stays the only seam.

export const MOCK_SOURCES: DataSourceDef[] = [
  { id: 'ds-1', name: 'GeoStat SDMX API', type: 'sdmx-json', url: 'https://api.geostat.ge/sdmx', config: {}, status: 'connected' },
  { id: 'ds-2', name: 'Regional REST',    type: 'rest', url: 'https://api.geostat.ge/rest', config: {}, status: 'idle'      },
]

export const MOCK_SPECS: NamedDataSpec[] = [
  {
    id: 'spec-1', name: 'GDP Annual',
    description: 'Gross Domestic Product by year',
    // Cast: mock literals approximate engine DataSpec shapes for the prototype.
    spec: { type: 'timeseries', code: 'GDP', years: [2019, 2020, 2021, 2022, 2023] } as NamedDataSpec['spec'],
  },
  {
    id: 'spec-2', name: 'Exports Growth',
    description: 'Year-over-year export growth rates',
    spec: { type: 'growth', code: 'EXP', years: [2019, 2020, 2021, 2022, 2023] } as NamedDataSpec['spec'],
  },
  {
    id: 'spec-3', name: 'Trade Ratios',
    description: 'Export/GDP and Import/GDP ratios',
    spec: { type: 'ratio-list', pairs: [{ code: 'EXP', denom: 'GDP', label: 'Export/GDP' }] } as NamedDataSpec['spec'],
  },
]

export const MOCK_SITE: SiteDef = {
  name: 'GeoStat Dashboard',
  defaultLocale: 'ka',
  nav: [
    { id: 'nav-1', label: { ka: 'მთავარი',              en: 'Home'           }, pageId: 'page-1', order: 0 },
    { id: 'nav-2', label: { ka: 'მშპ',                  en: 'GDP'            }, pageId: 'page-2', order: 1 },
    { id: 'nav-3', label: { ka: 'ეროვნული ანგარიშები',  en: 'Nat. Accounts'  }, pageId: 'page-3', order: 2 },
    { id: 'nav-4', label: { ka: 'რეგიონული სტატისტიკა', en: 'Regional Stats' }, pageId: 'page-4', order: 3 },
  ],
  themeOverrides: {},
  dataSourceBindings: { geo: 'ds-1' },
}

export const MOCK_PAGE: CanvasPage = {
  id: 'page-2',
  title: { ka: 'მშპ', en: 'GDP' },
  slug: 'gdp',
  nodeIds: ['node-1', 'node-2', 'node-3'],
  nodes: {
    'node-1': { id: 'node-1', kind: 'filter-bar', config: { position: 'sticky' },     children: [] },
    'node-2': { id: 'node-2', kind: 'kpi-strip',  config: { title: 'Key Indicators' }, children: [] },
    'node-3': { id: 'node-3', kind: 'section',    config: { title: 'GDP Dynamics' },   children: ['panel-1'] },
  },
}
