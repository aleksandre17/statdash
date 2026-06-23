// Vitest setup for the geostat runner test project.
//
//  1. @testing-library/jest-dom matchers (toBeInTheDocument, toHaveAttribute …)
//     for the component render-path tests (second-tenant fitness function).
//  2. jsdom shims for browser observers the renderer's layout shells use
//     (IntersectionObserver via SectionNavContext, ResizeObserver via charts).
//     jsdom ships neither; these no-op stubs let full pages mount in tests.
//     This is a standard test-environment shim, NOT product code.
//
import '@testing-library/jest-dom/vitest'

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): unknown[] { return [] }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // @ts-expect-error — minimal jsdom shim
  globalThis.IntersectionObserver = NoopObserver
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error — minimal jsdom shim
  globalThis.ResizeObserver = NoopObserver
}
