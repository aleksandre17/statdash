// ── FF-PIVOT-FOLD (AR-36) — the regional composition pivot, end-to-end at the data layer ──
//
//  Proves the OWNER's target: ONE panel, fed by ONE long-format dataset (sector×geo GVA),
//  rotates between the two states purely by state-bound params — no second query, no row
//  transpose, no second panel:
//   • State A (no region) — roll-up `by:[geo]` + x=geoLabel + no series → ONE row per region
//     whose value == Σ of that region's leaf sectors (== the by-region DONUT of img_1).
//   • State B (region[s]) — `by:[sector,geo,time]` + x=sectorLabel + series=geoLabel → the
//     sector×geo cells (== the stacked BAR of img_5). Same source rows, only the encoding +
//     roll-up rotate.
//
//  This is the data-layer contract the folded `sectors` panel rides; the react binding layer
//  runs resolvePipeRefs (roll-up) then resolveEncodingRefs (channels) before these exact fns.

import { describe, it, expect } from 'vitest'
import { resolvePipeRefs, applyPipeline } from './transform'
import { resolveEncodingRefs, applyEncoding } from './encoding'
import type { TransformStep } from './transform'
import type { EncodingSpec, EngineRow } from './encoding'
import type { RefServices } from '../ref/ref'

// The ONE dataset the panel fetches once: region-leaves × sector-leaves × GVA, with both
// display labels present (as the panel's $d lookups would produce). Two regions, two sectors.
const ROWS: EngineRow[] = [
  { geo: 'R1', sector: 'S1', time: 2024, value: 60, geoLabel: 'Region 1', sectorLabel: 'Agriculture', color: '#a' },
  { geo: 'R1', sector: 'S2', time: 2024, value: 40, geoLabel: 'Region 1', sectorLabel: 'Industry',    color: '#a' },
  { geo: 'R2', sector: 'S1', time: 2024, value: 30, geoLabel: 'Region 2', sectorLabel: 'Agriculture', color: '#b' },
  { geo: 'R2', sector: 'S2', time: 2024, value: 20, geoLabel: 'Region 2', sectorLabel: 'Industry',    color: '#b' },
]

// The folded panel's pipe + encoding. The real config re-joins the display labels via `$d`
// lookups AFTER the aggregate (a store concern); here the `by` carries the label fields too
// as a STORE-FREE stand-in — labels are 1:1 with their codes, so the GRAIN (row count) is
// provably identical to aggregate-then-lookup, which is what this fitness pins.
const PIPE: TransformStep[] = [
  { op: 'aggregate', by: { $ctx: '_byDims' } as never, measure: 'value', agg: 'sum' },
]
const ENC: EncodingSpec = {
  color: 'color', id: 'geo',
  label:  { $ctx: '_xDim' } as never,
  series: { $ctx: '_seriesDim' } as never,
  value: 'value',
}

function render(vars: Record<string, unknown>) {
  const services: RefServices = { dims: {}, vars }
  const lowered = resolvePipeRefs(PIPE, services)
  const rows    = applyPipeline([...ROWS] as never, lowered as never) as unknown as EngineRow[]
  return applyEncoding(rows, resolveEncodingRefs(ENC, services))
}

describe('FF-PIVOT-FOLD — one dataset, state rotates the composition panel', () => {
  it('State A (no region): rolls up to ONE row per region == Σ leaf sectors (the by-region donut)', () => {
    const out = render({ _byDims: 'geo,geoLabel', _xDim: 'geoLabel', _seriesDim: '', _mark: 'donut' })
    expect(out).toHaveLength(2)                                   // one slice per region, NOT sector×geo
    expect(out.every((r) => r.series === undefined)).toBe(true)   // no series → donut degrades gracefully
    const byLabel = Object.fromEntries(out.map((r) => [r.label, r.value]))
    expect(byLabel['Region 1']).toBe(100)                         // 60 + 40 (Σ leaf sectors == region total)
    expect(byLabel['Region 2']).toBe(50)                          // 30 + 20
    expect(out.map((r) => r.id)).toEqual(['R1', 'R2'])            // region CODE on id → region-select works
  })

  it('State B (region[s]): keeps sector×geo cells, x=sector, series=region (the stacked bar)', () => {
    const out = render({ _byDims: 'sector,geo,time,sectorLabel,geoLabel', _xDim: 'sectorLabel', _seriesDim: 'geoLabel', _mark: 'bar' })
    expect(out).toHaveLength(4)                                   // 2 sectors × 2 regions
    expect(out.every((r) => r.series !== undefined)).toBe(true)   // series present → multi-series/stacked
    const cell = out.find((r) => r.label === 'Agriculture' && r.series === 'Region 1')
    expect(cell?.value).toBe(60)
    // x axis = sectors, series legend = regions (the OLAP transpose of State A, same source rows).
    expect(new Set(out.map((r) => r.label))).toEqual(new Set(['Agriculture', 'Industry']))
    expect(new Set(out.map((r) => r.series))).toEqual(new Set(['Region 1', 'Region 2']))
  })

  it('the national total is invariant across the pivot (Σ all cells == Σ region rollups)', () => {
    const a = render({ _byDims: 'geo,geoLabel', _xDim: 'geoLabel', _seriesDim: '' })
    const b = render({ _byDims: 'sector,geo,time,sectorLabel,geoLabel', _xDim: 'sectorLabel', _seriesDim: 'geoLabel' })
    const sum = (rs: { value: number }[]) => rs.reduce((s, r) => s + r.value, 0)
    expect(sum(a)).toBe(150)
    expect(sum(a)).toBe(sum(b))                                   // no double-count, no dropped rows
  })
})
