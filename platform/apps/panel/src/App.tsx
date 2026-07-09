import { useState, useEffect, useCallback } from 'react'
import { CssBaseline, Box, CircularProgress } from '@mui/material'
import { ConstructorWizard } from './features/wizard'
import { LoginForm }         from './features/auth/LoginForm'
import { ToastHost }         from './shared/ToastHost'
import { useConstructorStore } from './store/constructor.store'
import { initFromApi } from './store/api-actions'
import { bootstrapCatalog } from './store/bootstrapCatalog'
import { MOCK_SOURCES, MOCK_SPECS, MOCK_SITE, MOCK_PAGE } from './store/mock-data'
import { isAuthenticated, AuthError } from './lib/auth'
// Boot-time control registration: surface rich FieldControls the registry can't
// own without a cycle (value-mapping rule-list editor). Side-effect import.
import './inspector/controls/value-mapping/register'

// ── App state machine ─────────────────────────────────────────────────────────
//  idle       — initial; checking auth
//  login      — no token / 401 received; show LoginForm
//  loading    — token present; fetching API data
//  ready      — constructor ready to use
type AppState = 'login' | 'loading' | 'ready'

// ── Provider-free shell (react-admin retired, AR-49 M1.1) ────────────────────
// The panel owns its full viewport directly. The one live capability react-admin
// carried — a toast hook — is now the panel's own `notify` port (store/notify.ts,
// rendered by <ToastHost/>). Config CRUD flows through store/api-actions → lib/api
// directly (never an RA dataProvider), and locale is the panel's own LocaleString
// + locale state, so no provider wrapper remains.
//
// Boot flow:
//   1. Check isAuthenticated() → if false → show LoginForm
//   2. On token present → initFromApi() with Authorization header
//   3. 401 from API → LoginForm again (session expired)
//   4. Network failure → graceful degradation to mock data
export function App() {
  // Auth is a synchronous token check — derive the initial state lazily rather
  // than transitioning via an effect (avoids set-state-in-effect + the idle frame).
  const [appState, setAppState] = useState<AppState>(() =>
    isAuthenticated() ? 'loading' : 'login',
  )

  // startApp performs the async boot. It does NOT synchronously set 'loading'
  // itself: on the boot path the initial state is already 'loading', and the
  // re-login path sets it at the call site (LoginForm onSuccess). Keeping the
  // first state write off the synchronous effect tick avoids cascading renders.
  const startApp = useCallback(async () => {
    const store = useConstructorStore.getState()
    // Guard against HMR / double-mount (StrictMode) re-seeding an already-hydrated store.
    if (store.dataSources.length > 0) {
      setAppState('ready')
      return
    }
    try {
      // Boot reads run concurrently: initFromApi hydrates the config CRUD layers;
      // bootstrapCatalog (Gap A) primes the governed metric/dimension registry from
      // /api/bootstrap so describeApp() — and thus the MetricPalette — is populated
      // BEFORE the wizard's Page step mounts. bootstrapCatalog is fail-soft (never
      // throws), so it never blocks the config boot from reaching 'ready'.
      const [ok] = await Promise.all([initFromApi(), bootstrapCatalog()])
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

  // Mount-time boot: synchronize the app with external systems (auth token +
  // data store + API) exactly once. This is the sanctioned "subscribe to an
  // external system" use of an effect. startApp is async; its only synchronous
  // setState is the already-hydrated early-return (StrictMode double-mount / HMR),
  // which is terminal and cannot cascade — so the set-state-in-effect heuristic
  // is a false positive on this boot path.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount boot; see comment
    if (isAuthenticated()) void startApp()
  }, [startApp])

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (appState === 'login') {
    return <LoginForm onSuccess={() => { setAppState('loading'); void startApp() }} />
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
    <>
      <CssBaseline />
      <ConstructorWizard />
      <ToastHost />
    </>
  )
}
