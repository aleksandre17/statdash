import { useState, useEffect, lazy, Suspense } from 'react'
import { modeRegistry }             from '@statdash/engine'
import { bootstrapSite }            from '@/data/site-manifest'
import type { SiteBootstrap }       from '@/data/site-manifest'
import { registerFormatters }       from '@/i18n/formatters'
import { SuspenseFallback }         from './SuspenseFallback'

// ── Code-split renderer boundary ──────────────────────────────────────────────
//  The heavy renderer graph — the @statdash/react engine + the panel/node plugins
//  (ApexCharts, Leaflet) registered by setupRegistrations() — lives behind this
//  React.lazy boundary. Keeping it out of the eager entry chunk means the shell
//  (bootstrap + AppSkeleton) stays small; the engine downloads once the site has
//  bootstrapped and the first page is about to render. Lazy is transparent — the
//  same manifest renders through the same SiteProvider/routes (see RendererSurface).
const RendererSurface = lazy(() => import('./RendererSurface'))

function AppSkeleton() {
  return (
    <div className="app-skeleton" aria-busy="true" aria-label="Loading…">
      <div className="app-skeleton__nav" />
      <div className="app-skeleton__page">
        <div className="app-skeleton__header" />
        <div className="app-skeleton__content" />
      </div>
    </div>
  )
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<SiteBootstrap | null>(null)

  useEffect(() => {
    bootstrapSite().then((boot) => {
      // Modes + locale formatters are manifest data (ADR-0026): register
      // whichever set the active manifest carries — local fallback or
      // /api/bootstrap — before any page renders (App gates render on
      // `bootstrap`, and the AppSkeleton has no formatted content, so this
      // always runs first). Downstream ModeContext.resolve() / useFmt() read
      // the registries at render time.
      boot.manifest.modes.forEach((m) => modeRegistry.register(m))
      registerFormatters(boot.manifest.i18n.locales)
      setBootstrap(boot)
    })
  }, [])

  if (!bootstrap) return <AppSkeleton />

  const { manifest, stores } = bootstrap

  // The renderer chunk is in flight only on the very first page load; the
  // accessible SuspenseFallback reuses the AppSkeleton structure so there is no
  // layout shift between boot and the renderer mounting (WCAG / Law 9).
  return (
    <Suspense fallback={<SuspenseFallback label="Loading…" />}>
      <RendererSurface manifest={manifest} stores={stores} />
    </Suspense>
  )
}