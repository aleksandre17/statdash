// ── SourcesBody tests (0091 · «წყაროები» — the Data Home) ───────────────────────
//
//  The independent, FIRST-in-nav destination: the ONE upload door + the cube inventory
//  with browsable classifiers. The cross-gesture hands the steward into the Model page's
//  workbench (handoff + Steward lens + navigate to /studio/model).
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { CubeProfile } from '../../lib/cubeApi'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'
import { useSourcesHandoff } from '../../store/sourcesHandoff'

const datasetsMock = vi.fn()
vi.mock('../../lib/cubeApi', () => ({
  cubeApi: { datasets: () => datasetsMock(), profile: () => Promise.resolve(undefined) },
}))

const setSurface = vi.fn()
const setRole = vi.fn()
vi.mock('../useStudioRoute', () => ({ useSetSurface: () => setSurface }))
vi.mock('../useRole', () => ({ useSetRole: () => setRole }))

import { SourcesBody } from './SourcesBody'

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
  useSourcesHandoff.setState({ pendingCube: null })
})
afterEach(() => {
  useCubeProfileStore.setState({ byCode: {} })
  vi.clearAllMocks()
})

describe('SourcesBody — the Data Home', () => {
  it('renders the ONE upload door AND the cube inventory in a labelled region', async () => {
    render(<SourcesBody locale="ka" />)
    expect(screen.getByRole('region', { name: 'წყაროები' })).toBeInTheDocument()
    expect(screen.getByTestId('sources-upload')).toBeInTheDocument()
    expect(screen.getByTestId('canonical-upload')).toBeInTheDocument()
    expect(await screen.findByTestId('inv-cube-REGIONAL_GVA')).toBeInTheDocument()
  })

  it('the cross-gesture sets the handoff, flips to Steward, and navigates to the Model page', async () => {
    render(<SourcesBody locale="ka" />)
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('inv-cube-workbench-REGIONAL_GVA'))

    expect(useSourcesHandoff.getState().pendingCube).toEqual({ datasetCode: 'REGIONAL_GVA', measures: ['GVA'] })
    expect(setRole).toHaveBeenCalledWith('steward')
    expect(setSurface).toHaveBeenCalledWith('model')
  })
})
