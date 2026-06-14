# Site Manifest + Navigation

> Navigation is a site-level concern. Pages are content. They are independent.
> Grafana bootData + Retool fetchAppManifest pattern.

---

## Core Insight

```
PageConfig = content ("what's on the page")
NavItem    = navigation ("how pages are linked in the sidebar")
```

These are independent data models. PageConfig has NO nav field.
Constructor writes to two independent DB tables.

---

## SiteManifest — three independent concerns

```ts
interface SiteManifest {
  stores: Record<string, DataStore>      // store registry
  pages:  Record<string, PageConfig>     // keyed by id — O(1) lookup
  nav:    NavItem[]                      // site navigation — independent of pages
}
```

---

## NavItem — site navigation type

```ts
interface NavItem {
  label:   string
  icon?:   NavIconKey         // 'bar-chart' | 'document' | 'pin' (open union)
  path:    string             // '/gdp' — route path
  pageId?: string             // → PageConfig.id (optional: external links have no pageId)
  color?:  string             // sidebar accent color
  items?:  NavSubItem[]       // in-page anchors (shown when expanded)
  hidden?: boolean            // exists in system, NOT shown in sidebar nav
}

interface NavSubItem {
  label:  string
  anchor: string   // in-page element id for smooth scroll
}

type NavIconKey = string  // known: 'bar-chart' | 'document' | 'pin' — open string, add freely
```

---

## nav.config.ts — declared independently

```ts
// src/data/nav.config.ts
import type { NavItem } from '@geostat/react'

export const NAV: NavItem[] = [
  {
    label:  'მშპ',
    icon:   'bar-chart',
    path:   '/gdp',
    pageId: 'gdp',
    color:  '#0080BE',
    items: [
      { label: 'წლიური', anchor: 'gdp-annual' },
      { label: 'კვარტალური', anchor: 'gdp-quarterly' },
    ]
  },
  {
    label:  'ეროვნული ანგარიშები',
    icon:   'document',
    path:   '/accounts',
    pageId: 'accounts',
    color:  '#00A878',
  },
  {
    label:  'რეგიონული სტატისტიკა',
    icon:   'pin',
    path:   '/regional',
    pageId: 'regional',
    color:  '#E85D04',
  },
  // Landing page exists in system but NOT in nav:
  // { pageId: 'landing', hidden: true }   // or simply: omit from NAV[]
]
```

---

## PageConfig — NO nav field

```ts
// engine/react/src/engine/types.ts
interface PageConfigBase {
  id:        string
  type:      string
  title:     string
  storeKey?: string           // page default store
  color?:    string           // page accent (breadcrumb, header) — NOT nav concern
  children:  NodeDef[]
  // nav: NavItemDef — REMOVED (Agreement I-1)
}
```

**Why color stays on PageConfig?**
`color` is page identity — used in breadcrumbs, page header accent, tab indicators.
Nav accent color is separate (`NavItem.color`) and may differ.

---

## SiteProvider — three props

```tsx
// engine/react/src/context/SiteContext.tsx
interface SiteProviderProps {
  stores:   Record<string, DataStore>
  pages:    Record<string, PageConfig>  // keyed by id — O(1) lookup
  nav:      NavItem[]
  children: ReactNode
}

function SiteProvider({ stores, pages, nav, children }: SiteProviderProps) {
  return (
    <SiteContext.Provider value={{ stores, pages, nav }}>
      {children}
    </SiteContext.Provider>
  )
}
```

---

## Hooks

```ts
// All three hook from SiteContext:

useStores(): Record<string, DataStore>
// Used by: SiteRenderer → baseCtx.stores

useSiteNav(): NavItem[]
// Used by: GeostatAppHeader, GeostatAppSidebar
// These are () => ReactNode — no props, reads context internally

usePageById(id: string): PageConfig | null
// Sync, O(1) — replaces async loadPage()
// Used by: PageLoader (resolves pageId → PageConfig)
```

---

## fetchSiteManifest — layered bootstrap

```ts
// src/data/site-manifest.ts

async function fetchSiteManifest(): Promise<SiteManifest>

// Layer 1 (VITE_STORE_MODE=static, default):
//   { stores: STORE_MANIFEST, pages: pagesRecord(), nav: NAV }
//   Instant — no network. Dev default.

// Layer 2 (VITE_STORE_MODE=api):
//   MSW intercepts. Simulates real network: latency, loading, errors.
//   npm run dev:api

// Phase 2 (Constructor — production):
//   fetch('/api/site-manifest').then(r => r.json())
//   → { pages: allPageConfigs, nav: navItems, stores?: storeManifest }
//
//   Constructor pages: use href in DataSpec → stores: {} (HttpDataStore handles all)
//   Hand-crafted pages: still use storeId → stores must have the named entries
//
//   Both paths coexist:
//     { type:'timeseries', storeId:'gdp', ... }  → ctx.stores['gdp']   (named store)
//     { type:'timeseries', href:'https://...', } → HttpDataStore        (URL store)
//   App.tsx — zero changes. (Agreement C-4)
```

