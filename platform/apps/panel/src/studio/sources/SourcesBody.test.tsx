// ── SourcesBody tests (0091 · «წყაროები» — the Data Home) ───────────────────────
//
//  The independent, FIRST-in-nav destination: the ONE upload door + the cube inventory
//  with browsable classifiers + (DU6-IA-1) the steward-gated registered-source CRUD.
//  ADR-051 DU2 / DU6-IA-1: the cross-gesture is an IN-WORKSPACE selection — switch to the
//  Specs floor of THIS same Data workspace with the picked cube riding the URL
//  (`studioDataWorkbenchPath`), no cross-screen courier, no `setSurface`.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { CubeProfile } from '../../lib/cubeApi'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'
import { useConstructorStore } from '../../store/constructor.store'
import type { DataSourceDef } from '../../types/constructor'

const datasetsMock = vi.fn()
vi.mock('../../lib/cubeApi', () => ({
  cubeApi: { datasets: () => datasetsMock(), profile: () => Promise.resolve(undefined) },
}))

const setRole = vi.fn()
let mockRole: 'author' | 'steward' = 'author'
vi.mock('../useRole', () => ({
  useRole: () => mockRole,
  useSetRole: () => setRole,
}))

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

const SOURCE: DataSourceDef = {
  id: 'src-1', name: 'SDMX source', type: 'sdmx-json', config: {}, status: 'connected',
}

beforeEach(() => {
  mockRole = 'author'
  datasetsMock.mockResolvedValue([{ code: 'REGIONAL_GVA', label: { ka: 'რეგიონული მშპ', en: 'Regional GVA' } }])
  useCubeProfileStore.setState({ byCode: { REGIONAL_GVA: { status: 'ready', profile } } })
  useConstructorStore.setState({ dataSources: [SOURCE] })
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

  it('the browse gesture switches to the SPECS floor IN-WORKSPACE, seeding the cube on the URL (no courier, no setSurface)', async () => {
    renderInWorkspace()
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('inv-cube-workbench-REGIONAL_GVA'))

    // In-workspace: SAME `/studio/data` surface, only the floor query changes — no teleport.
    const loc = screen.getByTestId('loc').textContent ?? ''
    expect(loc.startsWith('/studio/data?')).toBe(true)
    const q = new URLSearchParams(loc.slice(loc.indexOf('?')))
    expect(q.get('dataFloor')).toBe('specs')      // → the Specs floor (where the workbench lives)
    expect(q.get('cube')).toBe('REGIONAL_GVA')    // the picked cube rides the URL (the ex-courier payload)
    expect(q.get('cubeMeasures')).toBe('GVA')     // its measures ride too (the steward head reads these)

    // The steward LENS is selected — shaping a raw cube is a steward activity (FF-AUTHOR-NO-QUERY).
    expect(setRole).toHaveBeenCalledWith('steward')
  })

  it('hides the registered-source CRUD from the AUTHOR lens (the raw-source governance wall)', () => {
    mockRole = 'author'
    renderInWorkspace()
    expect(screen.queryByTestId('sources-manager')).toBeNull()
  })

  it('reveals the registered-source CRUD (list + add + delete) behind the STEWARD lens', () => {
    mockRole = 'steward'
    renderInWorkspace()
    const manager = screen.getByTestId('sources-manager')
    expect(manager).toBeInTheDocument()
    // The source list reads the store…
    expect(screen.getByText('SDMX source')).toBeInTheDocument()
    // …and the add-source door is present.
    expect(screen.getByTestId('source-add')).toBeInTheDocument()
    // Selecting a source reveals the authoring panel with delete.
    fireEvent.click(screen.getByText('SDMX source'))
    expect(screen.getByTestId('source-delete')).toBeInTheDocument()
  })
})
