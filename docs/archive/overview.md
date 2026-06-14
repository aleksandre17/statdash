# src/ Structure

> Geostat identity. Configs, data, brand shells, app-specific renderers.

---

## Folder Tree

```
src/
  app/                         — bootstrap, routing, wiring
    App.tsx                    — ThemeProvider + SiteProvider + Router
    routes.tsx                 — all pages → <PageLoader pageId="..." />
    theme.ts                   — GEOSTAT_THEME (ThemeConfig implementation)
    setupEngine.ts             — engine.extend(nodeRegistry) + app node registrations

  components/
    layout/                    — composable chrome structure (HTML skeleton, no brand logic)
      AppChrome.tsx            — { AppHeader, AppSidebar, AppFooter } from useTheme()
      Header.tsx               — HTML structure used by GeostatAppHeader
      Sidebar.tsx              — HTML structure used by GeostatAppSidebar
      Footer.tsx
    theme/                     — ThemeConfig implementations (Geostat brand)
      GeostatSectionShell.tsx
      GeostatFilterBarShell.tsx
      GeostatChartShell.tsx
      GeostatTableShell.tsx
      GeostatKpiCard.tsx
      GeostatInnerPageShell.tsx
      GeostatTabPageShell.tsx
      GeostatContainerPageShell.tsx
      GeostatAppHeader.tsx     — () => ReactNode · useSiteNav() + useLocation()
      GeostatAppSidebar.tsx    — () => ReactNode · useSiteNav()
      GeostatAppFooter.tsx     — () => ReactNode
      GeostatLandingShell.tsx  — landing page shell (NOT in ThemeConfig — src/-level)

  features/
    landing/                   — app-specific node types + renderers
      types.ts                 — LandingHeroNode · LandingStatsNode · LandingPageNode
      landing.config.ts        — PageConfig for landing page
      LandingPageRenderer.tsx  — imports GeostatLandingShell (layer rule #17)
      GeostatLandingShell.tsx
      renderers/
        LandingHeroRenderer.tsx
        LandingStatsRenderer.tsx
    gdp/                       — JSON configs only (no components)
      gdp.config.ts
      gdp.store.ts
      gdp.adapter.ts
    accounts/
      accounts.config.ts
      accounts.store.ts
      accounts.adapter.ts
    regional/
      regional.config.ts
      regional.store.ts
      regional.adapter.ts

  data/                        — site-level data bootstrap
    site.config.ts             — SITE: { stores, pages, nav }
    nav.config.ts              — NAV: NavItem[]  (independent of PageConfig)
    site-manifest.ts           — fetchSiteManifest(): Promise<SiteManifest>
    store-manifest.ts          — STORE_MANIFEST: Record<string, DataStore>
    pages/
      registry.ts              — pagesRecord(): Record<string, PageConfig>  ← Phase 2 swap

  mocks/                       — MSW handlers (Layer 2)
    handlers.ts
    browser.ts

  shared/
    styles/
      global.css
      tokens.css               — design tokens (colors, spacing, typography)
```

---

## Three Separations — strict dep rules

```
data/        ← zero deps on features/ or components/
features/    ← data/ (storeKey strings ONLY — never DataStore instances)
             ← engine/react/ (types)
             ← @geostat/engine (types)
components/  ← engine/react/ (ThemeConfig, Shell props)
             ← @geostat/engine (node types for def pass-through)
app/         ← wires all layers
```

---

## Layer Rule #17 — src/ imports

```
engine/react/ renderer:  ctx.theme.shells['type']           MUST
src/ renderer:             ctx.theme.shells['type']           ✅ (preferred)
                           OR direct import src/ component    ✅ (layer rule — same layer)

LandingPageRenderer imports GeostatLandingShell — NOT exception, layer rule.
```

---

## GEOSTAT_THEME — full wiring

```ts
// src/app/theme.ts
export const GEOSTAT_THEME: ThemeConfig = {
  AppHeader:  GeostatAppHeader,
  AppSidebar: GeostatAppSidebar,
  AppFooter:  GeostatAppFooter,
  shells: {
    ...DEFAULT_THEME.shells,         // functional defaults first
    'section':        GeostatSectionShell,
    'filter-bar':     GeostatFilterBarShell,
    'chart':          GeostatChartShell,
    'table':          GeostatTableShell,
    'kpi-strip':      GeostatKpiCard,
    'inner-page':     GeostatInnerPageShell,
    'tab-page':       GeostatTabPageShell,
    'container-page': GeostatContainerPageShell,
    'landing-page':   GeostatLandingShell,
  }
}
```
