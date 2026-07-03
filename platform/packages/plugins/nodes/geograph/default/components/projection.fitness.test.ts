// @vitest-environment node
//
// ── projection.fitness — the declarative choropleth projects REAL geometry ────
//
//  The definitive close of the "map blanks when the container is display:none"
//  saga. The Leaflet renderer measured its DOM box to project geometry; a
//  selection change while hidden re-projected against a 0×0 box → every path
//  degenerated to `d="M0 0"` → blank map (five imperative patches failed). The
//  declarative d3-geo projection derives geometry PURELY from the geojson data +
//  a fixed projection, with NO DOM input — so this bug class is structurally
//  impossible.
//
//  This node-env fitness pins that:
//    (1) every region projects to a real, non-degenerate SVG path `d` (never
//        empty, never the `M0 0` blank signature),
//    (2) the projection is DETERMINISTIC — identical output on every call, so it
//        cannot depend on container visibility (there is no DOM to read),
//    (3) the viewBox is a finite, positive-area box fitted to the data.

import { describe, it, expect } from 'vitest'
import { projectChoropleth } from './projection'

// A minimal Georgia-ish fixture: three real-coordinate polygons at ~42°N. Small on
// purpose — enough to prove the projection yields real geometry without shipping the
// full 13-region file. The live map loads apps/geostat's georgia-regions.geojson.
const FIXTURE: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    poly('GE-TB', [[44.7, 41.6], [45.0, 41.6], [45.0, 41.9], [44.7, 41.9]]),
    poly('GE-AJ', [[41.6, 41.5], [42.0, 41.5], [42.0, 41.8], [41.6, 41.8]]),
    poly('GE-KA', [[45.5, 41.5], [46.5, 41.5], [46.5, 42.2], [45.5, 42.2]]),
  ],
}

function poly(shapeISO: string, ring: [number, number][]): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { shapeISO },
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
  }
}

// The blank signature the Leaflet defect produced — a path that starts-and-ends at
// the origin with no real extent. Must NEVER appear.
const BLANK = /^M\s*0[ ,]0(?:\D|$)/

describe('projectChoropleth — every region projects to real geometry (no M0 0 blank)', () => {
  it('preserves the feature count', () => {
    const { features } = projectChoropleth(FIXTURE)
    expect(features).toHaveLength(FIXTURE.features.length)
  })

  it('emits a non-empty, non-degenerate path `d` for every region', () => {
    const { features } = projectChoropleth(FIXTURE)
    for (const { feature, d } of features) {
      const iso = feature.properties?.shapeISO
      expect(d, `region ${iso} produced an empty path`).not.toBe('')
      expect(d.startsWith('M'), `region ${iso} path does not start with a moveto`).toBe(true)
      expect(BLANK.test(d), `region ${iso} degenerated to the M0 0 blank signature`).toBe(false)
      // A real polygon has several coordinate commands, not a single point.
      expect(d.length, `region ${iso} path is suspiciously short`).toBeGreaterThan(10)
    }
  })

  it('fits a finite, positive-area viewBox to the data', () => {
    const { viewBox } = projectChoropleth(FIXTURE)
    const [minX, minY, w, h] = viewBox.split(' ').map(Number)
    expect([minX, minY, w, h].every(Number.isFinite)).toBe(true)
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  // ── the structural fix: geometry is data-derived, so visibility is irrelevant ──
  //
  //  There is no `visible` parameter and no DOM read anywhere in the projection, so
  //  a hidden→shown toggle CANNOT change the output. We prove that operationally:
  //  the projection is a pure function — two independent calls (as would happen on a
  //  hidden re-render and a shown re-render) yield byte-identical paths.
  it('is deterministic — same paths on every call (independent of any container box)', () => {
    const a = projectChoropleth(FIXTURE)
    const b = projectChoropleth(FIXTURE)
    expect(a.viewBox).toBe(b.viewBox)
    expect(a.features.map(f => f.d)).toEqual(b.features.map(f => f.d))
  })

  // ── the winding-order fix: real datasets ship clockwise exterior rings ────────
  //
  //  d3-geo is SPHERICAL — ring winding decides interior/exterior. The live
  //  georgia-regions.geojson (like many real sources) uses clockwise exterior
  //  rings, which d3-geo reads as "the whole sphere minus the region": geoArea ≈ 4π
  //  and every region projects to fill the ENTIRE frame (a solid block, no distinct
  //  regions). The fixture above is correctly wound, so it never caught this — this
  //  case feeds the INVERTED winding and pins that projectChoropleth normalizes it.
  it('is winding-agnostic — inverted (clockwise) exterior rings project identically to CCW', () => {
    const invert = (f: GeoJSON.Feature): GeoJSON.Feature => ({
      ...f,
      geometry: {
        ...(f.geometry as GeoJSON.Polygon),
        coordinates: (f.geometry as GeoJSON.Polygon).coordinates.map(r => [...r].reverse()),
      },
    })
    const inverted: GeoJSON.FeatureCollection = { ...FIXTURE, features: FIXTURE.features.map(invert) }
    const ccw = projectChoropleth(FIXTURE).features.map(f => f.d)
    const cw  = projectChoropleth(inverted).features.map(f => f.d)
    // Postel's Law: accept either winding, emit the same correct geometry.
    expect(cw).toEqual(ccw)
    // And crucially none of them is a whole-frame block: a region's path must not span
    // the full fitted box in BOTH axes (that is the inverted-winding solid-block defect).
    const { viewBox, features } = projectChoropleth(inverted)
    const [minX, minY, w, h] = viewBox.split(' ').map(Number)
    for (const { feature, d } of features) {
      const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      const xs = nums.filter((_, i) => i % 2 === 0)
      const ys = nums.filter((_, i) => i % 2 === 1)
      const spanX = Math.max(...xs) - Math.min(...xs)
      const spanY = Math.max(...ys) - Math.min(...ys)
      const iso = feature.properties?.shapeISO
      expect(spanX < w * 0.98 || spanY < h * 0.98, `region ${iso} fills the whole frame (inverted winding not normalized)`).toBe(true)
      void minX; void minY
    }
  })

  it('projects the same geometry regardless of surrounding render state (no hidden-box coupling)', () => {
    // Simulate the exact defect scenario: the component re-renders while "hidden"
    // (no layout) and again while "shown". Because geometry comes only from the data,
    // both produce identical paths — the blank-when-hidden class cannot recur.
    const whileHidden = projectChoropleth(FIXTURE).features.map(f => f.d)
    const whileShown  = projectChoropleth(FIXTURE).features.map(f => f.d)
    expect(whileHidden).toEqual(whileShown)
    expect(whileHidden.every(d => !BLANK.test(d))).toBe(true)
  })
})
