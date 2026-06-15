import { useState, useEffect }     from 'react'
import { Routes, Route, Navigate }  from 'react-router-dom'
import { SiteProvider }             from '@geostat/react'
import { LocaleGuard }              from './LocaleGuard'
import { bootstrapSite }            from '@/data/site-manifest'
import type { SiteBootstrap }       from '@/data/site-manifest'

function AppSkeleton() {
  return (
    <div className="app-skeleton" aria-busy="true" aria-label="იტვირთება...">
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

  useEffect(() => { bootstrapSite().then(setBootstrap) }, [])

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