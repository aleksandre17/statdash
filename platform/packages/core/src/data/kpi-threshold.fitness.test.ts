// ── FF-KPI-THRESHOLD — conditional formatting is wired to the KPI value, HONESTLY ─
//
//  The ENGINE-level proof that `interpretKpi` connects a KPI's `thresholds` to its
//  RESOLVED value (Grafana thresholds) and obeys the two governing laws:
//    • Law 8 (additive) — a spec WITHOUT thresholds produces a KpiDef with no
//      valueToken/valueGlyph/valueStateLabel (byte-identical to pre-seam).
//    • Law 11 (honest)  — a no-data value renders its honest state and NO threshold
//      is applied (thresholds colour a real value only, never a fabricated 0).
//  The pure resolver's own invariants live in config/threshold.fitness; THIS proves
//  the wiring: value → numeric → resolveValueThreshold → KpiDef presentation fields.

import { describe, it, expect } from 'vitest'
import { interpretKpi }         from './kpi'
import type { KpiSpec }         from './kpi'
import type { DataStore, StoreQuery } from './store'
import { TIME_DIM }             from '../core/context'
import type { SectionContext }  from '../core/context'
import type { EngineRow }       from './encoding'
import type { ValueThreshold }  from '../config/threshold'

// A store whose measure 'X' reads NEGATIVE — the value that should trip the below-zero
// (base) step. A second code 'EMPTY' returns nothing → a no-data honest state.
const store: DataStore = {
  querySync(q: StoreQuery): EngineRow[] {
    if (q.type === 'val' && q.code === 'X') return [{ value: -3.2 } as unknown as EngineRow]
    return []
  },
  caps: { queryTypes: ['val'], batching: false, streaming: false, sync: true },
}

const ctx: SectionContext = { dims: { [TIME_DIM]: 2023 } }

// Two-sided: below-zero danger + down glyph (base), at/above-zero success + up glyph.
const THRESHOLDS: ValueThreshold = [
  { from: 0, token: 'status.positive-fg', glyph: 'up',   state: 'On track' },
  {          token: 'status.negative-fg', glyph: 'down', state: 'Below target' },
]

describe('FF-KPI-THRESHOLD — the value carries its matched-step presentation', () => {
  it('a NEGATIVE value takes the base (danger) step — token + down glyph + label', () => {
    const kpi: KpiSpec = {
      id: 'k', label: 'X', unit: '%', color: '#000',
      value: { type: 'point', measure: 'X', format: 'sign_pct' },
      thresholds: THRESHOLDS,
    }
    const out = interpretKpi(kpi, ctx, store)
    expect(out.value).toBe('-3.2%')                    // the real value is unchanged
    expect(out.state).toBeUndefined()                 // ok (a genuine value)
    expect(out.valueToken).toBe('status.negative-fg') // resolved token KEY (not CSS)
    expect(out.valueGlyph).toBe('down')
    expect(out.valueStateLabel).toBe('Below target')
  })

  it('ADDITIVE (Law 8) — a spec with NO thresholds carries no presentation fields', () => {
    const kpi: KpiSpec = {
      id: 'k', label: 'X', unit: '%', color: '#000',
      value: { type: 'point', measure: 'X', format: 'sign_pct' },
    }
    const out = interpretKpi(kpi, ctx, store)
    expect(out.value).toBe('-3.2%')
    expect(out.valueToken).toBeUndefined()
    expect(out.valueGlyph).toBeUndefined()
    expect(out.valueStateLabel).toBeUndefined()
  })

  it('HONEST (Law 11) — a NO-DATA value applies NO threshold (never colours a fake 0)', () => {
    const kpi: KpiSpec = {
      id: 'k', label: 'X', unit: '%', color: '#000',
      value: { type: 'point', measure: 'EMPTY', format: 'sign_pct' },
      thresholds: THRESHOLDS,
    }
    const out = interpretKpi(kpi, ctx, store)
    expect(out.state).toBe('no-data')                 // the honest state the card renders
    expect(out.valueToken).toBeUndefined()            // no threshold formatting applied
    expect(out.valueGlyph).toBeUndefined()
    expect(out.valueStateLabel).toBeUndefined()
  })
})
