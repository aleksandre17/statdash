// ── workbenchModel tests (W-P5b · ADR-046 §1/§3) ──────────────────────────────────
//
//  The ONE code path: BOTH a legacy `query` (via its desugared view) AND a native
//  `pipeline` lower to the SAME canonical {head, tail, encoding}; every write EMITS a
//  `pipeline` (the ⛔ emission flip). Non-shaped specs are declared null (honest).
//
import { describe, it, expect } from 'vitest'
import type { DataSpec } from '@statdash/engine'
import { desugarToPipeline } from '@statdash/engine'
import {
  fromWorkbenchModel, governedWhere, isGovernedHead, isHeadBound, isStewardHead,
  isValueCellHead, isWorkbenchShaped, promoteHeadToMetric, sourceGrainDims, sourceMeasure,
  stewardHeadMeasure, toWorkbenchModel, valueCellSummary, withGovernedMetric, withGovernedWhere,
  withStewardCube,
} from './workbenchModel'
import type { WorkbenchModel } from './workbenchModel'

describe('toWorkbenchModel — the ONE canonical view over BOTH inputs', () => {
  it('lowers a legacy query to a STEWARD source head + the pure tail (desugared view)', () => {
    const query: DataSpec = {
      type: 'query', query: { measure: 'B1G', filter: { geo: 'GE' } },
      pipe: [{ op: 'sort', by: 'value', dir: 'asc' } as never], encoding: { label: 'label' },
    }
    const m = toWorkbenchModel(query)!
    expect(m.head.op).toBe('source')
    expect('query' in m.head).toBe(true)
    expect(m.tail.map((s) => s.op)).toEqual(['sort'])
  })

  it('takes a native pipeline as-is (head + tail split)', () => {
    const pipeline: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', metrics: ['B1G'] }, { op: 'filter', where: { geo: 'GE' } } as never],
      encoding: { label: 'label' },
    }
    const m = toWorkbenchModel(pipeline)!
    expect('metrics' in m.head).toBe(true)
    expect(m.tail.map((s) => s.op)).toEqual(['filter'])
  })

  it('returns null for undefined and for a spec the workbench does not shape', () => {
    expect(toWorkbenchModel(undefined)).toBeNull()
  })
})

// ── ADR-051 DU4 — the fold gate is NARROWED back to what the panes can AUTHOR ──────────
//
//  Trust-recovery correction: Step A widened the gate to "any kind `desugarToPipeline` folds"
//  — which silently diverted `timeseries` / single-code `growth` / `pivot` / `transform` into
//  the three panes with a READ-ONLY/LOSSY head, bypassing their intact dedicated editors. The
//  gate now admits ONLY `pipeline` + `query` (`isWorkbenchShaped`) — the kinds the panes can
//  GENUINELY author with a fully editable head. Every other kind returns `null` → the DU3
//  fallback lane, where its dedicated editor gives FULL editing (code/years, pivot fields,
//  inline rows + encoding, single↔multi toggle). Re-admitting them WITH full head-authoring is
//  a separate future wave.
describe('DU4 narrowed fold gate — only pipeline+query open the three panes', () => {
  it('a folded-but-not-pane-authorable kind returns null → the dedicated fallback editor', () => {
    // timeseries / single-code growth / pivot / transform ALL desugar to a pipeline, but the
    // panes cannot author their head editably — so they route to the fallback lane, NOT the panes.
    expect(toWorkbenchModel({ type: 'timeseries', code: 'B1G', years: 'all' })).toBeNull()
    expect(toWorkbenchModel({ type: 'growth', code: 'B1G', years: 'all' })).toBeNull()          // single-code
    expect(toWorkbenchModel({ type: 'pivot', rows: [], keyField: 'k', valueFields: [] })).toBeNull()
    expect(toWorkbenchModel({ type: 'transform', source: [], steps: [], encoding: { label: 'l' } })).toBeNull()
  })

  it('the kinds that never folded STILL route to the fallback lane (null)', () => {
    expect(toWorkbenchModel({ type: 'growth', code: ['B1G', 'B1GQ'], years: 'all' })).toBeNull()  // multi-code
    expect(toWorkbenchModel({ type: 'ratio-list', pairs: [{ code: 'A', denom: 'B' }] } as never)).toBeNull()
    expect(toWorkbenchModel({ type: 'row-list', rows: [] })).toBeNull()
    expect(toWorkbenchModel({ type: 'metric', metrics: ['B1G'] } as never)).toBeNull()
  })

  it('the gate does not lean on desugar folding a non-pane kind — the narrowing is honest', () => {
    // Even though the ENGINE still folds timeseries to a pipeline (desugarToPipeline is
    // unchanged — a capability, not an activation), the PANEL gate refuses it. The panel
    // decision is the isWorkbenchShaped kind-check, not the engine's fold ability.
    const ts: DataSpec = { type: 'timeseries', code: 'B1G', years: 'all' }
    expect(desugarToPipeline(ts).type).toBe('pipeline')   // engine still CAN fold it …
    expect(toWorkbenchModel(ts)).toBeNull()               // … but the panes decline it (DU4)
  })

  it('a pipeline/query edit still round-trips through fromWorkbenchModel (the panes emit a pipeline)', () => {
    const query: DataSpec = { type: 'query', query: { measure: 'B1G' }, pipe: [], encoding: { label: 'label' } }
    const model = toWorkbenchModel(query)!
    const withStep = fromWorkbenchModel({ ...model, tail: [...model.tail, { op: 'sort', by: 'value', dir: 'asc' } as never] })
    expect(withStep.type).toBe('pipeline')
    expect(withStep.pipe.at(-1)!.op).toBe('sort')
  })
})

