// @vitest-environment jsdom
//
// ── RepairOnShow — hidden→shown re-projection guard (defect A) ────────────────
//
//  Root cause (pre-existing, independent of the b5ae777 chart-height regression):
//  a chart↔table view toggle keeps the map view mounted-but-hidden
//  (`display:none`). A cross-filter row-select changes `selectedGeos` while
//  hidden → `<GeoJSON key={choroplethLayerKey(...)}>` remounts against a 0×0
//  container → every path projects to `d="M0 0"` (blank map, unrecoverable on
//  toggle-back). This pins the REPAIR half of the fix: on a NOT-laid-out →
//  laid-out transition, the map must re-measure (`invalidateSize`) and
//  re-project (`fitBounds`) — regardless of what changed while hidden.
//
//  Real Leaflet + react-leaflet aren't exercised here (heavy DOM/canvas
//  machinery jsdom can't faithfully drive) — `useMap`/`L.geoJSON` are mocked to
//  spies so this unit pins the HANDLER'S invariant precisely. Per the task's own
//  instruction: this does not prove the live Leaflet projection recovers in a
//  real browser — that is a POST-DEPLOY LIVE CHECK, not a unit-test claim.
//

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const invalidateSize = vi.fn()
const fitBounds      = vi.fn()
const mapStub        = { invalidateSize, fitBounds }

vi.mock('react-leaflet', () => ({
  useMap:      () => mapStub,
  GeoJSON:     () => null,
  MapContainer: () => null,
}))

const getBounds = vi.fn((): { isValid: () => boolean } => ({ isValid: () => true }))
vi.mock('leaflet', () => ({
  default: { geoJSON: () => ({ getBounds }) },
}))

import { RepairOnShow } from './GeoMap'

afterEach(() => {
  cleanup()
  invalidateSize.mockClear()
  fitBounds.mockClear()
  getBounds.mockClear()
})

const geoJson = {} as GeoJSON.FeatureCollection

describe('RepairOnShow — hidden→shown re-projection (defect A)', () => {
  it('does nothing while the container stays hidden', () => {
    render(<RepairOnShow geoJson={geoJson} visible={false} />)
    expect(invalidateSize).not.toHaveBeenCalled()
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('invalidateSize + fitBounds fire on a hidden→shown transition', () => {
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    rerender(<RepairOnShow geoJson={geoJson} visible={true} />)
    expect(invalidateSize).toHaveBeenCalledTimes(1)
    expect(fitBounds).toHaveBeenCalledTimes(1)
  })

  it('does not re-fire while visible stays stably true (no redundant repaint every render)', () => {
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={true} />)
    invalidateSize.mockClear()
    fitBounds.mockClear()
    rerender(<RepairOnShow geoJson={geoJson} visible={true} />)
    expect(invalidateSize).not.toHaveBeenCalled()
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('does not fire on a shown→hidden transition (only repairs on RE-show)', () => {
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={true} />)
    invalidateSize.mockClear()
    fitBounds.mockClear()
    rerender(<RepairOnShow geoJson={geoJson} visible={false} />)
    expect(invalidateSize).not.toHaveBeenCalled()
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('skips fitBounds (but still measures) when the geoJson bounds are not valid', () => {
    getBounds.mockReturnValueOnce({ isValid: () => false })
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    rerender(<RepairOnShow geoJson={geoJson} visible={true} />)
    expect(invalidateSize).toHaveBeenCalledTimes(1)
    expect(fitBounds).not.toHaveBeenCalled()
  })
})
