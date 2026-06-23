import { useState, useEffect }     from 'react'
import { Routes, Route, Navigate }  from 'react-router-dom'
import { SiteProvider }             from '@statdash/react'
import { modeRegistry }             from '@statdash/engine'
import { LocaleGuard }              from './LocaleGuard'
import { bootstrapSite }            from '@/data/site-manifest'
import type { SiteBootstrap }       from '@/data/site-manifest'
import { registerFormatters }       from '@/i18n/formatters'

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

  return (
    <SiteProvider
      stores={stores}
      pages={manifest.pages}
      nav={manifest.nav}
      chrome={manifest.chrome}
      chromeConfig={manifest.chromeConfig}
      i18n={manifest.i18n}
    >
      <Routes>
        <Route path="/:locale/*" element={<LocaleGuard manifest={manifest} />} />
        <Route path="*"          element={<Navigate to={`/${manifest.i18n.defaultLocale}`} replace />} />
      </Routes>
    </SiteProvider>
  )
}