// ── choropleth — pure value→fill scale for the geograph map ───────────────────
//
//  The ONE choropleth engine (FF-ONE-MAP-ENGINE): value→color is derived from
//  the token-driven sequential ramp (@statdash/styles), never a rival palette.
//  No React, no map library — a pure module so the flat-map invariant is guarded
//  in a node test env, and the style resolver is renderer-neutral (it feeds the
//  SVG <path> fill/stroke attributes; see GeoMap).
//
//  Law 1: rows are agnostic DataRow records; id = the geo dim value.
//

import type { DataRow } from '@statdash/engine'
import { cssVar, sequentialRamp, quantileColors } from '@statdash/styles'

/**
 * Renderer-neutral per-region style. Property names mirror the SVG presentation
 * attributes each maps onto: `fillColor` → `fill`, `fillOpacity` → `fill-opacity`,
 * `color` → `stroke`, `weight` → `stroke-width`. Kept as a plain data shape (no
 * map-library type) so the choropleth engine has zero renderer dependency.
 */
export interface ChoroplethStyle {
  fillColor:   string
  fillOpacity: number
  color:       string
  weight:      number
}

/**
 * Fallback fill for a region with no datum (unjoined feature). Token-derived, so a
 * [data-tenant] override rebrands it with zero call-site edits. In SSR/jsdom the
 * computed value is empty → the neutral accent literal is used.
 */
export const accentFill = (): string => cssVar('--color-accent', '#0080BE')

/**
 * Build the choropleth fill map: geo-dim code → CSS color.
 *
 * Each region is shaded by its value's quantile rank against the sequential ramp,
 * so N regions span multiple ramp buckets instead of a single flat accent. Keyed
 * by String(row.id) — the geo dim value the feature ISO resolves to (geoCodeMap).
 */
export function choroplethColors(rows: DataRow[]): Map<string, string> {
  const colors = quantileColors(rows.map(r => r.value), sequentialRamp())
  const map = new Map<string, string>()
  rows.forEach((r, i) => map.set(String(r.id), colors[i] ?? accentFill()))
  return map
}

// ── Per-feature style — the ONE choropleth style function (SSOT) ──────────────
//
//  A choropleth encodes VALUE as fill COLOR (a sequential ramp), leaving opacity +
//  stroke weight free to signal SELECTION/hover — the two encodings stay orthogonal
//  (Mapbox / Vega convention). Fill opacity is high so the ramp reads. GeoMap
//  resolves EVERY region (base, hover, selection) through this SAME function, so
//  the paint stays byte-identical across states — no drift between code paths.

const FILL_DEFAULT    = 0.9
const FILL_SELECTED   = 1
const FILL_OCCUPIED   = 0.85
const WEIGHT_DEFAULT  = 1
const WEIGHT_SELECTED = 2.5

// A JS-fed SVG attribute takes a literal color string (`var(--token)` is invalid
// as a presentation-attribute value) — resolve the semantic token at call-time via
// cssVar(). A [data-tenant] override rebrands the stroke with zero call-site edits.
export const strokeColor = (): string => cssVar('--color-surface', '#fff')

/**
 * SELECTION + OCCUPIED are distinct FILL hues (token-derived, theme-flipping), kept
 * orthogonal to the choropleth value ramp: an OCCUPIED territory always reads red
 * (precedence over selection — it's a permanent status, not a transient pick), a
 * SELECTED region reads the distinct highlight hue so the pick is unmistakable, and
 * everything else keeps its value-ramp shade. A JS-fed fill needs a literal → cssVar().
 */
export function featureStyle(fill: string, selected: boolean, occupied: boolean): ChoroplethStyle {
  const fillColor = occupied
    ? cssVar('--color-geo-occupied', '#dc2626')
    : selected
      ? cssVar('--color-geo-selected', '#e8a33d')
      : fill
  return {
    fillColor,
    fillOpacity: occupied ? FILL_OCCUPIED : selected ? FILL_SELECTED : FILL_DEFAULT,
    color:       strokeColor(),
    weight:      selected ? WEIGHT_SELECTED : WEIGHT_DEFAULT,
  }
}

/**
 * Transient hover/focus accent — same distinct-highlight weight as selection, but
 * KEEPS the region's value-ramp fill (only opacity + stroke weight change), so the
 * caller merges these two attributes over the resolved base style.
 */
export const hoverStyle = (): Pick<ChoroplethStyle, 'fillOpacity' | 'color' | 'weight'> => ({
  fillOpacity: FILL_SELECTED,
  color:       strokeColor(),
  weight:      WEIGHT_SELECTED,
})

/** Context a single feature needs to resolve its style — no React, no map library. */
export interface FeatureStyleContext {
  isoField:     string
  geoCodeMap:   Record<string, string>
  colorFor:     (geoId: string) => string
  selectedGeos: string[]
  occupiedSet:  Set<string>
}

/**
 * Resolve one GeoJSON feature to its ChoroplethStyle. The single style resolver
 * GeoMap applies to every rendered <path>, so a selection change repaints through
 * exactly the same occupied→red / selected→amber / base-ramp logic used at first
 * paint — no state ever paints through a divergent path.
 */
export function resolveFeatureStyle(
  feature: GeoJSON.Feature | undefined,
  ctx:     FeatureStyleContext,
): ChoroplethStyle {
  const iso   = String(feature?.properties?.[ctx.isoField] ?? '')
  const geoId = ctx.geoCodeMap[iso]
  return featureStyle(ctx.colorFor(geoId), ctx.selectedGeos.includes(geoId), ctx.occupiedSet.has(iso))
}
