// ── GetHead tests (0084 §1 — the plane-gated source picker) ────────────────────
//
//  FF-AUTHOR-NO-QUERY at the source picker: the AUTHOR lens shows metrics ONLY — no raw
//  tab, ever. The STEWARD lens gains the «ნედლი კუბები» tab (raw access as a role, plane law).
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GetHead } from './GetHead'
import { useRoleStore } from '../../../studio/useRole'

vi.mock('../../../discovery/MetricPalette', () => ({
  MetricPalette: ({ onBind }: { onBind?: (id: string) => void }) => (
    <button data-testid="mock-metrics" onClick={() => onBind?.('m.gdp')}>metrics</button>
  ),
}))
vi.mock('./RawCubePalette', () => ({
  RawCubePalette: ({ onPickCube }: { onPickCube?: (c: string, m: string[]) => void }) => (
    <button data-testid="mock-raw-cubes" onClick={() => onPickCube?.('REGIONAL_GVA', ['GVA'])}>cubes</button>
  ),
}))

afterEach(() => useRoleStore.setState({ role: 'author' }))

describe('GetHead — the AUTHOR lens (no raw tab, FF-AUTHOR-NO-QUERY)', () => {
  beforeEach(() => useRoleStore.setState({ role: 'author' }))

  it('shows the metric palette ONLY — no raw-cube tab, no tablist', () => {
    render(<GetHead locale="ka" onPickMetric={() => {}} onPickCube={() => {}} />)
    expect(screen.getByTestId('mock-metrics')).toBeInTheDocument()
    expect(screen.queryByTestId('get-tab-cubes')).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByTestId('mock-raw-cubes')).toBeNull()
  })

  it('binds a governed metric through onPickMetric', () => {
    const onPickMetric = vi.fn()
    render(<GetHead locale="ka" onPickMetric={onPickMetric} onPickCube={() => {}} />)
    fireEvent.click(screen.getByTestId('mock-metrics'))
    expect(onPickMetric).toHaveBeenCalledWith('m.gdp')
  })
})

describe('GetHead — the STEWARD lens (metrics | raw cubes)', () => {
  beforeEach(() => useRoleStore.setState({ role: 'steward' }))

  it('shows TWO tabs; metrics is default; the raw-cube tab reveals the raw palette', () => {
    render(<GetHead locale="ka" onPickMetric={() => {}} onPickCube={() => {}} />)
    expect(screen.getByTestId('get-tab-metrics')).toBeInTheDocument()
    expect(screen.getByTestId('get-tab-cubes')).toBeInTheDocument()
    // metrics is the default panel
    expect(screen.getByTestId('mock-metrics')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-raw-cubes')).toBeNull()
    // switch to raw cubes
    fireEvent.click(screen.getByTestId('get-tab-cubes'))
    expect(screen.getByTestId('mock-raw-cubes')).toBeInTheDocument()
  })

  it('emits a cube pick through onPickCube (measures forwarded)', () => {
    const onPickCube = vi.fn()
    render(<GetHead locale="ka" onPickMetric={() => {}} onPickCube={onPickCube} />)
    fireEvent.click(screen.getByTestId('get-tab-cubes'))
    fireEvent.click(screen.getByTestId('mock-raw-cubes'))
    expect(onPickCube).toHaveBeenCalledWith('REGIONAL_GVA', ['GVA'])
  })
})