describe('governed head grain «წაკითხვის არე» — the `where` pin surface (card 0087 §3.2)', () => {
  const governed: WorkbenchModel = {
    head: { op: 'source', metrics: ['B1G'] },
    tail: [], encoding: { label: 'label' },
  }
  const steward: WorkbenchModel = {
    head: { op: 'source', query: { measure: 'B1G' } },
    tail: [], encoding: { label: 'label' },
  }

  it('isGovernedHead distinguishes the metric head from the steward query head', () => {
    expect(isGovernedHead(governed.head)).toBe(true)
    expect(isGovernedHead(steward.head)).toBe(false)
  })

  it('governedWhere reads the pins (empty by default — browse is the default grain)', () => {
    expect(governedWhere(governed.head)).toEqual({})
    expect(governedWhere({ op: 'source', metrics: ['B1G'], where: { year: 2020 } })).toEqual({ year: 2020 })
  })

  it('withGovernedWhere pins a coordinate on the governed head', () => {
    const next = withGovernedWhere(governed, { year: 2020 })
    expect(isGovernedHead(next.head) && next.head.where).toEqual({ year: 2020 })
    // the write survives the emission flip as a `pipeline` source head
    expect(fromWorkbenchModel(next).pipe[0]).toMatchObject({ op: 'source', metrics: ['B1G'], where: { year: 2020 } })
  })

  it('an empty grain DROPS the `where` key entirely (grain-∅ browse, never a lingering {})', () => {
    const pinned = withGovernedWhere(governed, { year: 2020 })
    const cleared = withGovernedWhere(pinned, {})
    expect(isGovernedHead(cleared.head) && 'where' in cleared.head).toBe(false)
  })

  it('withGovernedWhere is a no-op on a steward head (grain lives on `query`, not `where`)', () => {
    expect(withGovernedWhere(steward, { year: 2020 })).toBe(steward)
  })
})

describe('fromWorkbenchModel — every write EMITS a pipeline (the ⛔ flip)', () => {
  it('serializes back to a `pipeline` DataSpec: [head, ...tail]', () => {
    const spec = fromWorkbenchModel({
      head: { op: 'source', metrics: ['B1G'] },
      tail: [{ op: 'sort', by: 'value', dir: 'asc' } as never],
      encoding: { label: 'label' },
    })
    expect(spec.type).toBe('pipeline')
    expect(spec.pipe.map((s) => s.op)).toEqual(['source', 'sort'])
  })

  it('round-trips a legacy query into a pipeline (query→spine on active edit)', () => {
    const query: DataSpec = { type: 'query', query: { measure: 'B1G' }, pipe: [], encoding: { label: 'label' } }
    const emitted = fromWorkbenchModel(toWorkbenchModel(query)!)
    expect(emitted.type).toBe('pipeline')
  })
})

