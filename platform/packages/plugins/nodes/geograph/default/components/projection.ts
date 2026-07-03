// ── projection — pure d3-geo choropleth projection (agnostic, no DOM) ─────────
//
//  The DECLARATIVE heart of the SVG choropleth. Geometry is projected from the
//  GeoJSON DATA with a fixed projection fitted to a nominal box — NOT from a
//  measured DOM container. Because nothing here reads the DOM, a `display:none`
//  wrapper cannot influence the output: the whole class of "map blanks when the
//  container is hidden while a selection changes" (the Leaflet stale-origin
//  defect five imperative patches fought) is STRUCTURALLY impossible — there is
//  no pixel origin to go stale, only data and a deterministic projection.
//
//  No React, no Leaflet — a pure module (mirrors ./choropleth) so the invariant
//  "every region projects to real, non-degenerate geometry" is guarded in a node
//  test env, independent of any renderer.
//
//  Law 1: features are agnostic GeoJSON; the caller supplies the iso→geo join.

import { geoArea, geoMercator, geoPath } from 'd3-geo'

/** A projected region: its source feature + the SVG `<path d>` attribute string. */
export interface ProjectedFeature {
  feature: GeoJSON.Feature
  d:       string
}

// ── Winding normalization (Postel's Law at the geometry boundary) ─────────────
//
//  d3-geo uses SPHERICAL geometry: a polygon's ring winding order decides which
//  side is "inside". The GeoJSON spec says exterior rings are counter-clockwise,
//  but many real datasets (this one included) ship clockwise exterior rings.
//  d3-geo then reads each region as "the whole sphere MINUS the region" — its
//  geoArea comes out ≈ 4π and every feature projects to fill the entire frame
//  (the map renders as one solid block instead of distinct regions). Leaflet
//  tolerated this because it is PLANAR (winding-agnostic); d3-geo does not.
//
//  Fix: accept the geojson as authored, but normalize winding here. A feature
//  whose spherical area exceeds a hemisphere (2π) is inverted → reverse every
//  linear ring (exterior + holes together) to flip it back to its true interior.
//  Only geometry.coordinates change; properties (the iso join) are preserved.

const HEMISPHERE = 2 * Math.PI

// Reverse the point order of every linear ring, at any nesting depth
// (LineString ring · Polygon · MultiPolygon). Recurses until it reaches an
// array of [lng, lat] positions, which it reverses in place of the ring.
function reverseRings(coords: unknown): unknown {
  const arr = coords as unknown[]
  return typeof (arr[0] as number[])[0] === 'number'
    ? arr.slice().reverse()
    : arr.map(reverseRings)
}

/** Rewind any inverted (clockwise-exterior) feature to the d3-geo convention. */
function normalizeWinding(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    ...fc,
    features: fc.features.map((feature) =>
      geoArea(feature) > HEMISPHERE
        ? {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: reverseRings(
                (feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates,
              ),
            } as GeoJSON.Geometry,
          }
        : feature,
    ),
  }
}

export interface ProjectedChoropleth {
  features: ProjectedFeature[]
  /** SVG viewBox (`minX minY width height`) tightly fitted to the projected extent. */
  viewBox:  string
}

// Nominal projection box (viewBox units). Arbitrary: the SVG viewBox normalizes it
// to the element's real pixel size at paint (preserveAspectRatio), so this only
// sets coordinate precision, never the on-screen size. Larger → finer path coords.
const RENDER_SIZE = 1000
// Geometric breathing room (fraction of the larger extent) so a selected region's
// heavier edge is not clipped at the SVG boundary. Strokes are non-scaling (drawn
// in screen px), so this is only a hairline of margin in the coordinate space.
const MARGIN_FRACTION = 0.02

/**
 * Project a FeatureCollection into SVG path strings + a tight viewBox.
 *
 * Projection: `geoMercator` — the conventional web-map projection, accurate for a
 * small, mid-latitude extent (a single country / its regions). `fitSize` derives
 * the scale + translate ENTIRELY from the geometry, so the result is deterministic
 * and DOM-independent (the reason the hidden→shown bug cannot recur). The viewBox
 * is set to the projected geometry's tight bounds (plus a hairline margin), so the
 * SVG scales responsively with zero letterboxing regardless of the container box.
 */
export function projectChoropleth(
  geoJson: GeoJSON.FeatureCollection,
  size = RENDER_SIZE,
): ProjectedChoropleth {
  // Normalize ring winding BEFORE fitting: an inverted feature reports a whole-
  // sphere extent, which would blow up fitSize and collapse every region to a dot.
  const oriented = normalizeWinding(geoJson)
  const projection = geoMercator().fitSize([size, size], oriented)
  const path = geoPath(projection)

  const features: ProjectedFeature[] = oriented.features.map((feature) => ({
    feature,
    d: path(feature) ?? '',
  }))

  const [[x0, y0], [x1, y1]] = path.bounds(oriented)
  const w = x1 - x0
  const h = y1 - y0
  const m = Math.max(w, h) * MARGIN_FRACTION
  const viewBox = `${x0 - m} ${y0 - m} ${w + 2 * m} ${h + 2 * m}`

  return { features, viewBox }
}
