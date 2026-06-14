# landing-page.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Landing page pattern (E-2 resolution)
 *
 * Landing page = ContainerPageNode (variant: 'landing') + custom child node types.
 *
 * WHY not a separate 'landing-page' node type:
 *   PageConfig = InnerPageNode | TabPageNode | ContainerPageNode (engine/react/ built-ins).
 *   A new 'landing-page' type would require engine/react/ to know Geostat landing layout
 *   → app content in packages/ = agnosticism violation (PRINCIPLES.md Rule 1).
 *   SiteManifest.pages: Record<string, PageConfig> would need a cast → type gap.
 *
 * Correct pattern (Grafana/Builder.io):
 *   Page layout difference → variant on existing PageConfig type.
 *   Content difference     → custom child node types via nodeRegistry.register().
 *   PageLoader, SiteRenderer, SiteManifest — zero changes.
 *
 * Platform consensus:
 *   Grafana:    home page = regular Dashboard, variant via layout config
 *   Builder.io: landing = Page with hero/features block types, no special Page type
 *   ONS:        landing = a publication page, same renderer, different section structure
 */

import type { ContainerPageNode, SiteManifest } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Module augmentation — app extends NodeTypeMap (src/ only)
// ═══════════════════════════════════════════════════════════════════════════
//
// This declaration lives in src/features/landing/types.ts.
// After augmentation: LandingHeroNode | LandingStatsNode ∈ NodeDef.
// No cast needed in LANDING_PAGE config below. No packages/ change.
//
// Pattern: Vite / Express / React Router use the same mechanism for extensibility.

interface LandingHeroNode {
  type:    'landing-hero'
  layout?: import('@geostat/react').LayoutHints
  view?:   import('@geostat/react').ViewParams
}

interface LandingStatsNode {
  type:    'landing-stats'
  layout?: import('@geostat/react').LayoutHints
  data?:   import('@geostat/react').DataSpec
}

declare module '@geostat/react' {
  interface NodeTypeMap {
    'landing-hero':  LandingHeroNode
    'landing-stats': LandingStatsNode
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Landing page config — ContainerPageNode with variant: 'landing'
// ═══════════════════════════════════════════════════════════════════════════

export const LANDING_PAGE: ContainerPageNode = {
  type:    'container-page',
  variant: 'landing',          // GeostatTheme.shells['container-page'] reads variant → landing layout
  id:      'landing',
  title:   'მთავარი',

  children: [
    // ── Hero ──────────────────────────────────────────────────────────────
    // LandingHeroNode ∈ NodeDef via module augmentation — no cast needed ✅
    {
      type:   'landing-hero',
      layout: { position: 'flow', order: 1, span: 'full' },
      view: {
        subtitle: { $literal: 'საქართველოს სტატისტიკის ეროვნული სამსახური' },
      },
    },

    // ── Key statistics strip ─────────────────────────────────────────────
    {
      type:   'kpi-strip',
      layout: { position: 'flow', order: 2, span: 'full' },
      data: {
        type:       'row-list',
        storeId:    'gdp',
        indicators: ['B1G', 'P3', 'P51G'],
        dims:       { time: { $literal: 2024 } },
      },
    },

    // ── Stats block ───────────────────────────────────────────────────────
    // LandingStatsNode ∈ NodeDef via module augmentation — no cast needed ✅
    {
      type:   'landing-stats',
      layout: { position: 'flow', order: 3, span: 'full' },
      data: {
        type:       'row-list',
        storeId:    'gdp',
        indicators: ['B1G_GROWTH'],
        dims:       { time: { $literal: 2024 } },
      },
    },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// SiteManifest — fully type-safe, no cast anywhere
// ═══════════════════════════════════════════════════════════════════════════

// LANDING_PAGE is ContainerPageNode → satisfies PageConfig → manifest accepts it ✅
// LandingHeroNode / LandingStatsNode ∈ NodeDef via augmentation → children array typed ✅
// No 'landing-page' type, no PageConfig extension, no cast at any level.
declare const gdpStore: import('@geostat/react').DataStore

export const MANIFEST: SiteManifest = {
  stores: { gdp: gdpStore },
  pages: {
    landing: LANDING_PAGE,   // ContainerPageNode ∈ PageConfig ✅ — no cast
    // gdp: GDP_PAGE, accounts: ACCOUNTS_PAGE, ...
  },
  nav: [
    { label: 'მთავარი',   path: '/',        pageId: 'landing', icon: 'home'      },
    { label: 'მშპ',       path: '/gdp',     pageId: 'gdp',     icon: 'bar-chart' },
    { label: 'ანგარიშები', path: '/accounts',pageId: 'accounts',icon: 'document'  },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// setupEngine — landing child node registrations (src/app/setupEngine.ts)
// ═══════════════════════════════════════════════════════════════════════════

// Landing-specific node types are registered in src/ — engine/react/ never knows them.
// engine.renderNode encounters 'landing-hero' → nodeRegistry.get('landing-hero') → renderer ✅

// import { engine, nodeRegistry } from '@geostat/react'
// import { LandingHeroRenderer }  from '../features/landing/LandingHeroRenderer'
// import { LandingStatsRenderer } from '../features/landing/LandingStatsRenderer'
//
// nodeRegistry.register('landing-hero', LandingHeroRenderer, {
//   label:    'სალანდინგო ჰირო',
//   icon:     'home',
//   category: 'layout',
// })
//
// nodeRegistry.register('landing-stats', LandingStatsRenderer, {
//   label:    'სტატისტიკის ბლოკი',
//   icon:     'bar-chart',
//   category: 'data',
// })


// ═══════════════════════════════════════════════════════════════════════════
// ThemeConfig — ContainerPageNode shell reads variant → landing layout
// ═══════════════════════════════════════════════════════════════════════════

// src/app/theme.ts — GeostatTheme:
//
// 'container-page': ({ def, children }) => {
//   if (def.variant === 'landing') return <LandingLayout children={children} />
//   return <DefaultContainerLayout children={children} />
// }
//
// No new shell type. variant = CSS/layout switch inside existing shell. ✅


// ═══════════════════════════════════════════════════════════════════════════
// Route wiring — identical to every other page
// ═══════════════════════════════════════════════════════════════════════════

// routes.tsx:
//   <Route path="/"         element={<PageLoader pageId="landing"   />} />
//   <Route path="/gdp"      element={<PageLoader pageId="gdp"       />} />
//   <Route path="/accounts" element={<PageLoader pageId="accounts"  />} />
//
// PageLoader: usePageById('landing') → ContainerPageNode → SiteRenderer → engine.renderNode
// Zero special-casing. No lazy-loading divergence. Same pipeline for every page. ✅


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// ❌ nodeRegistry.register('landing-page', LandingPageRenderer, { category: 'page' })
//    'landing-page' ∉ PageConfig union → SiteManifest.pages type error.
//    engine/react/ would need to know Geostat landing layout → agnosticism violation.

// ❌ interface LandingPageNode extends PageConfigBase { type: 'landing-page'; ... }
//    Adding app-specific page type to engine/react/ = app content in packages/ ❌

// ❌ if (page.type === 'landing-page') return <LandingPageRenderer ... />
//    Special-casing in PageLoader / SiteRenderer = OCP violation.
//    Every new page type would require changing the renderer.

// ✅ ContainerPageNode { variant: 'landing' } + shell reads variant
//    + custom child types via nodeRegistry — open/closed: add new child type = zero framework change.
```
