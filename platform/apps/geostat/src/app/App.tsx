import { useState, useEffect, lazy, Suspense } from 'react'
import { AppErrorBoundary }         from '@statdash/react'
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

// ── AppUnavailable — brand-free last-resort fallback screen ────────────────────
//
//  Rendered by AppErrorBoundary when any part of the app tree throws (defense-in-
//  depth for the ADR-0028 fail-soft guarantee, behind the shell-level null-guards).
//  Tenant-NEUTRAL (Law 1/4): plain English framework copy — no brand/agency
//  identity, no tenant locale — the same register as emptyManifest()'s offline
//  page. Self-contained inline styles (no token/stylesheet dependency) so it
//  renders even when the failure is catastrophic enough to have taken the styles
//  or the site context down with it. `role="alert"` surfaces it to assistive tech
//  (WCAG). Visual polish lands once the real stack is up (audit brief).
function AppUnavailable() {
  return (
    <div
      role="alert"
      className="app-fallback"
      style={{
        minHeight:      '100vh',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '0.75rem',
        padding:        '2rem',
        textAlign:      'center',
        fontFamily:     'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Something went wrong</h1>
      <p style={{ maxWidth: '32rem', margin: 0 }}>
        The application could not be displayed. Please refresh the page, or try
        again later.
      </p>
    </div>
  )
}

export default function App() {
  const [bootstrap, setBootstrap] = useState<SiteBootstrap | null>(null)

  useEffect(() => {
    bootstrapSite().then((boot) => {
      // Locale formatters are manifest data (ADR-0026): register the active
      // manifest's locale set before any page renders (App gates render on
      // `bootstrap`, and the AppSkeleton has no formatted content, so this always
      // runs first). Downstream useFmt() reads the formatter registry at render
      // time. The perspective vocabulary is NOT registered here: the runner's
      // perspective-bar derives its options from each page's authored
      // `page.perspectives` axis (PerspectiveContext), not from a site registry.
      registerFormatters(boot.manifest.i18n.locales)
      setBootstrap(boot)
    })
  }, [])

  // AppErrorBoundary wraps EVERY render path (skeleton · suspense · rendered tree):
  // a crash in any shell or the renderer degrades to the brand-free AppUnavailable
  // screen instead of a blank unmount — defense-in-depth behind the shell-level
  // null-guards (ADR-0028 fail-soft). The renderer chunk is in flight only on the
  // very first page load; the accessible SuspenseFallback reuses the AppSkeleton
  // structure so there is no layout shift between boot and the renderer mounting
  // (WCAG / Law 9).
  return (
    <AppErrorBoundary fallback={<AppUnavailable />}>
      {!bootstrap ? (
        <AppSkeleton />
      ) : (
        <Suspense fallback={<SuspenseFallback label="Loading…" />}>
          <RendererSurface manifest={bootstrap.manifest} stores={bootstrap.stores} />
        </Suspense>
      )}
    </AppErrorBoundary>
  )
}