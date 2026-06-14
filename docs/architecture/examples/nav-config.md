# nav-config.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — nav.config.ts
 *
 * Site navigation — declared independently of PageConfig.
 * NavItem[] → SiteProvider.nav → useSiteNav()
 *
 * Key: nav is NOT derived from pages. It's declared here directly.
 * PageConfig has no nav field (Agreement I-1).
 *
 * Phase 2: Constructor writes these rows to nav DB table independently.
 */

import type { NavItem } from '@geostat/react'

export const NAV: NavItem[] = [
  // ── Primary navigation ──────────────────────────────────────────────
  {
    label:  'მთლიანი შიდა პროდუქტი',
    icon:   'bar-chart',
    path:   '/gdp',
    pageId: 'gdp',           // links to PageConfig.id
    color:  '#0080BE',
    items: [
      { label: 'წლიური',       anchor: 'gdp-annual' },
      { label: 'კვარტალური',   anchor: 'gdp-quarterly' },
      { label: 'საგარეო სექტორი', anchor: 'gdp-external' },
    ],
  },
  {
    label:  'ეროვნული ანგარიშები',
    icon:   'document',
    path:   '/accounts',
    pageId: 'accounts',
    color:  '#00A878',
    items: [
      { label: 'წარმოების ანგარიში',    anchor: 'production-account' },
      { label: 'შემოსავლის ანგარიში',  anchor: 'income-account' },
      { label: 'კაპიტალის ანგარიში',   anchor: 'capital-account' },
    ],
  },
  {
    label:  'რეგიონული სტატისტიკა',
    icon:   'pin',
    path:   '/regional',
    pageId: 'regional',
    color:  '#E85D04',
  },

  // ── Pages that exist in system but NOT shown in nav ──────────────────
  // Landing page: accessible at '/', not in sidebar nav
  // Option 1: omit from NAV[] entirely (no entry = not in nav)
  // Option 2: include with hidden: true (explicit, documents existence)
  // { label: 'მთავარი', path: '/', pageId: 'landing', hidden: true },

  // ── External links (no pageId) ────────────────────────────────────────
  // { label: 'API', path: 'https://api.geostat.ge', icon: 'document' },

  // ── Future: nav section header (no page) ─────────────────────────────
  // { label: 'სხვა სექციები', path: '/other', items: [...] },
]


// ── How it's used ────────────────────────────────────────────────────────

// src/data/site-manifest.ts:
// const manifest = {
//   stores: STORE_MANIFEST,
//   pages:  pagesRecord(),
//   nav:    NAV,              ← passed directly, not derived
// }

// src/app/App.tsx:
// <SiteProvider stores={manifest.stores} pages={manifest.pages} nav={manifest.nav}>

// src/components/theme/GeostatAppHeader.tsx:
// function GeostatAppHeader() {
//   const nav = useSiteNav()     // NavItem[] directly
//   const { pathname } = useLocation()
//   const activeItem = nav.find(n => pathname.startsWith(n.path))
//   return <header>...</header>
// }
```
