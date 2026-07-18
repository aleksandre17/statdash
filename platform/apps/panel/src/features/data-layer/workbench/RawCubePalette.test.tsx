// ── RawCubePalette tests (0084 §1/§3 — the raw-cube browser + debt visibility) ──
//
//  Lists governed cubes; expanding one shows its dim summary with the member-label DEBT
//  marked honestly (the R/U gap); a browse pick emits the cube's measures for the steward
//  source(query) head. Everything OFFERED (P-OFFER), nothing typed.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CubeProfile } from '../../../lib/cubeApi'
import { RawCubePalette } from './RawCubePalette'
import { useCubeProfileStore } from '../../../discovery/cubeProfile.store'

const datasetsMock = vi.fn()
vi.mock('../../../lib/cubeApi', () => ({
  cubeApi: {
    datasets: () => datasetsMock(),
    profile:  () => Promise.resolve(undefined),
  },
}))

const profile: CubeProfile = {
  datasetCode: 'REGIONAL_GVA',
  dimensions: [
    { code: 'geo', conceptRole: null, isTime: false, members: [
      { code: 'R', label: {}, parentCode: null },
      { code: 'U', label: {}, parentCode: null },
      { code: 'adjara', label: { ka: 'აჭარა', en: 'Adjara' }, parentCode: null },
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

describe('RawCubePalette', () => {
  it('lists the governed cubes (title + code)', async () => {
    render(<RawCubePalette locale="ka" onPickCube={() => {}} />)
    const row = await screen.findByTestId('raw-cube-REGIONAL_GVA')
    expect(row).toHaveTextContent('რეგიონული მშპ')
    expect(row).toHaveTextContent('REGIONAL_GVA')
  })

  it('surfaces the member-label DEBT on expand (the R/U gap), exempting the time axis', async () => {
    render(<RawCubePalette locale="ka" onPickCube={() => {}} />)
    fireEvent.click(await screen.findByTestId('raw-cube-REGIONAL_GVA'))
    // geo has 2 members without a governed label → a debt chip; time is exempt.
    const chip = await screen.findByTestId('dim-debt-geo')
    expect(chip).toHaveTextContent('2 წევრს ეტიკეტი აკლია')
    expect(screen.queryByTestId('dim-debt-time')).toBeNull()
  })

  it('browses a cube — emits its measures for the steward source(query) head', async () => {
    const onPickCube = vi.fn()
    render(<RawCubePalette locale="ka" onPickCube={onPickCube} />)
    fireEvent.click(await screen.findByTestId('raw-cube-REGIONAL_GVA'))
    fireEvent.click(await screen.findByTestId('raw-cube-browse-REGIONAL_GVA'))
    expect(onPickCube).toHaveBeenCalledWith('REGIONAL_GVA', ['GVA'])
  })

  it('declares an empty/failed catalog honestly, never a blank tab', async () => {
    datasetsMock.mockResolvedValue([])
    render(<RawCubePalette locale="ka" onPickCube={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('raw-cube-empty')).toBeInTheDocument())
  })
})
