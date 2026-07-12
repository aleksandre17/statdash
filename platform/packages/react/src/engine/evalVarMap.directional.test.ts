// @vitest-environment node
//
// ── evalVarMap — the multi-var (op:'directional') SPREAD [AR-42 P2] ─────────
//
//  Proves the react-side integration of the directional LAW: ONE declared var
//  (`{op:'directional'}`) evaluated by evalVarMap SPREADS its six named outputs
//  into the result map, so the existing `{$ctx:_xDim}` … encoding/pipe consumers
//  resolve UNCHANGED. The container key is not emitted; ordinary exprs still
//  evaluate through evalExpr (byte-identical to the pre-AR-42 path).

import { describe, it, expect } from 'vitest'
import { evalVarMap }           from './evalVarMap'
import type { RenderContext }   from './types'

function ctx(filterParams: Record<string, string>): Parameters<typeof evalVarMap>[1] {
  return {
    filterParams,
    vars:         {},
    stores:       {},
    pageStoreKey: '',
  } as unknown as Pick<RenderContext, 'filterParams' | 'vars' | 'stores' | 'pageStoreKey'>
}

const DIRECTIONAL = {
  op: 'directional', focus: 'sector', co: 'geo',
  priority: ['sector', 'region'], emit: 'axis', grain: ['time'], unselected: ['', '_T'],
} as const

describe('evalVarMap — directional multi-var spread', () => {
  it('spreads the six axis outputs into the flat result (State C: sector-only)', () => {
    const out = evalVarMap({ _directional: DIRECTIONAL } as never, ctx({ sector: 'S1', region: '' }))
    expect(out._xDim).toBe('geoLabel')
    expect(out._seriesDim).toBe('sectorLabel')
    expect(out._mark).toBe('bar')
    expect(out._byDims).toBe('sector,geo,time')
    expect(out._sortBy).toBe('value')
    expect(out._sortDir).toBe('desc')
    // The container key is NOT emitted as a var.
    expect(out._directional).toBeUndefined()
  })

  it('State A (no selection) → donut, co on x, grain = co alone', () => {
    const out = evalVarMap({ _directional: DIRECTIONAL } as never, ctx({ sector: '', region: '' }))
    expect(out._mark).toBe('donut')
    expect(out._xDim).toBe('geoLabel')
    expect(out._seriesDim).toBe('')
    expect(out._byDims).toBe('geo')
  })

  it('ordinary exprs alongside a directional var still evaluate (mixed VarMap)', () => {
    const out = evalVarMap(
      { _plain: 'literal', _directional: DIRECTIONAL } as never,
      ctx({ sector: '', region: 'R2' }),
    )
    expect(out._plain).toBe('literal')       // evalExpr path intact
    expect(out._xDim).toBe('sectorLabel')    // State B spread
    expect(out._seriesDim).toBe('geoLabel')
  })
})
