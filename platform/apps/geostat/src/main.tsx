import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18next from 'i18next'
import { localeDirection } from '@statdash/react'
import App from './app/App'
import { bootRegistrations } from './bootRegistrations'
import './shared/styles/index.css'
import './shared/styles/inner.css'

// i18next.init() synchronously creates ResourceStore and assigns addResources/addResourceBundle
// to the instance — must run before setupRegistrations() (which calls registerSlice() with i18n).
// The heavy slice/projector wiring (setupRegistrations) runs at the top of the lazy
// ./app/RendererSurface module, so the panel/node plugin graph — ApexCharts, Leaflet — stays out
// of the eager entry chunk; React resolves that module only AFTER this synchronous init, before
// any page renders, so the init → register-slices → render ordering holds across the split.
// 'en' is the runner's tenant-neutral baseline (ADR-0028); the active manifest's
// i18n catalog supplies tenant locales at boot.
i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })

// EAGER store-builder registration — MUST run before App mounts, because
// App's bootstrapSite() (useEffect) CONSUMES the store-builder registry:
// fetchStoreManifest → buildStoreManifest dispatches each datasource to its
// registered builder and THROWS on an unregistered kind. The lazy
// RendererSurface (setupRegistrations) loads only AFTER bootstrap resolves, so
// the builders cannot be registered there — they must exist now. This call is
// LIGHT: @statdash/plugins/datasources pulls in NO ApexCharts/Leaflet, so the
// entry chunk stays small and the heavy renderer graph stays lazily split.
bootRegistrations()

// Theming spine (ADR semantic-token spine §2): scope the geostat tenant theme.
// The default theme in @statdash/styles is brand-NEUTRAL; this attribute
// rebinds the Tier-2 accent roles to geostat's #0080BE family (see
// shared/styles/index.css [data-tenant="geostat"]). Composes with data-theme
// (tenant × mode are orthogonal root axes). The multi-tenant target injects
// this from manifest.theme at boot — same one-line seam, no shell change.
document.documentElement.dataset.tenant = 'geostat'

// Colour MODE (data-theme): apply SYNCHRONOUSLY here, before the first render —
// not only in useTheme's post-paint useEffect. The token layer's dark values are
// selected by [data-theme="dark"]; any component that reads a resolved token via
// getComputedStyle DURING RENDER (the map choropleth bakes --color-surface into a
// cached quantile ramp; charts feed cssVar() into SVG fills) would otherwise
// capture the LIGHT value on a hard-load — the attribute wouldn't land until an
// effect ran a frame later. That produced a hard-load-vs-soft-nav colour split
// (soft-nav already had the attribute from the prior route) and a dark-mode
// flash. Mirror the useTheme resolution (stored choice → OS preference) so the
// later effect is idempotent; 'system'/unset ⇒ no attribute ⇒ @media wins.
try {
  const stored = localStorage.getItem('statdash-theme')
  const theme  = stored
    ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  if (theme && theme !== 'system') document.documentElement.setAttribute('data-theme', theme)
} catch { /* storage/matchMedia denied — the useTheme effect still applies it post-mount */ }

// Locale document binding (AR-37 P0, R1) — set SYNCHRONOUSLY here too, from the
// URL's `/:locale/*` segment, before the first paint. LocaleGuard's layout effect
// re-asserts (and corrects, if the segment isn't a real manifest locale) this once
// the bootstrap manifest resolves — this pre-hydration pass only prevents a one-
// frame `lang="en"`/ltr flash on a hard load under e.g. `/ka`, mirroring the
// data-theme pass above (same class of hard-load-vs-soft-nav flash).
try {
  const seg = window.location.pathname.split('/').filter(Boolean)[0]
  if (seg) {
    document.documentElement.lang = seg
    document.documentElement.dir  = localeDirection(seg)
  }
} catch { /* location parsing failure — LocaleGuard's layout effect still applies it post-mount */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)