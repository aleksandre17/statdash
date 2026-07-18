// ── CubeInventory tests (0091 · «რა მაქვს» — cubes + browsable classifiers) ──────
//
//  Renders every governed cube from the ONE SSOT (cubeApi.datasets + cubeProfile.store);
//  expanding a cube shows its dimensions + label-debt; expanding a dimension browses its
//  codelist (classifiers). The «browse in workbench» cross-gesture emits the cube's
//  measures. Honest loading/error/empty states.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CubeProfile } from '../../lib/cubeApi'
import { CubeInventory } from './CubeInventory'
import { useCubeProfileStore } from '../../discovery/cubeProfile.store'

const datasetsMock = vi.fn()
vi.mock('../../lib/cubeApi', () => ({
  cubeApi: {
    datasets: () => datasetsMock(),
    profile:  () => Promise.resolve(undefined),
  },
}))

const profile: CubeProfile = {
  datasetCode: 'REGIONAL_GVA',
  dimensions: [
    { code: 'geo', conceptRole: 'REF_AREA', isTime: false, members: [
      { code: 'GE', label: { ka: 'საქართველო', en: 'Georgia' }, parentCode: null },
      { code: 'GE-AJ', label: { ka: 'აჭარა', en: 'Adjara' }, parentCode: 'GE' },
      { code: 'R', label: {}, parentCode: null },   // label debt
    ] },
    { code: 'time', conceptRole: null, isTime: true, members: [
      { code: '2020', label: {}, parentCode: null },
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

describe('CubeInventory', () => {
  it('lists the governed cubes (title + code) from the SSOT', async () => {
    render(<CubeInventory locale="ka" />)
    const row = await screen.findByTestId('inv-cube-REGIONAL_GVA')
    expect(row).toHaveTextContent('რეგიონული მშპ')
    expect(row).toHaveTextContent('REGIONAL_GVA')
  })

  it('expands a cube → its dimensions, with the member-label debt marked (time exempt)', async () => {
    render(<CubeInventory locale="ka" />)
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    expect(await screen.findByTestId('inv-dim-geo')).toBeInTheDocument()
    expect(screen.getByTestId('inv-dim-debt-geo')).toBeInTheDocument()
    expect(screen.queryByTestId('inv-dim-debt-time')).toBeNull()
  })

  it('expands a dimension → its codelist members in governed labels (the classifier browse)', async () => {
    render(<CubeInventory locale="ka" />)
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('inv-dim-geo'))
    const tree = await screen.findByTestId('codelist-tree')
    expect(tree).toHaveAttribute('data-hierarchical', 'true')
    expect(tree).toHaveTextContent('საქართველო')
  })

  it('the «browse in workbench» cross-gesture emits the cube measures', async () => {
    const onBrowse = vi.fn()
    render(<CubeInventory locale="ka" onBrowseInWorkbench={onBrowse} />)
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('inv-cube-workbench-REGIONAL_GVA'))
    expect(onBrowse).toHaveBeenCalledWith('REGIONAL_GVA', ['GVA'])
  })

  it('hides the cross-gesture when no handoff is wired (isolated mount)', async () => {
    render(<CubeInventory locale="ka" />)
    fireEvent.click(await screen.findByTestId('inv-cube-REGIONAL_GVA'))
    await screen.findByTestId('inv-dim-geo')
    expect(screen.queryByTestId('inv-cube-workbench-REGIONAL_GVA')).toBeNull()
  })

  it('declares an empty catalog honestly', async () => {
    datasetsMock.mockResolvedValue([])
    render(<CubeInventory locale="ka" />)
    await waitFor(() => expect(screen.getByTestId('cube-inventory-empty')).toBeInTheDocument())
  })

  it('declares a failed catalog honestly, never a crash', async () => {
    datasetsMock.mockRejectedValue(new Error('boom'))
    render(<CubeInventory locale="ka" />)
    await waitFor(() => expect(screen.getByTestId('cube-inventory-error')).toBeInTheDocument())
  })
})
