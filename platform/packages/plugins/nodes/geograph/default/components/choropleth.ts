// ── choropleth — pure value→fill scale for the geograph map ───────────────────
//
//  The ONE choropleth engine (FF-ONE-MAP-ENGINE): value→color is derived from
//  the token-driven sequential ramp (@statdash/styles), never a rival palette.
//  No React, no Leaflet — a pure module so the flat-map invariant is guarded in
//  a node test env and the layer-remount key is deterministically derivable.
//
//  Law 1: rows are agnostic DataRow records; id = the geo dim value.
//

import type { DataRow } from '@statdash/engine'
import type { PathOptions } from 'leaflet'
import { cssVar, sequentialRamp, quantileColors } from '@statdash/styles'

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

/**
 * Layer identity for react-leaflet's <GeoJSON>: it applies `style` only at MOUNT.
 * If rows arrive AFTER the geometry (async store), the fill mapping changes but a
 * key unchanged since mount never re-styles → the map reads flat (the C4-c defect).
 * Folding the fill mapping into the key re-mounts the layer whenever the colors
 * change, so late-arriving warm rows repaint the full ramp.
 *
 * SELECTION is deliberately NOT in the key: a highlight is a STYLE-only change,
 * driven imperatively via `layer.setStyle(...)` on the existing layer. Keying on
 * selection remounted the whole GeoJSON layer on every row-pick — and when that
 * pick happened while the map was `display:none` (table view active), Leaflet
 * re-projected every path against a 0×0 box → `LatLng(NaN, NaN)` (blank map, then
 * a hard crash once RepairOnShow's fitBounds hit the corrupted projection). The
 * key now tracks only the choropleth SCALE (structural), never the transient pick.
 */
export function choroplethLayerKey(colorByGeo: Map<string, string>): string {
  return [...colorByGeo].map(([id, color]) => `${id}:${color}`).join('|')
}

// ── Per-feature style — the ONE choropleth style function (SSOT) ──────────────
//
//  A choropleth encodes VALUE as fill COLOR (a sequential ramp), leaving opacity +
//  stroke weight free to signal SELECTION/hover — the two encodings stay orthogonal
//  (Mapbox / Vega convention). Fill opacity is high so the ramp reads. Both the
//  <GeoJSON> mount `style` prop AND the imperative `layer.setStyle(...)` selection
//  effect resolve through the SAME function here, so the mount paint and every
//  in-place restyle are byte-identical — no drift between the two code paths.

const FILL_DEFAULT    = 0.9
const FILL_SELECTED   = 1
const FILL_OCCUPIED   = 0.85
const WEIGHT_DEFAULT  = 1
const WEIGHT_SELECTED = 2.5

// Leaflet PathOptions take a literal color string (var() is invalid as a JS-fed
// fill value) — resolve the semantic token at call-time via cssVar(). A
// [data-tenant] override rebrands the stroke with zero call-site edits.
export const strokeColor = (): string => cssVar('--color-surface', '#fff')

/**
 * SELECTION + OCCUPIED are distinct FILL hues (token-derived, theme-flipping), kept
 * orthogonal to the choropleth value ramp: an OCCUPIED territory always reads red
 * (precedence over selection — it's a permanent status, not a transient pick), a
 * SELECTED region reads the distinct highlight hue so the pick is unmistakable, and
 * everything else keeps its value-ramp shade. Leaflet needs a literal color → cssVar().
 */
export function featureStyle(fill: string, selected: boolean, occupied: boolean): PathOptions {
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

/** Transient hover accent (mouseover) — same distinct-highlight weight as selection. */
export const hoverStyle = (): PathOptions => ({
  fillOpacity: FILL_SELECTED,
  color:       strokeColor(),
  weight:      WEIGHT_SELECTED,
})

/** Context a single feature needs to resolve its style — no React, no Leaflet map. */
export interface FeatureStyleContext {
  isoField:     string
  geoCodeMap:   Record<string, string>
  colorFor:     (geoId: string) => string
  selectedGeos: string[]
  occupiedSet:  Set<string>
}

/**
 * Resolve one GeoJSON feature to its PathOptions. This is the single style
 * resolver shared by the mount `style` prop and the imperative selection
 * `setStyle` effect, so a selection change repaints in place through exactly the
 * same occupied→red / selected→amber / base-ramp logic used at first paint.
 */
export function resolveFeatureStyle(
  feature: GeoJSON.Feature | undefined,
  ctx:     FeatureStyleContext,
): PathOptions {
  const iso   = String(feature?.properties?.[ctx.isoField] ?? '')
  const geoId = ctx.geoCodeMap[iso]
  return featureStyle(ctx.colorFor(geoId), ctx.selectedGeos.includes(geoId), ctx.occupiedSet.has(iso))
}
