// ── FF-ONE-DATA-WORKSPACE — one data door, the source is step 0 (ADR-051 DU1) ────
//
//  The invariant, encoded as a red-on-regression gate (ADR-051 §Consequences):
//    "the rail exposes exactly ONE data destination; `sources` + `model` are not two
//     peer top-level entries."
//
//  ADR-051 DU1 folds the two former peer doors («წყაროები» Sources + «მოდელი» Model)
//  into ONE «მონაცემები» (Data) destination whose internal IA is the four-floor ladder
//  (Sources → Model → Pipelines → element). This gate locks the surface unification so
//  the archipelago cannot silently reopen: no second Sources/Model rail door, no second
//  data focus-view target, and the one workspace body composes the floors in place
//  (never a cross-screen teleport). It is the concrete discharge of ADR-050's governing
//  invariant — "a canonical capability offered in two places instead of one is a defect".
//
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { renderStudio } from '../test-support/renderStudio'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore } from '../store/constructor.store'
import { useRoleStore } from './useRole'
import { RAIL_ENTRIES } from './rail'
import { FOCUS_VIEW_TARGETS } from './focusViewRegistry'

beforeEach(() => {
  setupCanvasRegistry()
  useConstructorStore.setState({ selection: null })
  useConstructorStore.getState().updateSite({ defaultLocale: 'en', activeLocales: ['en'] })
  useRoleStore.setState({ role: 'author' })
})

// The one workspace body as raw text — proof it COMPOSES the two floors in place
// (Vite ?raw, browser-graph typed, no fs dep).
const WORKSPACE_SRC = import.meta.glob(['./DataWorkspaceBody.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('FF-ONE-DATA-WORKSPACE — exactly ONE data door on the rail', () => {
  it('the rail carries a single `data` destination and NO separate `sources` / `model` doors', () => {
    const dataDoors = RAIL_ENTRIES.filter((e) => e.id === 'data')
    expect(dataDoors).toHaveLength(1)
    // The two former peer doors are gone from the rail (not two peer top-level entries).
    expect(RAIL_ENTRIES.some((e) => e.id === 'sources')).toBe(false)
    expect(RAIL_ENTRIES.some((e) => e.id === 'model')).toBe(false)
    // Data leads («ჯერ მონაცემი») — the source is step 0.
    expect(RAIL_ENTRIES[0]?.id).toBe('data')
  })

  it('the focus-view registry holds ONE data target — no parallel `sources` / `data-model` targets', () => {
    const keys = Object.keys(FOCUS_VIEW_TARGETS)
    expect(keys).toContain('data')
    expect(keys).not.toContain('sources')
    expect(keys).not.toContain('data-model')
  })

  it('the ONE workspace body composes BOTH floors in place (Sources + Model) — no teleport', () => {
    const src = Object.values(WORKSPACE_SRC)[0] ?? ''
    // It renders the Sources floor AND the Model floor as floors of one screen…
    expect(/\bSourcesBody\b/.test(src)).toBe(true)
    expect(/\bDataModelBody\b/.test(src)).toBe(true)
    // …selected by the in-workspace floor switch, not a cross-screen navigation.
    expect(/data-floor-selector/.test(src)).toBe(true)
  })

  it('the rail renders exactly one Data button and no Sources/Model buttons (rendered proof)', () => {
    renderStudio()
    const rail = screen.getByRole('navigation', { name: 'Studio surfaces' })
    expect(within(rail).getAllByRole('button', { name: 'Data' })).toHaveLength(1)
    expect(within(rail).queryByRole('button', { name: 'Sources' })).toBeNull()
    expect(within(rail).queryByRole('button', { name: 'Model' })).toBeNull()
  })

  it('clicking Data opens the ONE workspace with both floors reachable in place', () => {
    renderStudio()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Studio surfaces' })).getByRole('button', { name: 'Data' }))

    // The single Data focus-view opened, defaulting to the Sources floor (step 0)…
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument()
    const floors = within(screen.getByTestId('data-floor-selector'))
    // …with BOTH floors offered as in-workspace switches (one screen, not two doors).
    expect(floors.getByRole('button', { name: 'Sources' })).toBeInTheDocument()
    expect(floors.getByRole('button', { name: 'Model' })).toBeInTheDocument()
    expect(screen.getByTestId('sources-body')).toBeInTheDocument()
  })

  it('the legacy `/studio/sources` + `/studio/model` routes redirect INTO the one workspace (reversible)', () => {
    // Strangler-safe: old bookmarks + the still-live courier land somewhere valid — the
    // one Data workspace — rather than a dead route (the redirects are kept, not deletions).
    renderStudio('sources')
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument()
    expect(screen.getByTestId('sources-body')).toBeInTheDocument()
  })

  it('the `/studio/model` redirect lands on the Model floor (browse-in-workbench keeps working)', () => {
    useRoleStore.setState({ role: 'steward' })
    renderStudio('model')
    expect(screen.getByRole('region', { name: 'Data' })).toBeInTheDocument()
    // dataFloor=model → the Model floor (steward → the modeler the courier expects).
    expect(screen.getByText(/Define the governed data model/)).toBeInTheDocument()
  })
})
