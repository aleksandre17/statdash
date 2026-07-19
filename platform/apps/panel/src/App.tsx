import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, Box, CircularProgress, GlobalStyles } from '@mui/material'
// ADR-021 — bind MUI to the DTCG token spine. `ThemeProvider` (v6: the stable,
// CSS-vars-aware provider — `CssVarsProvider` is a deprecated alias of it, removed
// in v7) mounts the seeded `studioTheme`; `muiAliasVars` re-points MUI's generated
// `--mui-palette-*` vars at the live DTCG `--color-*`/`--status-*` vars. Mounting
// the alias at `:root:root` (doubled pseudo = higher specificity, order-independent)
// makes solid MUI fills — INCLUDING portalled overlays (⌘K, Select menus, Dialogs
// at document.body) — track live Style-editor edits by pure CSS cascade.
import { ThemeProvider } from '@mui/material/styles'
import { studioTheme, muiAliasVars } from './studio/muiTheme'
import { LoginForm }         from './features/auth/LoginForm'
import { ToastHost }         from './shared/ToastHost'
import { SuspenseFallback }  from './shared/SuspenseFallback'
import { useConstructorStore } from './store/constructor.store'

// AR-49 M1.3b — the Studio is now THE (and only) authoring surface; the 3-step
// wizard is retired (Strangler complete). Still lazy so its chunk (incl. the
// @statdash/styles token CSS the chrome consumes) streams in after the boot shell
// paints rather than bloating the initial bundle.
// The Studio mounts THROUGH its route table (StudioRoutes → /studio/:surface →
// StudioShell). Real URL routing (AR-49 M0): the surface + selected page live in the
// address bar, so Back/Forward and permalinks work. Lazy so the whole Studio chunk
// (incl. the @statdash/styles token CSS) streams in behind the boot shell.
const StudioRoutes = lazy(() =>
  import('./studio/StudioRoutes').then((m) => ({ default: m.StudioRoutes })),
)
import { initFromApi } from './store/api-actions'
import { bootstrapCatalog } from './store/bootstrapCatalog'
import { MOCK_SOURCES, MOCK_SPECS, MOCK_SITE, MOCK_PAGE } from './store/mock-data'
import { isAuthenticated, AuthError } from './lib/auth'
// Boot-time control registration: surface rich FieldControls the registry can't
// own without a cycle (value-mapping rule-list editor · thresholds step-list editor).
// Side-effect import.
import './inspector/controls/value-mapping/register'
import './inspector/controls/thresholds/register'
// ADR-049 P1 — register the rich DataSpec editors under their engine-declared
// `editorKey`s so the generic DataSpec composer resolves them by key (no switch).
import './features/data-layer/registerSpecEditors'

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
    // ── Explicit registry boot (root-cause fix for the CanvasView module-eval coupling) ──
    // Populate the engine registries (perspectives + node/store-builder/projector slices)
    // as an EXPLICIT, idempotent boot step, so a brand-new / EMPTY site (no page yet) has a
    // fully populated registry the moment the Studio reaches 'ready' — registration is no
    // longer a side effect of the canvas first mounting a page (the latent coupling the
    // M1 review flagged). Dynamically imported so its heavy plugin/engine graph (the shell
    // components, ApexCharts, Leaflet) stays OUT of the eager boot chunk (the panel's
    // code-splitting architecture) and loads in parallel with the API boot below. Awaited
    // before every 'ready' transition; safe on the already-hydrated re-entry (idempotent).
    const registryBoot = import('./canvas/setupCanvasRegistry').then((m) => m.setupCanvasRegistry())

    const store = useConstructorStore.getState()
    // Guard against HMR / double-mount (StrictMode) re-seeding an already-hydrated store.
    if (store.dataSources.length > 0) {
      await registryBoot
      setAppState('ready')
      return
    }
    try {
      // Boot reads run concurrently: initFromApi hydrates the config CRUD layers;
      // bootstrapCatalog (Gap A) primes the governed metric/dimension registry from
      // /api/bootstrap so describeApp() — and thus the MetricPalette — is populated
      // BEFORE the Studio's Data surface mounts; registryBoot (above) registers the
      // node/slice shells. bootstrapCatalog is fail-soft (never throws), so it never
      // blocks the config boot from reaching 'ready'.
      const [ok] = await Promise.all([initFromApi(), bootstrapCatalog(), registryBoot])
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
        // Network failure fallback — use mock data, proceed. The registry still boots
        // (awaited) so the offline/mock canvas renders against a populated registry.
        await registryBoot
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

  // ── Screen content (one provider wraps them all) ──────────────────────────────
  //  login  — the auth form
  //  loading— the boot spinner
  //  ready  — the Studio (the only authoring surface; AR-49 M1.3b, wizard retired).
  //           Lazy so its chunk streams in behind the boot shell; no fallback path,
  //           so bootSmoke.test is the safety net that it mounts live.
  const content =
    appState === 'login' ? (
      <LoginForm onSuccess={() => { setAppState('loading'); void startApp() }} />
    ) : appState === 'loading' ? (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress aria-label="Loading constructor" />
      </Box>
    ) : (
      <>
        <CssBaseline />
        <Suspense fallback={<SuspenseFallback label="Loading studio" />}>
          <StudioRoutes />
        </Suspense>
        <ToastHost />
      </>
    )

  // One theme provider at the App root wraps login + loading + Studio (ADR-021 §Mount
  // point) — exactly one CSS-vars scope. The provider never re-renders on a theme
  // edit: `studioTheme` is a module constant and live edits ride the CSS alias, not React.
  //
  // BrowserRouter is the OUTERMOST wrapper (the app owns its router — real URL routing
  // for the Studio surfaces/pages). The live canvas preview keeps its OWN sandboxed
  // MemoryRouter (CanvasView) so previewed dashboards never touch the real address bar.
  return (
    <BrowserRouter>
      <ThemeProvider theme={studioTheme} defaultMode="light">
        {/* Part 2 — re-point MUI's brand vars at the live DTCG spine (see muiTheme.ts). */}
        <GlobalStyles styles={{ ':root:root': muiAliasVars }} />
        {content}
      </ThemeProvider>
    </BrowserRouter>
  )
}
