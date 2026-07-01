// ── RendererSurface — the code-split renderer boundary ────────────────────────
//
//  This module is the single LAZY boundary for the heavy renderer graph. It is
//  loaded via React.lazy from App.tsx (behind an accessible <Suspense>), so its
//  entire static import closure is pulled OUT of the eager entry chunk:
//
//    • setupRegistrations() → @plugins/panels (ApexCharts ~540 kB) +
//                             @plugins/nodes  (Leaflet / react-leaflet)
//    • SiteProvider + LocaleGuard → @statdash/react/engine (NodePageRenderer,
//                             nodeRegistry) + AppChrome
//
//  The eager shell (main.tsx → App.tsx bootstrap + AppSkeleton) stays small; the
//  charting/map engine and the full renderer only download once the site has
//  bootstrapped and a page is about to render. Behaviour is byte-identical — lazy
//  loading is transparent: App still injects the same manifest into the same
//  SiteProvider seam, the same routes resolve, the same NodePageRenderer renders.
//
//  ── Registration ordering (invariant) ────────────────────────────────────────
//  main.tsx runs i18next.init() synchronously before ReactDOM.render(), and
//  setupRegistrations() is invoked at the TOP LEVEL of this module — so it runs
//  exactly once, on first import of the surface, AFTER i18next is ready and BEFORE
//  any page renders (App gates the lazy surface behind `bootstrap`, and React
//  resolves this module's code before mounting RendererSurface). This preserves
//  the original main.tsx ordering (init → register → render) across the split.
//
//  setupRegistrations itself stays a plain, synchronously-importable function:
//  the second-tenant + inner-sidebar fitness tests import it (and LocaleGuard)
//  directly and call it eagerly — those paths never load through this lazy module
//  and are unaffected by the split.
//
import { Routes, Route, Navigate } from 'react-router-dom'
import { SiteProvider }            from '@statdash/react'
import { RouteScrollManager }      from '@statdash/react/engine'
import { LocaleGuard }             from './LocaleGuard'
import { setupRegistrations }      from '../setupRegistrations'
import type { SiteManifest }       from '@/data/site-manifest'
import type { DataStore }          from '@statdash/engine'

// Capability registration runs once, at module load — the heavy plugin graph
// (panels → ApexCharts, nodes → Leaflet) is part of THIS chunk's closure.
setupRegistrations()

export interface RendererSurfaceProps {
  manifest: SiteManifest
  stores:   Record<string, DataStore>
}

export default function RendererSurface({ manifest, stores }: RendererSurfaceProps) {
  return (
    <SiteProvider
      stores={stores}
      pages={manifest.pages}
      nav={manifest.nav}
      chrome={manifest.chrome}
      chromeConfig={manifest.chromeConfig}
      i18n={manifest.i18n}
    >
      {/* Scroll parity: soft-nav resets to top (or cross-page anchor) like a hard load. */}
      <RouteScrollManager />
      <Routes>
        <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />} />
        <Route path="*"          element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
      </Routes>
    </SiteProvider>
  )
}
