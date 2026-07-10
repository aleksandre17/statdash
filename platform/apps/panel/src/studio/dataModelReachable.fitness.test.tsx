// ── FF-DATA-REACHABLE — the data-model capability is reachable from a DEFAULT session ─
//  (AR-50 M5b — closes G6, "built ≠ buried")
//
//  The invariant, encoded as a red-on-regression gate: the whole data-model capability
//  MUST be reachable, in obvious clicks, from a DEFAULT (author) session — the exact
//  state a fresh user lands in. It was BUILT, unit-green, and fitness-covered, yet
//  effectively INVISIBLE (gated behind a default-off Steward preference reached only by
//  a non-prominent toggle). This guard codifies discoverability so it can never
//  silently regress: from the documented default session, the Data-model rail entry is
//  present and one click lands the user in the destination — as the READ-ONLY Data
//  Dictionary (author lens), NEVER the raw query modeler (FF-AUTHOR-NO-QUERY holds).
//
//  This is the jsdom leg (fast CI gate). The LIVE leg — the real Vite bundle in
//  Chromium, the assertion jsdom structurally cannot make — is e2e/dataModelReachable.e2e.ts.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { StudioShell } from './StudioShell'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { INITIAL_STUDIO_SURFACE } from '../store/constructor.history'
import { useRoleStore } from './useRole'
import { RAIL_ENTRIES } from './rail'

// The DOCUMENTED default session: a fresh user lands in the author lens on the initial
// surface. This is the exact state the "built ≠ buried" guard must cover.
beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ activeSurface: INITIAL_STUDIO_SURFACE, selectedNodeId: null, chromeSelection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useRoleStore.setState({ role: 'author' })
})

describe('FF-DATA-REACHABLE — the data model is reachable from a default (author) session', () => {
  it('the Data-model destination is an always-visible rail entry (not gated by the lens)', () => {
    // Encoded structurally too: the destination exists in the flat rail table, so no
    // future role/visibility gate can bury it without tripping this line.
    expect(RAIL_ENTRIES.some((e) => e.id === 'model')).toBe(true)

    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getByRole('button', { name: /Data model/ })).toBeEnabled()
  })

  it('ONE click from the default session lands the user IN the data-model destination', () => {
    render(<StudioShell />)
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    fireEvent.click(within(rail).getByRole('button', { name: /Data model/ }))

    // The destination opened (the focus-view screen with its breadcrumb-back)…
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByRole('region', { name: 'Data model' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('the default (author) reach is the READ-ONLY Dictionary — never the raw query modeler', () => {
    render(<StudioShell />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: /Data model/ }))

    // The lens was NOT escalated by navigating (built ≠ buried does not mean
    // "expose the query cliff") — the author sees the governed Data Dictionary…
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    // …and the raw modeler (ModelSurface's define caption) is absent on the author path.
    expect(screen.queryByText(/Define the governed data model/)).toBeNull()
  })

  it('the top-bar destination switch reaches it too (a second discoverable entry)', () => {
    render(<StudioShell />)
    const banner = screen.getByRole('banner')
    fireEvent.click(within(banner).getByRole('button', { name: 'Data model' }))
    expect(useConstructorStore.getState().activeSurface).toBe('model')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
  })
})
