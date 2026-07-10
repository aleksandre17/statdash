import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { StudioShell } from './StudioShell'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { INITIAL_STUDIO_SURFACE } from '../store/constructor.history'
import { useRoleStore } from './useRole'

// The Studio scaffold: landmarks + a keyboard-reachable rail + the surfaces mount
// via the existing stores + the Model slot is locked. Rendered in English (seed the
// site locale) so rail names are stable to assert. No active page is seeded, so the
// always-mounted-canvas region shows its no-page state rather than lazy-loading the
// heavy real canvas — the a11y/IA scaffold is what M1.2 proves.
beforeEach(() => {
  setupCanvasRegistry() // idempotent — populates the palettes; keeps mounts crash-free
  useConstructorStore.setState({ activeSurface: INITIAL_STUDIO_SURFACE, selectedNodeId: null, chromeSelection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  // Default role lens = author (a fresh session lands here) — reset the persisted
  // preference so each test starts from the documented default (AR-49 M2.0).
  useRoleStore.setState({ role: 'author' })
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
      // Exact match — 'Data' must NOT also select the always-visible 'Data model' entry.
      const btn = within(rail).getByRole('button', { name })
      expect(btn).toBeEnabled()
    }
  })

  it('opens on Insert with aria-current, and selecting a surface swaps the dock (no gating)', () => {
    render(<StudioShell />)
    // Insert is the default surface — its rail button is aria-current and the dock
    // heading reads Insert.
    expect(screen.getByRole('heading', { name: 'Insert' })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: 'Insert' })).toHaveAttribute('aria-current', 'true')

    // Jump straight to Data — no step must be "completed" first. Exact match so
    // 'Data' does not collide with the always-visible 'Data model' entry.
    fireEvent.click(within(rail).getByRole('button', { name: 'Data' }))
    expect(screen.getByRole('heading', { name: 'Data' })).toBeInTheDocument()
    expect(useConstructorStore.getState().activeSurface).toBe('data')

    // And straight to Style from Data — order-free.
    fireEvent.click(within(rail).getByRole('button', { name: 'Style' }))
    expect(screen.getByRole('heading', { name: 'Style' })).toBeInTheDocument()
  })

})

// ── Data model — a first-class, always-reachable destination (AR-50 M5b) ──────
//
//  The G6 "built ≠ buried" fix: the Data-model destination is ALWAYS in the rail (no
//  role gate), and the role lens splits only its CONTENT (author→read-only Dictionary,
//  steward→modeler). Navigation is decoupled from identity — opening the destination
//  NEVER escalates the lens. These tests arrange the lens via the preference store.
describe('StudioShell — the Data-model destination is reachable in every lens (AR-50 M5b)', () => {
  it('the DEFAULT (author) session offers the Data-model rail entry — it is NOT buried', () => {
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    // The five compose surfaces AND the always-visible Data-model destination (exact
    // names — 'Data' must not collide with 'Data model').
    for (const name of ['Insert', 'Data', 'Layers', 'Pages & Site', 'Style', 'Data model']) {
      expect(within(rail).getByRole('button', { name })).toBeEnabled()
    }
  })

  it('from a DEFAULT author session, selecting Data model opens the READ-ONLY Dictionary (no query cliff)', () => {
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    fireEvent.click(within(rail).getByRole('button', { name: /Data model/ }))

    // The Data-model FOCUS-VIEW screen opens (rail gone, breadcrumb-back present)…
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    // …and the AUTHOR lens is untouched (no escalation) → the read-only Dictionary, NOT
    // the modeler. The raw query cliff never lands on the author path.
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    expect(screen.queryByText(/Define the governed data model/)).toBeNull()
  })

  it('the Steward lens opens the SAME destination as the full modeler', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    fireEvent.click(within(rail).getByRole('button', { name: /Data model/ }))
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
    expect(screen.queryByTestId('data-dictionary')).toBeNull()
  })

  it('the top-bar "Data model" switch is PURE NAVIGATION — it opens the destination without escalating the lens', () => {
    render(<StudioShell />)
    // The top-bar segment and the rail entry both name "Data model"; drive the banner one.
    const banner = screen.getByRole('banner')
    fireEvent.click(within(banner).getByRole('button', { name: 'Data model' }))

    // Navigated to the destination, but the lens stayed author → the read-only Dictionary.
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
  })

  it('the in-place lens toggle opts INTO editing (author→steward) without leaving the destination', () => {
    render(<StudioShell />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: /Data model/ }))
    // Author landed on the Dictionary; flip the lens toggle to Edit → the modeler.
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Edit \(Steward\)/ }))
    expect(useRoleStore.getState().role).toBe('steward')
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('breadcrumb-back leaves the Focus-View and returns to the editing shell (lens untouched)', () => {
    useRoleStore.setState({ role: 'steward' })
    useConstructorStore.setState({ activeSurface: 'model' })
    render(<StudioShell />)
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Studio surfaces' })).toBeNull()

    // Back returns to the editing shell at the default surface; navigation is
    // independent of identity, so the lens is NOT reset by leaving.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useRoleStore.getState().role).toBe('steward')
    expect(screen.getByRole('heading', { name: 'Insert' })).toBeInTheDocument()
    // The Data-model rail entry is present again in the restored shell (always visible).
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: /Data model/ })).toBeEnabled()
  })
})

describe('StudioShell — surfaces mount via the existing subsystems', () => {
  it('the Data surface mounts the governed Metric Palette', () => {
    render(<StudioShell />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: 'Data' }))
    // MetricPalette exposes its search box (placeholder "ძებნა…") — proof the real
    // palette mounted (its empty/loading state is fine; population is a boot concern
    // proven elsewhere in bootSmoke).
    expect(screen.getByPlaceholderText('ძებნა…')).toBeInTheDocument()
  })
})

// ── FF-THEME-EDIT-DATA (DOM leg) — an applied themeOverride reaches the cascade ──
//
//  themeVars.test proves buildThemeVars maps token DATA → a style object. This proves
//  the LAST mile: StudioShell actually emits that object to the cascade as CSS custom
//  properties — so the whole "rebrand = data" mechanism (chrome + canvas + body
//  portals all inherit) is wired, not just the pure function.
//
//  ADR-021 §3 relocated the mount from an inline `.studio-shell` style to a `:root:root`
//  <GlobalStyles> block (REQUIRED so MUI portals at document.body inherit Strata). In
//  jsdom that emits a <style> tag rather than element.style, so we assert against the
//  emitted stylesheet text — the actual cascade source — not `.studio-shell`.style.
describe('StudioShell — theme overrides land as custom properties on the document root', () => {
  it('emits a themeOverride as the expected --css-var at :root (override beats the Strata base)', () => {
    useConstructorStore.getState().updateSite({
      themeOverrides: {
        'color.accent': '#abcdef',          // overrides the Strata azure (#14508C)
        'color.accent-secondary': '#123456', // a second override
      },
    })
    render(<StudioShell />)

    // The GlobalStyles block serializes to one or more <style> tags; join + strip
    // whitespace so the assertion is insensitive to the serializer's formatting.
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
      .replace(/\s+/g, '')

    // buildThemeVars layers override OVER base, so only the winning value is emitted.
    expect(css).toContain('--color-accent:#abcdef')
    expect(css).toContain('--color-accent-secondary:#123456')
    // A token with no override still carries the Strata base value (layering intact).
    expect(css).toContain('--radius-card:10px')
  })
})
