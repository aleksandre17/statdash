import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initPanelI18n } from './boot/initI18n'

// Gap B — initialise i18next SYNCHRONOUSLY before the app mounts. The live canvas
// lazily pulls setupCanvasRegistry → registerSlice → registerSliceI18n →
// i18next.addResources(...), which throws on an un-init'd singleton. This runs at
// module eval, before createRoot().render(App), so the init → register-slices
// ordering holds across the PageStep lazy split (mirrors apps/geostat/src/main.tsx).
initPanelI18n()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