describe('head helpers', () => {
  it('sourceMeasure reads governed metrics OR a steward query measure', () => {
    expect(sourceMeasure({ op: 'source', metrics: ['B1G'] })).toEqual(['B1G'])
    expect(sourceMeasure({ op: 'source', query: { measure: 'B1G' } })).toBe('B1G')
  })

  it('sourceGrainDims reads governed where OR a steward query filter (keys only)', () => {
    expect(sourceGrainDims({ op: 'source', metrics: ['B1G'], where: { geo: 'GE' } })).toEqual(['geo'])
    expect(sourceGrainDims({ op: 'source', query: { measure: 'B1G', filter: { geo: 'GE' } } })).toEqual(['geo'])
  })

  it('isHeadBound is false for an empty governed head, true once a metric is set', () => {
    expect(isHeadBound({ op: 'source', metrics: [] })).toBe(false)
    expect(isHeadBound({ op: 'source', metrics: ['B1G'] })).toBe(true)
    expect(isHeadBound({ op: 'source', rows: [] })).toBe(true)
  })

  it('a value-cell head reads its `code` as the measure, its `over`+`at` as grain dims, and is BOUND', () => {
    const vc = { op: 'source' as const, over: 'time', code: 'B1G', coords: [2020, 2021] as const, at: { geo: 'GE' } }
    expect(sourceMeasure(vc)).toBe('B1G')                          // honest governed value column (Law 4)
    expect(sourceGrainDims(vc)).toEqual(['time', 'geo'])           // enumerated axis + pinned coords (keys only)
    expect(isHeadBound(vc)).toBe(true)                             // reads a real code → not the "pick a metric" hint
    expect(isValueCellHead(vc)).toBe(true)
    expect(valueCellSummary(vc)).toEqual({ over: 'time', coords: [2020, 2021] })
    expect(valueCellSummary({ op: 'source', metrics: ['B1G'] })).toBeUndefined()
  })

  it('withGovernedMetric appends to a governed head (deduped) / converts other heads', () => {
    const gov = withGovernedMetric({ head: { op: 'source', metrics: ['B1G'] }, tail: [], encoding: { label: 'l' } }, 'B1GQ')
    expect(gov.head).toHaveProperty('metrics', ['B1G', 'B1GQ'])
    const conv = withGovernedMetric({ head: { op: 'source', query: { measure: 'X' } }, tail: [], encoding: { label: 'l' } }, 'B1G')
    expect(conv.head).toHaveProperty('metrics', ['B1G'])
  })

  it('isWorkbenchShaped narrows to query | pipeline', () => {
    expect(isWorkbenchShaped({ type: 'query', query: { measure: 'B1G' }, pipe: [], encoding: { label: 'l' } })).toBe(true)
    expect(isWorkbenchShaped({ type: 'row-list', rows: [] })).toBe(false)
  })
})

describe('the steward raw-cube head + the promotion loop (0084)', () => {
  it('isStewardHead / stewardHeadMeasure read only the ObsQuery variant', () => {
    expect(isStewardHead({ op: 'source', query: { measure: 'GVA' } })).toBe(true)
    expect(isStewardHead({ op: 'source', metrics: ['GVA'] })).toBe(false)
    expect(stewardHeadMeasure({ op: 'source', query: { measure: 'GVA' } })).toBe('GVA')
    expect(stewardHeadMeasure({ op: 'source', metrics: ['GVA'] })).toBeUndefined()
  })

  it('withStewardCube swaps to a steward source(query) head + CLEARS the tail (fresh browse)', () => {
    const m = { head: { op: 'source' as const, metrics: ['old'] }, tail: [{ op: 'sort', by: 'value', dir: 'asc' } as never], encoding: { label: 'l' } }
    const next = withStewardCube(m, ['GVA', 'POP'])
    expect(isStewardHead(next.head)).toBe(true)
    expect(stewardHeadMeasure(next.head)).toEqual(['GVA', 'POP'])
    expect(next.tail).toEqual([])                       // a new raw cube is a new table
  })

  it('withStewardCube collapses a single measure to a scalar (ObsQuery.measure)', () => {
    const next = withStewardCube({ head: { op: 'source', metrics: [] }, tail: [], encoding: { label: 'l' } }, ['GVA'])
    expect(stewardHeadMeasure(next.head)).toBe('GVA')
  })

  it('promoteHeadToMetric REPLACES the head with the governed ref, preserving the tail', () => {
    const m = { head: { op: 'source' as const, query: { measure: 'GVA' } }, tail: [{ op: 'filter', where: { geo: 'adjara' } } as never], encoding: { label: 'l' } }
    const next = promoteHeadToMetric(m, 'regional_gva')
    expect(next.head).toHaveProperty('metrics', ['regional_gva'])
    expect(isStewardHead(next.head)).toBe(false)
    expect(next.tail).toEqual(m.tail)                    // Floor-3 shaping untouched
  })
})
