import { useState, useEffect, useCallback } from 'react'
import { AdminContext }             from 'react-admin'
import { CssBaseline, Box, CircularProgress } from '@mui/material'
import { dataProvider }      from './providers/dataProvider'
import { i18nProvider }      from './providers/i18nProvider'
import { ConstructorWizard } from './features/wizard'
import { LoginForm }         from './features/auth/LoginForm'
import { useConstructorStore } from './store/constructor.store'
import { initFromApi } from './store/api-actions'
import { MOCK_SOURCES, MOCK_SPECS, MOCK_SITE, MOCK_PAGE } from './store/mock-data'
import { isAuthenticated, AuthError } from './lib/auth'

// ── App state machine ─────────────────────────────────────────────────────────
//  idle       — initial; checking auth
//  login      — no token / 401 received; show LoginForm
//  loading    — token present; fetching API data
//  ready      — constructor ready to use
type AppState = 'idle' | 'login' | 'loading' | 'ready'

// ── AdminContext (not Admin) — RA as a provider layer only ───────────────────
// AdminContext supplies: dataProvider, i18nProvider, useNotify, useDataProvider,
// auth hooks — but ZERO layout, routing, or chrome.
// Constructor owns the full viewport directly.
//
// Boot flow:
//   1. Check isAuthenticated() → if false → show LoginForm
//   2. On token present → initFromApi() with Authorization header
//   3. 401 from API → LoginForm again (session expired)
//   4. Network failure → graceful degradation to mock data
export function App() {
  const [appState, setAppState] = useState<AppState>('idle')

  const startApp = useCallback(async () => {
    setAppState('loading')
    const store = useConstructorStore.getState()
    // Guard against HMR / double-mount (StrictMode) re-seeding an already-hydrated store.
    if (store.dataSources.length > 0) {
      setAppState('ready')
      return
    }
    try {
      const ok = await initFromApi()
      if (!ok) {
        MOCK_SOURCES.forEach((ds)   => store.addDataSource(ds))
        MOCK_SPECS.forEach((spec)   => store.addDataSpec(spec))
        store.updateSite(MOCK_SITE)
        store.addPage(MOCK_PAGE)
        store.setActivePage(MOCK_PAGE.id)
      }
      setAppState('ready')
    } catch (err) {
      // 401 — token expired in flight; return to login
      if (err instanceof AuthError && err.status === 401) {
        setAppState('login')
      } else {
        // Network failure fallback — use mock data, proceed
        const store2 = useConstructorStore.getState()
        MOCK_SOURCES.forEach((ds)   => store2.addDataSource(ds))
        MOCK_SPECS.forEach((spec)   => store2.addDataSpec(spec))
        store2.updateSite(MOCK_SITE)
        store2.addPage(MOCK_PAGE)
        store2.setActivePage(MOCK_PAGE.id)
        setAppState('ready')
      }
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      setAppState('login')
    } else {
      void startApp()
    }
  }, [startApp])

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (appState === 'idle') return null   // one-frame hold before auth check resolves

  if (appState === 'login') {
    return <LoginForm onSuccess={() => void startApp()} />
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (appState === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress aria-label="Loading constructor" />
      </Box>
    )
  }

  // ── Constructor ───────────────────────────────────────────────────────────────
  return (
    <AdminContext dataProvider={dataProvider} i18nProvider={i18nProvider}>
      <CssBaseline />
      <ConstructorWizard />
    </AdminContext>
  )
}
