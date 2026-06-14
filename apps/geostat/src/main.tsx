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
i18next.init({ lng: 'ka', fallbackLng: 'ka', resources: {}, interpolation: { escapeValue: false } })

setupRegistrations()

// ── MSW: start mock server before first render (Layer 2 only) ──────────
async function enableMocking() {
  if (import.meta.env.VITE_STORE_MODE !== 'api') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
})