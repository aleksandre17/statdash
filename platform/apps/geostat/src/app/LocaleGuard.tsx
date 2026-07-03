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
import { useLayoutEffect }                                           from 'react'
import { useParams, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import i18next                                                       from 'i18next'
import { SiteLocaleProvider, FrameProvider, ChromeOverrideProvider, localeDirection } from '@statdash/react'
import type { ChromeEntry }                                          from '@statdash/react'
import { NodePageRenderer, nodeRegistry }                            from '@statdash/react/engine'
import AppChrome                                                     from '@plugins/chrome/AppChrome'
import PageLoader                                                    from './PageLoader'
import type { SiteManifest }                                         from '@/data/site-manifest'

// ── Document locale binding (AR-37 P0, R1 + R3) ────────────────────────
//
//  LocaleGuard is the one place that already OWNS the resolved, validated
//  locale (URL segment, checked against manifest.i18n.locales above) — so
//  the document-level bindings hang off it, not off a new locale source:
//    - `document.documentElement.lang`/`dir` — otherwise frozen at
//      index.html's `lang="en"` forever (R1); `useLayoutEffect` (not
//      `useEffect`) so it lands before paint, mirroring the synchronous
//      `data-theme` set in main.tsx.
//    - `i18next.changeLanguage(locale)` — syncs the i18next GLOBAL
//      language (R3); `useT` already threads `{ lng: locale }` per call,
//      this is belt-and-suspenders for any global reader.
function useBindDocumentLocale(locale: string): void {
  useLayoutEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir  = localeDirection(locale)
    void i18next.changeLanguage(locale)
  }, [locale])
}

export function LocaleGuard({ manifest }: { manifest: SiteManifest }) {
  const { locale } = useParams<{ locale: string }>()
  const location   = useLocation()
  const localeValid = manifest.i18n.locales.includes(locale!)

  useBindDocumentLocale(localeValid ? locale! : manifest.i18n.defaultLocale)

  if (!localeValid)
    return <Navigate to={`/${manifest.i18n.defaultLocale}`} replace />

  const pathParts    = location.pathname.split('/').filter(Boolean)
  const pageId       = pathParts[1] ?? manifest.indexPageId
  const pageEntry    = manifest.pages[pageId]
  const indexPage    = manifest.pages[manifest.indexPageId]
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
              <Route
                index
                element={indexPage ? <NodePageRenderer page={indexPage} /> : <PageLoader />}
              />
              <Route path=":pageId" element={<PageLoader />} />
            </Routes>
          </AppChrome>
        </ChromeOverrideProvider>
      </FrameProvider>
    </SiteLocaleProvider>
  )
}