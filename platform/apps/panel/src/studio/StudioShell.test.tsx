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

})

// ── Role lens — the Steward unlocks Model (AR-49 M2.0) ────────────────────────
//
//  Role is a LENS over the SAME document (not RBAC): the default `author` lens is
//  byte-identical to M1 (no Model slot); the `steward` lens unlocks the Model rail
//  entry + its (scaffold) surface. The role is read through the single useRole()
//  seam; these tests arrange it via the underlying preference store.
describe('StudioShell — role lens unlocks the Model slot (AR-49 M2.0)', () => {
  it('defaults to the author lens — the Model rail slot is ABSENT (M1 behavior preserved)', () => {
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    // The five compose surfaces are present…
    for (const name of ['Insert', 'Data', 'Layers', 'Pages & Site', 'Style']) {
      expect(within(rail).getByRole('button', { name: new RegExp(name) })).toBeEnabled()
    }
    // …and Model is not offered at all in the author lens.
    expect(within(rail).queryByRole('button', { name: /Model/ })).toBeNull()
  })

  it('the Steward lens unlocks Model as an ENABLED, selectable rail entry', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    const model = within(rail).getByRole('button', { name: /Model/ })
    expect(model).toBeEnabled()

    // Selecting Model swaps the dock to the Model surface (scaffold) — a summonable
    // left surface over the same live canvas, never a route.
    fireEvent.click(model)
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByRole('heading', { name: 'Model' })).toBeInTheDocument()
    expect(screen.getByText(/Define the governed semantic layer/)).toBeInTheDocument()
  })

  it('leaving the Steward lens while on Model falls back to the default surface (no stranded dock)', () => {
    useRoleStore.setState({ role: 'steward' })
    useConstructorStore.setState({ activeSurface: 'model' })
    const { rerender } = render(<StudioShell />)
    expect(screen.getByRole('heading', { name: 'Model' })).toBeInTheDocument()

    // Flip back to author — Model must no longer be shown, and the dock recovers to
    // the default (Insert) rather than stranding on a surface with no rail affordance.
    useRoleStore.setState({ role: 'author' })
    rerender(<StudioShell />)
    expect(screen.getByRole('heading', { name: 'Insert' })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).queryByRole('button', { name: /Model/ })).toBeNull()
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

// ── FF-THEME-EDIT-DATA (DOM leg) — an applied themeOverride reaches the cascade ──
//
//  themeVars.test proves buildThemeVars maps token DATA → an inline style object.
//  This proves the LAST mile: StudioShell actually applies that object to the mounted
//  `.studio-shell` root as CSS custom properties — so the whole "rebrand = data"
//  cascade (chrome + canvas descend from this root and inherit) is wired, not just the
//  pure function. Without the `style={themeStyle}` binding this leg goes RED.
describe('StudioShell — theme overrides land as custom properties on the shell root', () => {
  it('applies a themeOverride as the expected --css-var on .studio-shell (override beats the Strata base)', () => {
    useConstructorStore.getState().updateSite({
      themeOverrides: {
        'color.accent': '#abcdef',          // overrides the Strata azure (#14508C)
        'color.accent-secondary': '#123456', // a second override
      },
    })
    render(<StudioShell />)

    const root = document.querySelector('.studio-shell') as HTMLElement
    expect(root).not.toBeNull()
    // The author override wins over the Strata preset base.
    expect(root.style.getPropertyValue('--color-accent')).toBe('#abcdef')
    expect(root.style.getPropertyValue('--color-accent-secondary')).toBe('#123456')
    // A token with no override still carries the Strata base value (layering intact).
    expect(root.style.getPropertyValue('--radius-card')).toBe('10px')
  })
})
