// ── DataModelBody — the data-first FRONT DOOR is one step from the shell (W2 · C1) ─
//
//  The AR-52 W2 fix for "onboarding is buried behind a lens flip" (STUDY §F3 / G8).
//  The onboard-data DOOR (CanonicalUpload) now sits ABOVE the role-lens split, so it
//  is reachable in ONE intentful step from the shell (rail Data → here) in EITHER lens
//  — the author no longer has to flip to Steward just to SEE the door. Governance is
//  preserved elsewhere (the FSM's publish is server-authorised; the raw-source modeler
//  stays behind the Steward "Edit" lens) — this proves only WHERE the door is.
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MetricCatalog } from '../discovery/useMetricCatalog'

// DataDictionarySurface (the author branch) reads the catalog through this hook.
let mockCatalog: MetricCatalog = { status: 'idle' }
vi.mock('../discovery/useMetricCatalog', () => ({ useMetricCatalog: () => mockCatalog }))

import { DataModelBody } from './DataModelBody'
import { useRoleStore } from './useRole'

beforeEach(() => {
  mockCatalog = { status: 'idle' }               // keep the branch light (no heavy metric render)
  useRoleStore.setState({ role: 'author' })      // the documented default session
})

describe('DataModelBody — the data-first front door (AR-52 W2 · Canon C1)', () => {
  it('surfaces the onboard-data door in the DEFAULT (author) lens — no Steward flip required', () => {
    render(<DataModelBody locale="en" />)
    // The front-door section AND the real upload affordance render for a plain author.
    expect(screen.getByTestId('data-front-door')).toBeInTheDocument()
    expect(screen.getByTestId('canonical-upload')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose workbook/ })).toBeInTheDocument()
  })

  it('keeps the door present in the Steward lens too (WHERE is lens-independent)', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<DataModelBody locale="en" />)
    // The door is synchronous (above the lazy modeler split), so it is present without
    // awaiting ModelSurface's heavy chunk — the same door, both lenses.
    expect(screen.getByTestId('data-front-door')).toBeInTheDocument()
    expect(screen.getByTestId('canonical-upload')).toBeInTheDocument()
  })
})
