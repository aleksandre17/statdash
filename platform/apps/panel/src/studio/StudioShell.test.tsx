import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { StudioShell } from './StudioShell'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { INITIAL_STUDIO_SURFACE } from '../store/constructor.history'

// The Studio scaffold: landmarks + a keyboard-reachable rail + the surfaces mount
// via the existing stores + the Model slot is locked. Rendered in English (seed the
// site locale) so rail names are stable to assert. No active page is seeded, so the
// always-mounted-canvas region shows its no-page state rather than lazy-loading the
// heavy real canvas — the a11y/IA scaffold is what M1.2 proves.
beforeEach(() => {
  setupCanvasRegistry() // idempotent — populates the palettes; keeps mounts crash-free
  useConstructorStore.setState({ activeSurface: INITIAL_STUDIO_SURFACE, selectedNodeId: null, chromeSelection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
})

describe('StudioShell — IA + landmarks (WCAG 2.1 AA)', () => {
  it('renders the five shell landmark regions', () => {
    render(<StudioShell />)
    expect(screen.getByRole('banner')).toBeInTheDocument()          // top bar
    expect(screen.getByRole('main')).toBeInTheDocument()            // canvas home
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()     // bottom strip
    // Two complementary docks (left surface + right inspector) + the rail nav.
    expect(screen.getAllByRole('complementary').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('navigation', { name: 'Studio surfaces' })).toBeInTheDocument()
  })

  it('the canvas is the always-mounted home (main landmark), not gated by a rail step', () => {
    render(<StudioShell />)
    // Present regardless of which surface is active — no wizard step gates it.
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument()
  })
})

describe('StudioShell — activity rail (summonable surfaces, no waterfall)', () => {
  it('offers Insert/Data/Layers/Pages&Site/Style as keyboard-reachable buttons', () => {
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    for (const name of ['Insert', 'Data', 'Layers', 'Pages & Site', 'Style']) {
      const btn = within(rail).getByRole('button', { name: new RegExp(name) })
      expect(btn).toBeEnabled()
    }
  })

  it('opens on Insert with aria-current, and selecting a surface swaps the dock (no gating)', () => {
    render(<StudioShell />)
    // Insert is the default surface — its rail button is aria-current and the dock
    // heading reads Insert.
    expect(screen.getByRole('heading', { name: 'Insert' })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: /Insert/ })).toHaveAttribute('aria-current', 'true')

    // Jump straight to Data — no step must be "completed" first.
    fireEvent.click(within(rail).getByRole('button', { name: /Data/ }))
    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument()
    expect(useConstructorStore.getState().activeSurface).toBe('data')

    // And straight to Style from Data — order-free.
    fireEvent.click(within(rail).getByRole('button', { name: /Style/ }))
    expect(screen.getByRole('heading', { name: 'Style' })).toBeInTheDocument()
  })

  it('the Model slot is rendered but LOCKED (M2) — present, never selectable', () => {
    render(<StudioShell />)
    const model = screen.getByRole('button', { name: /Model/ })
    expect(model).toBeDisabled()
    // Clicking a disabled rail button cannot change the surface.
    fireEvent.click(model)
    expect(useConstructorStore.getState().activeSurface).not.toBe('model')
  })
})

describe('StudioShell — surfaces mount via the existing subsystems', () => {
  it('the Data surface mounts the governed Metric Palette', () => {
    render(<StudioShell />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: /Data/ }))
    // MetricPalette exposes its search box (placeholder "ძებნა…") — proof the real
    // palette mounted (its empty/loading state is fine; population is a boot concern
    // proven elsewhere in bootSmoke).
    expect(screen.getByPlaceholderText('ძებნა…')).toBeInTheDocument()
  })
})
