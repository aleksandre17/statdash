// ── workbenchModel tests (W-P5b · ADR-046 §1/§3) ──────────────────────────────────
//
//  The ONE code path: BOTH a legacy `query` (via its desugared view) AND a native
//  `pipeline` lower to the SAME canonical {head, tail, encoding}; every write EMITS a
//  `pipeline` (the ⛔ emission flip). Non-shaped specs are declared null (honest).
//
import { describe, it, expect } from 'vitest'
import type { DataSpec } from '@statdash/engine'
import {
  fromWorkbenchModel, governedWhere, isGovernedHead, isHeadBound, isStewardHead,
  isWorkbenchShaped, promoteHeadToMetric, sourceGrainDims, sourceMeasure, stewardHeadMeasure,
  toWorkbenchModel, withGovernedMetric, withGovernedWhere, withStewardCube,
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

  it('returns null for a spec the workbench does not shape (row-list/timeseries/…)', () => {
    expect(toWorkbenchModel({ type: 'row-list', rows: [] })).toBeNull()
    expect(toWorkbenchModel({ type: 'timeseries', code: 'B1G', years: 'all' })).toBeNull()
    expect(toWorkbenchModel(undefined)).toBeNull()
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
