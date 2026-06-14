# Migration — Bootstrap, App, Plugin Structure

> Files: `src/setupRegistrations.ts` · `src/main.tsx` · `src/App.tsx`

---

## setupRegistrations.ts — ⑦

```ts
// src/setupRegistrations.ts
import * as Nodes    from '../plugins/nodes'
import * as Chrome   from '../plugins/chrome'
import * as Controls from '../plugins/controls'
import * as Landing  from '../plugins/landing/nodes'
import { registerSlice } from '@geostat/react'

export function setupRegistrations(): void {
  ;[...Object.values(Nodes), ...Object.values(Chrome),
    ...Object.values(Controls), ...Object.values(Landing)].forEach(registerSlice)
  // registerSlice loads META.i18n into i18next per locale (see individual/migration/06-shells.md)
  engine.registerDatasource({ id: 'sdmx-api', create: cfg => new HttpDataStore(cfg) })
  engine.registerDatasource({ id: 'static',   create: cfg => new StaticDataStore(cfg) })
  engine.registerTransform('fromSDMX', fromSDMX)
}
```

---

## main.tsx

```tsx
async function boot() {
  setupRegistrations()                                           // 1. register all plugins + i18n
  const manifest = await fetchSiteManifest()                     // 2. static Phase 1 / fetch Phase 2
  const stores   = engine.buildStoreManifest(manifest.datasources)  // 3. factory.create() — no HTTP
  applyTokens(manifest.tokens ?? {})                             // 4. CSS vars — no FOUC
  createRoot(document.getElementById('root')!).render(
    <App manifest={{ ...manifest, stores }} />                   // 5. React mounts
  )
}
```

---

## App.tsx — i18n routing + AppChrome at app level

```tsx
// ❌ DEPRECATED: AppChrome inside PageLoader (per-route) → remounts on navigation → flash
// ✅ CANONICAL: AppChrome OUTSIDE Routes — app-level, never remounts (Grafana/VS Code pattern)

function App({ manifest }: { manifest: SiteManifest & { stores: Record<string, DataStore> } }) {
  return (
    <SiteProvider stores={manifest.stores} pages={manifest.pages} nav={manifest.nav}
                  chrome={manifest.chrome} i18n={manifest.i18n} locale={manifest.i18n.defaultLocale}>
      <ThemeProvider theme={GEOSTAT_THEME}>
        <BrowserRouter>
          <Routes>
            <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />}>
              <Route element={<AppChrome />}>
                {Object.values(manifest.pages).map(page => (
                  <Route key={page.id} path={page.path!} element={<PageLoader pageId={page.id} />} />
                ))}
              </Route>
            </Route>
            <Route path="*" element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </SiteProvider>
  )
}

function LocaleGuard({ manifest }: { manifest: SiteManifest }) {
  const { locale } = useParams()
  if (!manifest.i18n.locales.includes(locale!))
    return <Navigate to={`/${manifest.i18n.defaultLocale}`} replace />
  return <SiteLocaleProvider locale={locale!}><Outlet /></SiteLocaleProvider>
}
// SiteLocaleProvider updates SiteContext.locale → RenderContext.locale → SectionContext.locale

function PageLoader({ pageId }: { pageId: string }) {
  const page = usePageById(pageId)
  if (!page) return null
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ErrorBoundary fallback={<PageError />}>
        <SiteRenderer key={page.id} def={page} />   // key → remount on nav (stale filter state)
      </ErrorBoundary>
    </Suspense>
  )
}
```

---

## SiteRenderer — React → engine bridge

```tsx
// filterSchema = SOURCE OF TRUTH for all filter state (Grafana: templating.list pattern)
function SiteRenderer({ def }: { def: PageConfigBase }) {
  const theme   = useTheme()
  const stores  = useStores()
  const locale  = useLocale()
  const { i18n } = useI18n()
  const schema  = def.filterSchema ? defineFilters(def.filterSchema) : defineFilters({ bars: {} })
  const filters = useFilters(schema)

  const baseCtx: RenderContext = {
    theme,
    stores,
    pageStoreKey:   def.storeKey,
    dims:           filters.ctx.dims,
    derived:        {},
    rows:           [],
    view:           {} as ResolvedViewParams,
    scope:          { dims: filters.ctx.dims, derived: {} },
    dimContracts:   {},
    locale,
    fallbackLocale: i18n.fallbackLocale,
    classifiers:    {},   // renderNode step 3 fills per-node from resolved store
    display:        {},
  }

  return (
    <FilterProvider value={filters}>
      {renderNode(def, baseCtx)}    // page IS the root — no page.root ❌
    </FilterProvider>
  )
}
```

---

## Full Plugin Structure

### plugins/nodes/ — barrel must include ALL

```
filter-bar/ · kpi-strip/ · row/ · section/ · tabs/ · tab/ · chart/ · table/ · links/
georgraph/ (last in ④ — Leaflet) · page-header/ · inner-page/ · tab-page/
container-page/default/ · container-page/landing/ · layout/{grid,columns,stack,card}/
```

### plugins/chrome/

```
AppHeader/{default,minimal,compact}/
AppSidebar/{default,collapsed,hidden}/
AppFooter/{default,minimal}/
AppBanner/hidden/
LocaleSwitcher/default/   ← NEW (i18n M-5)
AppChrome.tsx             ← NOT a RegistrableSlice (wires chrome slots)
```

### plugins/controls/

```
year-select/ · cascade/ · select/ · range/ · multi-select/
```

---

## Landing Module Augmentation (V-2 + V-6)

```ts
// plugins/landing/types.ts — NOT in engine/react/
declare module '@geostat/react' {
  interface NodeTypeMap {
    'landing-hero':  LandingHeroNode
    'landing-stats': LandingStatsNode
  }
}
export interface LandingHeroNode extends NodeBase {
  type:     'landing-hero'
  title:    LocaleString
  subtitle: LocaleString
  cards:    LandingCardDef[]
}
export interface LandingStatsNode extends NodeBase {
  type:       'landing-stats'
  slides:     LandingSlideItem[]
  autoplayMs?: number
}
// LandingHeroNode ∈ NodeDef ✅ via augmentation — no cast, no packages/ change
```

---

## Phase 2 Readiness — Per Layer

```
engine/core/  → no Phase awareness. Pure logic.
engine/react/   → no Phase awareness. No env checks.
plugins/          → no Phase awareness.
src/manifest.ts   → ONLY place that knows Phase. One function. One line change:
  // Phase 1: return { datasources: DATASOURCE_CONFIGS, pages: pagesRecord(), ... }
  // Phase 2: return fetch('/api/site').then(r => r.json())
pages/            → EXISTS Phase 1, DELETED Phase 2.
src/data/*/raw    → Phase 1 only.
src/i18n/         → Phase 1 registers formatters. Phase 2: same (formatters = app layer).
```