import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import i18next from 'i18next'
import App from './app/App'
import { setupRegistrations } from './setupRegistrations'
import './shared/styles/index.css'
import './shared/styles/inner.css'

// i18next.init() synchronously creates ResourceStore and assigns addResources/addResourceBundle
// to the instance — must run before setupRegistrations() which calls registerSlice() with i18n.
// 'en' is the runner's tenant-neutral baseline (ADR-0028); the active manifest's
// i18n catalog supplies tenant locales at boot.
i18next.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } })

// Theming spine (ADR semantic-token spine §2): scope the geostat tenant theme.
// The default theme in @statdash/styles is brand-NEUTRAL; this attribute
// rebinds the Tier-2 accent roles to geostat's #0080BE family (see
// shared/styles/index.css [data-tenant="geostat"]). Composes with data-theme
// (tenant × mode are orthogonal root axes). The multi-tenant target injects
// this from manifest.theme at boot — same one-line seam, no shell change.
document.documentElement.dataset.tenant = 'geostat'

setupRegistrations()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)