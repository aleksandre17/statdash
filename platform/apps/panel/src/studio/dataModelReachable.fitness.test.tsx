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
import { screen, within, fireEvent } from '@testing-library/react'
import { renderStudio } from '../test-support/renderStudio'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { useRoleStore } from './useRole'
import { FOCUS_VIEW_TARGETS } from './focusViewRegistry'

// The DOCUMENTED default session: a fresh user lands in the author lens on the default
// surface (renderStudio() opens `/studio/insert`). This is the exact state the
// "built ≠ buried" guard must cover.
beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ selection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useRoleStore.setState({ role: 'author' })
})

// ADR-051 DU1: the two former peer doors fold into ONE «მონაცემები» (Data) rail mode —
// the ONE Data workspace whose internal IA is the four-floor ladder. The governed
// data-MODEL is the Model floor of that workspace (reached by the in-workspace floor
// selector); it stays a reachable, non-role-gated destination. Reach the workspace from
// the rail's single Data button.
const railData = () =>
  within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: 'Data' })

// The in-workspace floor selector — the Model floor button (the governed model lives here).
const modelFloor = () =>
  within(screen.getByTestId('data-floor-selector')).getByRole('button', { name: 'Model' })

describe('FF-DATA-REACHABLE — the data model is reachable from a default (author) session', () => {
  it('the ONE Data workspace is an always-visible, non-role-gated rail mode (the front door)', () => {
    // Encoded structurally: it is a registered focus-view target (a reachable
    // destination), so no future role/visibility gate can bury it without tripping this…
    expect(Object.keys(FOCUS_VIEW_TARGETS)).toContain('data')

    // …and from the DEFAULT session the rail Data mode is present + enabled.
    renderStudio()
    expect(railData()).toBeEnabled()
  })

  it('ONE click from the default session lands the user IN the Data workspace (source is step 0)', () => {
    renderStudio()
    fireEvent.click(railData())

    // The destination opened (the focus-view screen with its breadcrumb-back)…
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    // …on the SOURCES floor by default (the source is step 0 — the honest first
    // affordance, Law 11), with the Model floor one obvious in-workspace switch away.
    expect(screen.getByTestId('sources-body')).toBeInTheDocument()
    expect(modelFloor()).toBeEnabled()
  })

  it('the default (author) reach of the Model floor is the READ-ONLY Dictionary — never the raw modeler', () => {
    renderStudio()
    fireEvent.click(railData())
    fireEvent.click(modelFloor())

    // The lens was NOT escalated by navigating (built ≠ buried does not mean
    // "expose the query cliff") — the author sees the governed Data Dictionary…
    expect(useRoleStore.getState().role).toBe('author')
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    // …and the raw modeler (ModelSurface's define caption) is absent on the author path.
    expect(screen.queryByText(/Define the governed data model/)).toBeNull()
  })

  it('the ⌘K / deep-link route reaches the Model floor too (a second discoverable entry)', () => {
    // The legacy `/studio/model` route is the deep-link/command entry (useCommandRunner
    // opens `/studio/data?dataFloor=model`) — a second obvious path to the Model floor,
    // still author-lens read-only.
    renderStudio('model')
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument()
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
  })
})
