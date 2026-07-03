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
// A real laid-out container: the hardened RepairOnShow refuses to project against a
// 0×0 box (the very thing that corrupts the projection to NaN), so the happy path
// requires a container with non-zero size.
let containerSize    = { clientWidth: 800, clientHeight: 600 }
const getContainer   = vi.fn(() => containerSize)
const mapStub        = { invalidateSize, fitBounds, getContainer }

vi.mock('react-leaflet', () => ({
  useMap:      () => mapStub,
  GeoJSON:     () => null,
  MapContainer: () => null,
}))

// Finite, valid bounds by default (Georgia-ish extent). Individual tests override
// getBounds to simulate invalid / NaN corners.
const finiteBounds = {
  isValid:      () => true,
  getNorthEast: () => ({ lat: 43.6, lng: 46.7 }),
  getSouthWest: () => ({ lat: 41.0, lng: 40.0 }),
}
const getBounds = vi.fn((): typeof finiteBounds => finiteBounds)
vi.mock('leaflet', () => ({
  default: { geoJSON: () => ({ getBounds }) },
}))

import { RepairOnShow } from './GeoMap'

afterEach(() => {
  cleanup()
  invalidateSize.mockClear()
  fitBounds.mockClear()
  getBounds.mockClear()
  getContainer.mockClear()
  containerSize = { clientWidth: 800, clientHeight: 600 }
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
    getBounds.mockReturnValueOnce({
      isValid:      () => false,
      getNorthEast: () => ({ lat: 0, lng: 0 }),
      getSouthWest: () => ({ lat: 0, lng: 0 }),
    })
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    rerender(<RepairOnShow geoJson={geoJson} visible={true} />)
    expect(invalidateSize).toHaveBeenCalledTimes(1)
    expect(fitBounds).not.toHaveBeenCalled()
  })

  // ── hardening — RepairOnShow must NEVER throw to the error boundary ───────────

  it('does not measure or fit against a 0×0 (still-hidden-layout) container', () => {
    // display:none flips `visible` true, but the box has not laid out yet: projecting
    // here is exactly what produced NaN. Guard must bail before invalidateSize.
    containerSize = { clientWidth: 0, clientHeight: 0 }
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    rerender(<RepairOnShow geoJson={geoJson} visible={true} />)
    expect(invalidateSize).not.toHaveBeenCalled()
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('skips fitBounds when bounds report valid but have NaN corners (no crash)', () => {
    getBounds.mockReturnValueOnce({
      isValid:      () => true,
      getNorthEast: () => ({ lat: NaN, lng: NaN }),
      getSouthWest: () => ({ lat: 0, lng: 0 }),
    })
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    expect(() => rerender(<RepairOnShow geoJson={geoJson} visible={true} />)).not.toThrow()
    expect(fitBounds).not.toHaveBeenCalled()
  })

  it('swallows a thrown projection error instead of escaping to the boundary', () => {
    getBounds.mockImplementationOnce(() => { throw new Error('Invalid LatLng object: (NaN, NaN)') })
    const { rerender } = render(<RepairOnShow geoJson={geoJson} visible={false} />)
    expect(() => rerender(<RepairOnShow geoJson={geoJson} visible={true} />)).not.toThrow()
  })
})
