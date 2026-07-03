// @vitest-environment node
//
// ── choropleth.fitness — FLAT-MAP regression guard ────────────────────────────
//
//  The Regional-Accounts geograph is a GDP choropleth: regions MUST shade by
//  value. A prior defect painted every region the same accent (no value→color
//  scale reached the fills), so the map read flat despite a ~150× value spread.
//  This pins the invariant at the data level — the scale that GeoMap feeds into
//  Leaflet PathOptions.fillColor must yield DISTINCT fills across the real spread
//  (Tbilisi darkest, Racha lightest), so a flat map can no longer regress green.
//
//  node env → cssVar returns the un-themed fallback → the ramp is deterministic.

import { describe, it, expect } from 'vitest'
import { sequentialRamp, quantileColors } from '@statdash/styles'
import type { DataRow } from '@statdash/engine'
import {
  choroplethColors,
  choroplethLayerKey,
  featureStyle,
  resolveFeatureStyle,
  type FeatureStyleContext,
} from './choropleth'

// Real Regional-Accounts GDP-by-region spread (GEL mn, 2023), Tbilisi-dominant.
const REGION_VALUES = [
  42620.8, // თბილისი   (max)
  5686.3,  // აჭარის ა.რ.
  5347.1,  // იმერეთი
  5072.4,  // ქვემო ქართლი
  4403.2,  // სამეგრელო-ზემო სვანეთი
  4068.9,  // კახეთი
  3278.5,  // შიდა ქართლი
  2535.7,  // სამცხე-ჯავახეთი
  2196.1,  // მცხეთა-მთიანეთი
  1094.8,  // გურია
  278.8,   // რაჭა-ლეჩხუმი (min)
]

describe('geograph choropleth — value→color scale', () => {
  it('produces a non-degenerate sequential ramp from the theme accent', () => {
    const ramp = sequentialRamp(5)
    expect(ramp).toHaveLength(5)
    expect(new Set(ramp).size).toBe(5)   // 5 distinct stops, light → dark
  })

  it('shades regions by value — distinct fills across the spread (flat-map guard)', () => {
    const ramp   = sequentialRamp(5)
    const colors = quantileColors(REGION_VALUES, ramp)
    const maxIdx = REGION_VALUES.indexOf(Math.max(...REGION_VALUES))
    const minIdx = REGION_VALUES.indexOf(Math.min(...REGION_VALUES))

    // Dominant region → darkest stop; smallest → lightest.
    expect(colors[maxIdx]).toBe(ramp[ramp.length - 1])
    expect(colors[minIdx]).toBe(ramp[0])
    expect(colors[maxIdx]).not.toBe(colors[minIdx])

    // A flat map (one fill for all regions) is impossible: several buckets used.
    expect(new Set(colors).size).toBeGreaterThanOrEqual(3)
  })

  it('never collapses to a single fill even for a skewed distribution', () => {
    const colors = quantileColors(REGION_VALUES, sequentialRamp(5))
    expect(new Set(colors).size).toBeGreaterThan(1)
  })
})

// ── Selection is NOT a remount trigger (the NaN-crash root fix) ────────────────
//
//  The live crash: selecting a region while the map was `display:none` (table view)
//  remounted the <GeoJSON> layer against a 0×0 box → LatLng(NaN, NaN). The layer key
//  MUST therefore be a pure function of the choropleth SCALE only — never of the
//  selection — so a row-pick can never remount the layer. Selection is repainted in
//  place via layer.setStyle (proven by resolveFeatureStyle below).

const WARM_ROWS: DataRow[] = ([
  ['GE-TB', 42620.8], ['GE-AJ', 5686.3], ['GE-IM', 5347.1], ['GE-RL', 278.8],
] as const).map(([id, value]) => ({ id, value } as unknown as DataRow))

describe('choroplethLayerKey — selection never changes the layer identity', () => {
  it('is a pure function of the colour scale — same scale, same key', () => {
    const colors = choroplethColors(WARM_ROWS)
    // Two DIFFERENT selections over the SAME warm rows: the key is identical, so
    // react-leaflet never remounts (and never re-projects) on a selection change.
    // (Selection is not even a parameter — it structurally cannot influence the key.)
    expect(choroplethLayerKey(colors)).toBe(choroplethLayerKey(colors))
  })

  it('still changes when the colour scale changes (warm-row repaint preserved)', () => {
    expect(choroplethLayerKey(choroplethColors(WARM_ROWS)))
      .not.toBe(choroplethLayerKey(choroplethColors([])))
  })
})

// ── Choropleth colours preserved BYTE-FOR-BYTE through the setStyle path ───────
//
//  The selection highlight now flows through resolveFeatureStyle (the SSOT shared
//  by the mount `style` prop AND the imperative setStyle effect). This pins that the
//  occupied→red / selected→amber / base-ramp encoding is unchanged, so moving
//  selection off the remount path did not alter a single fill. node env → cssVar
//  returns the documented literal fallbacks (occupied #dc2626, selected #e8a33d).

const RAMP_FILL = '#123456' // a stand-in value-ramp fill for an unselected region
const ctx = (selectedGeos: string[], occupiedIso: string[]): FeatureStyleContext => ({
  isoField:    'iso',
  geoCodeMap:  { 'GE-TB': 'tb', 'GE-AB': 'ab' },
  colorFor:    () => RAMP_FILL,
  selectedGeos,
  occupiedSet: new Set(occupiedIso),
})
const feature = (iso: string): GeoJSON.Feature =>
  ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { iso } })

describe('featureStyle / resolveFeatureStyle — occupied/selected/base preserved', () => {
  it('OCCUPIED reads semantic red (precedence over selection)', () => {
    const s = featureStyle(RAMP_FILL, /*selected*/ true, /*occupied*/ true)
    expect(s.fillColor).toBe('#dc2626')
    expect(s.fillOpacity).toBe(0.85)
  })

  it('SELECTED (not occupied) reads the distinct amber highlight, heavier stroke', () => {
    const s = featureStyle(RAMP_FILL, true, false)
    expect(s.fillColor).toBe('#e8a33d')
    expect(s.fillOpacity).toBe(1)
    expect(s.weight).toBe(2.5)
  })

  it('UNSELECTED base keeps its value-ramp fill and default weight', () => {
    const s = featureStyle(RAMP_FILL, false, false)
    expect(s.fillColor).toBe(RAMP_FILL)
    expect(s.fillOpacity).toBe(0.9)
    expect(s.weight).toBe(1)
  })

  it('resolveFeatureStyle joins feature→geo→style: occupied ISO → red', () => {
    // 'GE-AB' is occupied (by feature ISO, pre geoCodeMap) and has no geoId row.
    expect(resolveFeatureStyle(feature('GE-AB'), ctx([], ['GE-AB'])).fillColor).toBe('#dc2626')
  })

  it('resolveFeatureStyle: selected geo → amber', () => {
    // feature ISO 'GE-TB' → geoId 'tb'; selecting 'tb' paints amber.
    expect(resolveFeatureStyle(feature('GE-TB'), ctx(['tb'], [])).fillColor).toBe('#e8a33d')
  })

  it('resolveFeatureStyle: unselected, unoccupied geo → its ramp fill', () => {
    expect(resolveFeatureStyle(feature('GE-TB'), ctx([], [])).fillColor).toBe(RAMP_FILL)
  })
})
