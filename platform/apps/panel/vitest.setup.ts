// Global vitest setup for apps/panel — runs before every test file.
import '@testing-library/jest-dom'
import i18next from 'i18next'

// jsdom lacks ResizeObserver — the CanvasOverlay observes its root to reposition
// frames on layout changes. A no-op stub is enough for the test environment.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// registerSlice() calls i18next.addResources for slices that ship i18n. Those
// methods only exist after init() (geostat does this in main.tsx before
// setupRegistrations). Initialise the singleton once here so the canvas
// registry setup can register slices in tests.
if (!i18next.isInitialized) {
  void i18next.init({
    lng: 'ka', fallbackLng: 'ka', resources: {},
    interpolation: { escapeValue: false },
  })
}
