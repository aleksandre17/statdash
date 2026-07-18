// ── DataModelBody — the Model page is Floor-2 ONLY (0091 · Data-Home split) ──────
//
//  The owner's re-architecture (2026-07-18): raw sources are their OWN top-level
//  destination now («წყაროები», FIRST in the nav) — the ONE upload door + the cube
//  inventory + classifiers live THERE, not here. This page is the GOVERNED semantic
//  MODEL: the dictionary/flow-map (author lens) or the metric/dimension modeler (steward
//  lens). This guard proves the Floor-1 upload door NEVER returns to the Model page
//  (screen-level SRP — the decoupling the owner demanded), and the lens split still holds.
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

describe('DataModelBody — Floor-2 only, no upload door (0091)', () => {
  it('carries NO upload door in the DEFAULT (author) lens — it moved to «წყაროები»', () => {
    render(<DataModelBody locale="en" />)
    // The author reach is the read-only dictionary; the Floor-1 front door is gone.
    expect(screen.getByTestId('data-dictionary')).toBeInTheDocument()
    expect(screen.queryByTestId('data-front-door')).toBeNull()
    expect(screen.queryByTestId('canonical-upload')).toBeNull()
  })

  it('carries NO upload door in the Steward lens either (SRP — one page, one job)', () => {
    useRoleStore.setState({ role: 'steward' })
    render(<DataModelBody locale="en" />)
    // The lens toggle is present (browse ⇄ edit stays in-place), but no upload door.
    expect(screen.getByTestId('data-model-lens-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('data-front-door')).toBeNull()
    expect(screen.queryByTestId('canonical-upload')).toBeNull()
  })
})
