// ── Boot smoke — the REAL boot seam end-to-end (Gap A + Gap B behavioural) ──────
//
//  The unit test the two gaps needed: it drives the panel's ACTUAL boot ordering
//  through the REAL engine registry and the REAL MetricPalette (no mocked
//  useMetricCatalog), asserting:
//
//    1. Gap B (behavioural) — the real registry path (setupCanvasRegistry →
//       registerSlice → registerSliceI18n → i18next.addResources) does NOT throw.
//       This works because the app's own init (initPanelI18n, run by the harness via
//       the shared SSOT it now imports) has established addResources. The DEFINITIVE
//       RED-on-revert guard for Gap B is the source assertion (mainI18nInit.test) —
//       the runtime is init'd by the harness, so this leg proves the wired-up state
//       is sound rather than re-proving the omission.
//
//    2. Gap A (end-to-end) — after bootstrapCatalog() registers the governed catalog,
//       the REAL MetricPalette (reading describeApp() through the real
//       metricCatalog.store) renders the governed metric tiles. Reverting the Gap A
//       fix (no registration) leaves the palette in its empty state → this goes RED.
//
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { bootstrapCatalog } from '../store/bootstrapCatalog'
import { useMetricCatalogStore } from '../discovery/metricCatalog.store'
import { MetricPalette } from '../discovery/MetricPalette'

const SMOKE_MANIFEST = {
  metrics: [
    { id: 'smoke.gdp', code: 'B1GQ', label: { ka: 'მშპ (smoke)', en: 'GDP (smoke)' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, dataSource: 'stats' },
  ],
  dimensions: [
    { id: 'smoke.region', code: 'REGION', label: { ka: 'რეგიონი', en: 'Region' }, conceptRole: 'geo' },
  ],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => SMOKE_MANIFEST })) as unknown as typeof fetch)
  // Force the catalog store to re-read describeApp() after this test's boot
  // registration (it caches 'ready' once — mirror the real invalidate-after-boot).
  useMetricCatalogStore.getState().invalidate()
})
afterEach(() => vi.unstubAllGlobals())

describe('panel boot smoke — real registry + real palette', () => {
  it('drives the real slice registry without an addResources throw (Gap B behavioural)', () => {
    // registerSlice → registerSliceI18n → i18next.addResources runs here on the
    // real registry. On an un-init'd i18next this throws; with the app init present
    // it must not. (Idempotent: a no-op if a prior test already ran it this worker.)
    expect(() => setupCanvasRegistry()).not.toThrow()
  })

  it('shows the governed metric tiles after the panel boot registers the catalog (Gap A e2e)', async () => {
    setupCanvasRegistry()
    const ok = await bootstrapCatalog()
    expect(ok).toBe(true)

    // The REAL palette, reading the REAL describeApp() catalog — not a mock. If the
    // boot registered nothing (Gap A un-fixed), the palette shows its empty state and
    // this tile never appears.
    render(<MetricPalette locale="ka" />)
    expect(await screen.findByTestId('metric-tile-smoke.gdp')).toBeInTheDocument()
    expect(screen.getByTestId('metric-tile-smoke.gdp')).toHaveTextContent('მშპ (smoke)')
  })
})
