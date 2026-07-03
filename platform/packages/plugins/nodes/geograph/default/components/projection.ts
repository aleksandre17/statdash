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

import { geoMercator, geoPath } from 'd3-geo'

/** A projected region: its source feature + the SVG `<path d>` attribute string. */
export interface ProjectedFeature {
  feature: GeoJSON.Feature
  d:       string
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
  const projection = geoMercator().fitSize([size, size], geoJson)
  const path = geoPath(projection)

  const features: ProjectedFeature[] = geoJson.features.map((feature) => ({
    feature,
    d: path(feature) ?? '',
  }))

  const [[x0, y0], [x1, y1]] = path.bounds(geoJson)
  const w = x1 - x0
  const h = y1 - y0
  const m = Math.max(w, h) * MARGIN_FRACTION
  const viewBox = `${x0 - m} ${y0 - m} ${w + 2 * m} ${h + 2 * m}`

  return { features, viewBox }
}
