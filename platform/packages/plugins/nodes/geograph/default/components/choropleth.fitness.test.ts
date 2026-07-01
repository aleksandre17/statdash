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
