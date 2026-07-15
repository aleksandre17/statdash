// Global vitest setup for apps/panel — runs before every test file.
import '@testing-library/jest-dom'
import { initPanelI18n } from './src/boot/initI18n'

// jsdom lacks ResizeObserver — the CanvasOverlay observes its root to reposition
// frames on layout changes. A no-op stub is enough for the test environment.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom lacks the Pointer Capture + scrollIntoView APIs that Radix primitives use
// to open/position their popups (the owned Select and the surfaces migrating onto
// Radix behind it). No-op stubs let a Radix listbox open in jsdom so component
// tests can drive it by keyboard/click — these are jsdom gaps, not behavior under
// test. (Added with the MUI→Radix foundation, AR-52 wave 0071.)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom lacks IntersectionObserver — AnchorNavContext observes section anchors
// to drive scroll-spy. The Constructor canvas (and the author→render e2e proof)
// mount the REAL engine renderer, which mounts sections, so a no-op stub is
// needed for any test that renders a full page through NodePageRenderer.
if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: ReadonlyArray<number> = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return [] }
  } as unknown as typeof IntersectionObserver
}

// registerSlice() calls i18next.addResources for slices that ship i18n. Those
// methods only exist after init(). Use the APP's OWN init (src/boot/initI18n) —
// the exact function main.tsx calls — so the test harness and the running app
// share ONE init SSOT and can never drift (the drift that let the suite stay green
// while the running app white-screened on the missing init — Gap B).
initPanelI18n()
