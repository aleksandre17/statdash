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
 * Folding the fill mapping into the key re-mounts the layer whenever the colors OR
 * the selection change, so late-arriving warm rows repaint the full ramp.
 */
export function choroplethLayerKey(selectedGeos: string[], colorByGeo: Map<string, string>): string {
  const sig = [...colorByGeo].map(([id, color]) => `${id}:${color}`).join('|')
  return `${selectedGeos.join(',')}::${sig}`
}
