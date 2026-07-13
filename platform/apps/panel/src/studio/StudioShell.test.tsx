import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { renderStudio } from '../test-support/renderStudio'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { useRoleStore } from './useRole'

// The Studio scaffold: landmarks + a keyboard-reachable rail + the surfaces mount
// via the existing stores + the Model slot is locked. Rendered in English (seed the
// site locale) so rail names are stable to assert. No active page is seeded, so the
// always-mounted-canvas region shows its no-page state rather than lazy-loading the
// heavy real canvas — the a11y/IA scaffold is what M1.2 proves.
beforeEach(() => {
  setupCanvasRegistry() // idempotent — populates the palettes; keeps mounts crash-free
  useConstructorStore.setState({ selection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  // Default role lens = author (a fresh session lands here) — reset the persisted
  // preference so each test starts from the documented default (AR-49 M2.0).
  useRoleStore.setState({ role: 'author' })
})

describe('StudioShell — IA + landmarks (WCAG 2.1 AA)', () => {
  it('renders the five shell landmark regions', () => {
    renderStudio()
    expect(screen.getByRole('banner')).toBeInTheDocument()          // top bar
    expect(screen.getByRole('main')).toBeInTheDocument()            // canvas home
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()     // bottom strip
    // Two complementary docks (left surface + right inspector) + the rail nav.
    expect(screen.getAllByRole('complementary').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('navigation', { name: 'Studio surfaces' })).toBeInTheDocument()
  })

  it('the canvas is the always-mounted home (main landmark), not gated by a rail step', () => {
    renderStudio()
    // Present regardless of which surface is active — no wizard step gates it.
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument()
  })
})

describe('StudioShell — the Left Navigator (canonical two panes, SPEC S5)', () => {
  it('offers exactly the two Navigator panes (Add | Layers) — the demoted surfaces are OFF the rail', () => {
    renderStudio()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    for (const name of ['Add', 'Layers']) {
      expect(within(rail).getByRole('button', { name })).toBeEnabled()
    }
    // The former peer surfaces are DEMOTED — Data (→ inspector), Style/Pages&Site/Data
    // model (→ top-bar workspaces) are no longer rail destinations.
    for (const name of ['Data', 'Style', 'Pages & Site', 'Data model']) {
      expect(within(rail).queryByRole('button', { name })).toBeNull()
    }
  })

  it('opens on Add with aria-current, and swapping to Layers is order-free (no gating)', () => {
    renderStudio()
    // Add (id `insert`) is the default surface — its rail button is aria-current and the
    // dock heading reads Add.
    expect(screen.getByRole('heading', { name: 'Add' })).toBeInTheDocument()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: 'Add' })).toHaveAttribute('aria-current', 'true')

    // Jump straight to Layers — the heading is derived from the URL surface
    // (`/studio/layers`): the rail click navigated and the shell re-rendered from the
    // route (the routing round-trip).
    fireEvent.click(within(rail).getByRole('button', { name: 'Layers' }))
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeInTheDocument()
  })
})

// ── Data model — a first-class, always-reachable destination (AR-50 M5b) ──────
//
//  The G6 "built ≠ buried" fix: the Data-model destination is ALWAYS in the rail (no
//  role gate), and the role lens splits only its CONTENT (author→read-only Dictionary,
//  steward→modeler). Navigation is decoupled from identity — opening the destination
//  NEVER escalates the lens. These tests arrange the lens via the preference store.
describe('StudioShell — the Data-model workspace is reachable in every lens (AR-50 M5b · SPEC S5)', () => {
  it('the DEFAULT (author) session offers the Data-model destination on the TOP BAR (demoted off the rail)', () => {
    renderStudio()
    // SPEC S5: Data model is a top-bar-summoned workspace now, not a rail entry.
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('button', { name: 'Data model' })).toBeEnabled()
  })

  it('from a DEFAULT author session, opening Data model shows the READ-ONLY Dictionary (no query cliff)', () => {
    renderStudio()
    const banner = screen.getByRole('banner')
    fireEvent.click(within(banner).getByRole('button', { name: 'Data model' }))

    // The Data-model FOCUS-VIEW screen opens (rail gone, breadcrumb-back present)…
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
    renderStudio()
    const banner = screen.getByRole('banner')
    fireEvent.click(within(banner).getByRole('button', { name: 'Data model' }))
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
    expect(screen.queryByTestId('data-dictionary')).toBeNull()
  })

  it('the top-bar "Data model" switch is PURE NAVIGATION — it opens the destination without escalating the lens', () => {
    renderStudio()
    const banner = screen.getByRole('banner')
    fireEvent.click(within(banner).getByRole('button', { name: 'Data model' }))

    // Navigated to the destination, but the lens stayed author → the read-only Dictionary.
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
  })

  it('the in-place lens toggle opts INTO editing (author→steward) without leaving the destination', () => {
    renderStudio()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Data model' }))
    // Author landed on the Dictionary; flip the lens toggle to Edit → the modeler.
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Edit \(Steward\)/ }))
    expect(useRoleStore.getState().role).toBe('steward')
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })

  it('breadcrumb-back leaves the Focus-View and returns to the editing shell (lens untouched)', () => {
    useRoleStore.setState({ role: 'steward' })
    renderStudio('model')
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Studio surfaces' })).toBeNull()

    // Back returns to the editing shell at the default surface; navigation is
    // independent of identity, so the lens is NOT reset by leaving.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useRoleStore.getState().role).toBe('steward')
    expect(screen.getByRole('heading', { name: 'Add' })).toBeInTheDocument()
    // The restored shell shows the two Navigator panes again.
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: 'Add' })).toBeEnabled()
  })
})

describe('StudioShell — Theme + Site are top-bar-summoned surfaces, OFF the rail (SPEC S5)', () => {
  it('the top bar summons the Theme (brand) surface into the left dock — canvas stays visible', () => {
    renderStudio()
    // Neither is a rail entry…
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).queryByRole('button', { name: 'Brand & theme' })).toBeNull()
    // …but the top-bar button summons it: the dock heading reads Brand & theme, and the
    // editing shell (rail + canvas) REMAINS (deliberately NOT full-screen — the live
    // canvas repaints as tokens change).
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Brand & theme' }))
    expect(screen.getByRole('heading', { name: 'Brand & theme' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Studio surfaces' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeInTheDocument()
  })

  it('the top bar summons the Site (pages & site) surface into the left dock', () => {
    renderStudio()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Site & chrome' }))
    expect(screen.getByRole('heading', { name: 'Pages & Site' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Studio surfaces' })).toBeInTheDocument()
  })
})

describe('StudioShell — the Add pane carries the onboard-data front door (AR-51, re-homed)', () => {
  it('the default (Add) surface exposes the raw-data onboarding CTA', () => {
    renderStudio()
    // AR-51's front-door re-homed from the retired Data surface into the always-visible
    // Add pane — reachable before any block exists on a blank page.
    expect(screen.getByTestId('onboard-data-cta')).toBeInTheDocument()
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
    renderStudio()

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
