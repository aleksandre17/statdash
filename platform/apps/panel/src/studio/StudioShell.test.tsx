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
    // …and the Data model slot is not offered at all in the author lens.
    expect(within(rail).queryByRole('button', { name: /Data model/ })).toBeNull()
  })

  it('the Steward lens unlocks Model as an ENABLED, selectable rail entry that opens the Focus-View', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    const model = within(rail).getByRole('button', { name: /Data model/ })
    expect(model).toBeEnabled()

    // Selecting Model NAVIGATES to the Data-model FOCUS-VIEW — a SEPARATE Studio
    // screen (SL-2), not a left-dock surface: the editing rail is gone (not the
    // primary chrome), a labelled focus-view region + breadcrumb-back appear, and the
    // relocated ModelSurface body (its caption) renders inside it.
    fireEvent.click(model)
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Studio surfaces' })).toBeNull()
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('the top-bar "Data model" switch is the ONE-ACTION jump: sets steward AND opens the Focus-View', () => {
    // Default author lens — the workspace switch shows "Data model" as the OTHER
    // segment (a single, discoverable, destination-named affordance in the banner).
    render(<StudioShell />)
    // No Model rail slot yet (author lens) — the only "Data model" control is the
    // top-bar segment, so this is unambiguous.
    fireEvent.click(screen.getByRole('button', { name: 'Data model' }))

    // ONE click landed the user IN the Data-model focus-view SCREEN: the role flipped
    // to steward AND the active surface is Model, routed to the separate focus-view.
    expect(useRoleStore.getState().role).toBe('steward')
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('breadcrumb-back leaves the Focus-View and returns to the editing shell (author lens, no stranded dock)', () => {
    useRoleStore.setState({ role: 'steward' })
    useConstructorStore.setState({ activeSurface: 'model' })
    render(<StudioShell />)
    // The focus-view SCREEN is shown (not a dock) — the rail/shell is not the chrome.
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Studio surfaces' })).toBeNull()

    // Back returns to the editing shell: the author lens is restored and the shell
    // recovers to the default (Insert) rather than stranding on a Model dock.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByRole('heading', { name: 'Insert' })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).queryByRole('button', { name: /Data model/ })).toBeNull()
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
