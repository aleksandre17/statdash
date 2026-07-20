// ── SourcesBody tests (0091 · «წყაროები» — the Data Home) ───────────────────────
//
//  The independent, FIRST-in-nav destination: the ONE upload door + the cube inventory
//  with browsable classifiers. ADR-051 DU2: the cross-gesture is an IN-WORKSPACE
//  selection — switch to the Model floor of THIS same Data workspace with the picked cube
//  riding the URL (`studioDataWorkbenchPath`), no cross-screen courier, no `setSurface`.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { CubeProfile } from '../../lib/cubeApi'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'

const datasetsMock = vi.fn()
vi.mock('../../lib/cubeApi', () => ({
  cubeApi: { datasets: () => datasetsMock(), profile: () => Promise.resolve(undefined) },
}))

const setRole = vi.fn()
vi.mock('../useRole', () => ({ useSetRole: () => setRole }))

import { SourcesBody } from './SourcesBody'

// A tiny probe that surfaces the live router location so a test can assert the
// in-workspace navigation (path + query) the browse gesture performs.
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>
}

const profile: CubeProfile = {
  datasetCode: 'REGIONAL_GVA',
  dimensions: [
    { code: 'geo', conceptRole: null, isTime: false, members: [
      { code: 'GE', label: { ka: 'საქართველო', en: 'Georgia' }, parentCode: null },
    ] },
  ],
  measures: [{ code: 'GVA', label: { en: 'GVA' }, unit: { unit_code: null, symbol: null, label: null, unit_type: null, unit_mult: null, decimals: null, base_period: null, source: 'none' } }],
  actualRegion: { available: false, combinations: null },
}

beforeEach(() => {
  datasetsMock.mockResolvedValue([{ code: 'REGIONAL_GVA', label: { ka: 'რეგიონული მშპ', en: 'Regional GVA' } }])
  useCubeProfileStore.setState({ byCode: { REGIONAL_GVA: { status: 'ready', profile } } })
})
afterEach(() => {
  useCubeProfileStore.setState({ byCode: {} })
  vi.clearAllMocks()
})

function renderInWorkspace() {
  render(
    <MemoryRouter initialEntries={['/studio/data']}>
      <SourcesBody locale="ka" />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('SourcesBody — the Data Home', () => {
  it('renders the ONE upload door AND the cube inventory in a labelled region', async () => {
    renderInWorkspace()
    expect(screen.getByRole('region', { name: 'წყაროები' })).toBeInTheDocument()
    expect(screen.getByTestId('sources-upload')).toBeInTheDocument()
    expect(screen.getByTestId('canonical-upload')).toBeInTheDocument()
    expect(await screen.findByTestId('inv-cube-REGIONAL_GVA')).toBeInTheDocument()
  })

  it('the browse gesture switches to the Model floor IN-WORKSPACE, seeding the cube on the URL (no courier, no setSurface)', async () => {
    renderInWorkspace()
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('inv-cube-workbench-REGIONAL_GVA'))

    // In-workspace: SAME `/studio/data` surface, only the floor query changes — no teleport.
    const loc = screen.getByTestId('loc').textContent ?? ''
    expect(loc.startsWith('/studio/data?')).toBe(true)
    const q = new URLSearchParams(loc.slice(loc.indexOf('?')))
    expect(q.get('dataFloor')).toBe('model')     // → the Model floor (where the workbench lives)
    expect(q.get('cube')).toBe('REGIONAL_GVA')   // the picked cube rides the URL (the ex-courier payload)
    expect(q.get('cubeMeasures')).toBe('GVA')    // its measures ride too (the steward head reads these)

    // The steward LENS is selected — shaping a raw cube is a steward activity (FF-AUTHOR-NO-QUERY).
    expect(setRole).toHaveBeenCalledWith('steward')
  })
})
