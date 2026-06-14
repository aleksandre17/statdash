// ── LocaleGuard — Eurostat URL locale routing pattern ─────────────────
//
//  Sits at /:locale/* — validates locale against manifest, sets locale
//  context for the subtree, then renders AppChrome + inner routes.
//
//  Frame + Chrome resolution (set before AppChrome renders → zero flash):
//    frame       → FrameProvider      → data-frame on .app-shell (layout geometry)
//    pageChrome  → ChromeOverrideProvider → ChromeSlot priority chain (visual variants)
//
//  Invalid locale → redirect to defaultLocale.
//  /  → redirect to /${defaultLocale} (handled by parent Route path="*").
//
import { useParams, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { SiteLocaleProvider, FrameProvider, ChromeOverrideProvider } from '@geostat/react'
import type { ChromeEntry }                                          from '@geostat/react'
import { NodePageRenderer, nodeRegistry }                            from '@geostat/react/engine'
import AppChrome                                                     from '@plugins/chrome/AppChrome'
import PageLoader                                                    from './PageLoader'
import { LANDING_CONFIG }                                            from '../pages/landing.config'
import type { SiteManifest }                                         from '@/data/site-manifest'

export function LocaleGuard({ manifest }: { manifest: SiteManifest }) {
  const { locale } = useParams<{ locale: string }>()
  const location   = useLocation()

  if (!manifest.i18n.locales.includes(locale!))
    return <Navigate to={`/${manifest.i18n.defaultLocale}`} replace />

  const pathParts    = location.pathname.split('/').filter(Boolean)
  const pageId       = pathParts[1] ?? 'landing'
  const pageEntry    = manifest.pages[pageId]
  const metaDefs     = pageEntry
    ? (nodeRegistry.getDefaults(pageEntry.type, pageEntry.variant ?? 'default') ?? {})
    : {}
  const frame        = pageEntry?.frame  ?? (metaDefs.frame as string | undefined)  ?? 'default'
  const pageChrome   = {
    ...(metaDefs.chrome as Record<string, ChromeEntry> | undefined ?? {}),
    ...(pageEntry?.chrome ?? {}),
  }

  return (
    <SiteLocaleProvider locale={locale!}>
      <FrameProvider frame={frame}>
        <ChromeOverrideProvider overrides={pageChrome}>
          <AppChrome>
            <Routes>
              <Route index          element={<NodePageRenderer page={LANDING_CONFIG} />} />
              <Route path=":pageId" element={<PageLoader />} />
            </Routes>
          </AppChrome>
        </ChromeOverrideProvider>
      </FrameProvider>
    </SiteLocaleProvider>
  )
}