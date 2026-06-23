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

setupRegistrations()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)