---

## App.tsx

```tsx
// src/app/App.tsx
const manifest = await fetchSiteManifest()

<ThemeProvider theme={GEOSTAT_THEME}>
  <SiteProvider
    stores={manifest.stores}   // store registry
    pages={manifest.pages}     // all pages, keyed by id
    nav={manifest.nav}         // nav config, independent
  >
    <BrowserRouter>
      <Routes />
    </BrowserRouter>
  </SiteProvider>
</ThemeProvider>
```

---

## Phase 2 — Constructor DB Schema

```sql
-- nav table (independent of pages table)
CREATE TABLE nav_items (
  id        SERIAL PRIMARY KEY,
  label     TEXT NOT NULL,
  icon      TEXT,
  path      TEXT NOT NULL,
  page_id   TEXT REFERENCES pages(id),  -- optional FK
  color     TEXT,
  items     JSONB,                       -- NavSubItem[]
  hidden    BOOLEAN DEFAULT false,
  ord       INTEGER NOT NULL DEFAULT 0
);

-- pages table (no nav column)
CREATE TABLE pages (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  store_key  TEXT,
  color      TEXT,
  children   JSONB NOT NULL  -- NodeDef[]
);
```

**Constructor UX:**
- Reorder nav items: drag → update `ord` in nav table. No page changes.
- Add page: insert into `pages`, optionally insert `nav_items` row.
- Hide page from nav: set `nav_items.hidden = true`. Page still accessible via URL.

---

## GeostatAppHeader — reads useSiteNav()

```tsx
function GeostatAppHeader() {
  const nav            = useSiteNav()          // NavItem[] from SiteProvider
  const { pathname }   = useLocation()         // React Router — active route
  const activeItem     = nav.find(n => pathname.startsWith(n.path))

  return (
    <header className="geostat-header">
      <Logo />
      <nav>
        {nav.filter(n => !n.hidden).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={item === activeItem ? 'active' : ''}
          >
            <NavIcon icon={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
```

---

## PageLoader — 404 and unknown pageId handling (H-5)

> **Grafana pattern:** unknown panel type → `PanelNotFound` with clear message. Page continues.
> **ONS:** explicit "Page not found" with nav link back to home.

```tsx
// engine/react/src/page/PageLoader.tsx

function PageLoader({ pageId }: { pageId: string }): ReactNode {
  const page = usePageById(pageId)   // returns PageConfig | null (sync, O(1))

  if (!page) {
    return <PageNotFound pageId={pageId} />
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <ErrorBoundary fallback={<PageError />}>
        <SiteRenderer page={page} />
      </ErrorBoundary>
    </Suspense>
  )
}

// PageNotFound — minimal, always renders, never throws
function PageNotFound({ pageId }: { pageId: string }): ReactNode {
  return (
    <div className="page-not-found" role="main">
      <h1>გვერდი ვერ მოიძებნა</h1>
      <p>ID: <code>{pageId}</code></p>
      <a href="/">მთავარი გვერდი</a>
    </div>
  )
}
```

**Three failure modes — distinct handling:**

| Situation | `usePageById` | What renders |
|---|---|---|
| Valid pageId, data loads | `PageConfig` | `<SiteRenderer page={page} />` |
| Unknown pageId | `null` | `<PageNotFound pageId={pageId} />` |
| Data error inside renderer | throws | `<ErrorBoundary>` catches → `<PageError />` |
| Data loading (HttpDataStore) | throws Promise | `<Suspense>` catches → `<PageSkeleton />` |

**Hidden pages (nav.hidden = true):**
```ts
// hidden: true → NOT shown in sidebar. But URL still works.
// PageLoader doesn't check hidden — routing handles access.
// If you want to truly block access: route-level guard (not PageLoader's concern).
```

---

## Why Not PageConfig.nav (Anti-Pattern)

```
❌ Problem 1: 1:1 page→nav assumption — landing page breaks it
❌ Problem 2: Nav reorder = edit page config files — wrong responsibility
❌ Problem 3: Nav section headers without pages — impossible
❌ Problem 4: External nav links (href) — need non-page nav items
❌ Problem 5: Constructor — nav and pages in same row — entangled
❌ Problem 6: buildNav() derived nav — always an approximation, not truth

✅ Solution: nav.config.ts + NavItem.pageId? — explicit linking, fully decoupled
```
