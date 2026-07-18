// ── FF-PIPELINE-EQUIV (rows) — ADR-046 · SPEC §1.3 · waves W-P4 / W-P5a ────────
//
//  The ROW-level companion to the apps/api requirements shadow: a `query`/`transform`
//  spec resolved through the `pipeline` spine is BYTE-IDENTICAL (same rows/order/values/
//  nulls/fields) to the UNTOUCHED legacy resolver for its discriminant. The `source` HEAD
//  lowers onto the SAME storeObs/resolveMeasureRef path the legacy resolver uses
//  (SPEC §1.1), and the pure tail is the SAME applyStep — so the pipeline is not a
//  re-implementation, it is the same reads composed through one spine.
//
//  W-P5a — the LIVE desugar switch. `interpretSpec(query)` now routes THROUGH the pipeline
//  (desugar → desugarToPipeline), so comparing it to `interpretSpec(desugarToPipeline(spec))`
//  would collapse to pipeline-vs-pipeline (trivially green). To keep this a TRUE two-path
//  proof, the oracle is the legacy resolver dispatched DIRECTLY from the registry
//  (`legacyDirect`) — QueryResolver/TransformResolver do NOT desugar, so they remain the
//  independent pre-spine path even after the live switch.
//
//  Also proves the GOVERNED (author-plane) source head — a directly-authored `pipeline`
//  with a `{op:'source', metrics}` head — resolves identically to the equivalent `metric`
//  DataSpec (the workbench Get → pick a metric path, which W-P4's live proof walks).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { interpretSpec }        from './spec'
import { desugarToPipeline }    from './desugar'
import { registerMetric }       from './metric'
import { ExternalStore }        from './store-impl'
import { defaultRegistry }      from '../registry/engine'
import '../registry/resolvers'  // side-effect: register the built-in resolvers
import type { EngineRow }       from './encoding'
import type { DataStore }       from './store'
import type { DataSpec }        from '../config/data-spec'
import type { Observation }     from '../sdmx'
import type { SectionContext }  from '../core/context'

// The UNTOUCHED legacy resolver for a spec's OWN discriminant, dispatched directly —
// bypassing desugar (which, post-W-P5a, lowers query/transform onto the pipeline spine).
// This is the independent oracle the pipeline path is compared against.
function legacyDirect(spec: DataSpec, c: SectionContext, s: DataStore): EngineRow[] {
  return defaultRegistry.spec(spec.type)!.resolve(spec, c, s)
}

const obs: Observation[] = [
  { measure: 'GDP', time: 2018, geo: 'GE', value: 80,  label: 'GE', color: '#111' },
  { measure: 'GDP', time: 2019, geo: 'GE', value: 90,  label: 'GE', color: '#111' },
  { measure: 'GDP', time: 2020, geo: 'GE', value: 100, label: 'GE', color: '#111' },
  { measure: 'GDP', time: 2020, geo: 'AM', value: 30,  label: 'AM', color: '#222' },
  { measure: 'POP', time: 2020, geo: 'GE', value: 4,   label: 'GE', color: '#333' },
]
const store = new ExternalStore(obs)
const ctx: SectionContext = { dims: { time: 2020, geo: 'GE' } }
const ctxRange: SectionContext = { dims: { geo: 'GE' } }   // time unset ⇒ range/unbounded read

const queryCorpus: { name: string; spec: DataSpec; ctx: SectionContext }[] = [
  { name: 'raw code, year mode',
    spec: { type: 'query', query: { measure: 'GDP' }, encoding: { label: 'time', value: 'value' } }, ctx },
  { name: 'raw code, range mode (unbounded read)',
    spec: { type: 'query', query: { measure: 'GDP' }, encoding: { label: 'time', value: 'value' } }, ctx: ctxRange },
  { name: 'with a sort pipe tail',
    spec: { type: 'query', query: { measure: 'GDP' }, pipe: [{ op: 'sort', by: 'value', dir: 'desc' }],
            encoding: { label: 'time', value: 'value' } }, ctx: ctxRange },
  { name: 'with a filter + derive tail',
    spec: { type: 'query', query: { measure: 'GDP' },
            pipe: [{ op: 'filter', where: { geo: 'GE' } }, { op: 'derive', as: 'doubled', expr: 'value * 2' }],
            encoding: { label: 'time', value: 'value' } }, ctx: ctxRange },
  { name: 'fromDim/toDim clamp (post-fetch)',
    spec: { type: 'query', query: { measure: 'GDP' }, fromDim: 'lo', toDim: 'hi',
            encoding: { label: 'time', value: 'value' } }, ctx: { dims: { lo: 2019, hi: 2020 } } },
]

describe('FF-PIPELINE-EQUIV (rows) — query resolves identically through the pipeline spine', () => {
  for (const { name, spec, ctx: c } of queryCorpus) {
    it(name, () => {
      // legacy = the QueryResolver dispatched directly (no desugar); pipeline = the spine.
      const legacy   = legacyDirect(spec, c, store)
      const pipeline = interpretSpec(desugarToPipeline(spec), c, store)
      expect(pipeline).toEqual(legacy)
    })
  }

  it('the LIVE path (interpretSpec) now equals the legacy resolver — W-P5a switch', () => {
    // Proves the live desugar switch itself: interpretSpec(query) routes through the
    // pipeline and lands byte-identical to the untouched QueryResolver.
    for (const { spec, ctx: c } of queryCorpus) {
      expect(interpretSpec(spec, c, store)).toEqual(legacyDirect(spec, c, store))
    }
  })
})

describe('FF-PIPELINE-EQUIV (rows) — transform resolves identically through the pipeline spine', () => {
  const t: DataSpec = {
    type: 'transform',
    source: [{ geo: 'GE', value: 3 }, { geo: 'AM', value: 1 }, { geo: 'AZ', value: 2 }],
    steps: [{ op: 'sort', by: 'value', dir: 'asc' }, { op: 'addField', name: 'kind', value: 'x' }],
    encoding: { label: 'geo', value: 'value' },
  }
  it('inline rows + steps', () => {
    expect(interpretSpec(desugarToPipeline(t), ctx, store)).toEqual(legacyDirect(t, ctx, store))
  })
  it('the LIVE path (interpretSpec) equals the untouched TransformResolver — W-P5a switch', () => {
    expect(interpretSpec(t, ctx, store)).toEqual(legacyDirect(t, ctx, store))
  })
})

describe('FF-PIPELINE-EQUIV (rows) — a governed source head ≡ the metric spec', () => {
  it('directly-authored pipeline{source(metrics)} equals the metric DataSpec (the workbench Get path)', () => {
    const metricSpec: DataSpec = { type: 'metric', metrics: ['GDP'], by: ['geo'] }
    const pipelineSpec: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', metrics: ['GDP'], by: ['geo'] }],
      encoding: { label: 'geo', value: 'value' },
    }
    expect(interpretSpec(pipelineSpec, ctx, store)).toEqual(interpretSpec(metricSpec, ctx, store))
  })

  it('a governed source head + a pure tail composes (source → sort)', () => {
    const pipelineSpec: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', metrics: ['GDP'], by: ['geo'] }, { op: 'sort', by: 'value', dir: 'desc' }],
      encoding: { label: 'geo', value: 'value' },
    }
    const rows = interpretSpec(pipelineSpec, ctx, store)
    expect(rows.length).toBeGreaterThan(0)
    // sorted by value desc — first row's value ≥ last row's value
    expect(Number(rows[0]!['value'])).toBeGreaterThanOrEqual(Number(rows[rows.length - 1]!['value']))
  })
})

// ── FF-PIPELINE-EQUIV (rows) — the GRAIN-∅ governed BROWSE [ADR-046 Addendum 2] ────────
//
//  A governed head with NO grain lowers to the metric's OBSERVATION BROWSE ("a source IS
//  the table" — Power Query), NOT the grain-∅ scalar. A BASE metric browses as its full obs
//  read — byte-identical to the STEWARD obs read (the crack W-P5b diagnosed: a grain-less
//  governed head resolved to a 1-row scalar `0`, never the rich observation grid). A CALC
//  metric browses PER MEMBER of its time axis via resolveMetricValue — a year-by-year value
//  column with an HONEST null at the first-period edge (ADR-045), never a fabricated 0.

// growth-YoY expr: (cur / prev − 1) × 100 — REUSES @statdash/expr, no second dialect.
const YOY_EXPR = {
  op: 'mul',
  left:  { op: 'sub', left: { op: 'div', left: { $derived: 'cur' }, right: { $derived: 'prev' } }, right: 1 },
  right: 100,
} as const

registerMetric('pipe:gdp-base', { label: { en: 'GDP' }, code: 'GDP' })
registerMetric('pipe:gdp-yoy', {
  label: { en: 'GDP growth YoY' },
  additivity: 'non-additive',
  calc: {
    inputs: {
      cur:  { measure: 'GDP' },
      prev: { measure: 'GDP', at: { time: { $prev: 1 } } },
    },
    expr: YOY_EXPR,
  },
})

describe('FF-PIPELINE-EQUIV (rows) — the grain-∅ governed BROWSE (Addendum 2)', () => {
  it('a BASE metric browse ≡ the steward obs read (row set — governed labels aside)', () => {
    const browse: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['pipe:gdp-base'] }],
      encoding: { label: 'id' },
    }
    // The steward obs read of the SAME underlying code — the storeObs path a `query` head uses.
    const steward: DataSpec = { type: 'query', query: { measure: 'GDP' }, encoding: { label: 'id' } }
    const browseRows  = interpretSpec(browse, ctxRange, store)
    const stewardRows = interpretSpec(steward, ctxRange, store)
    // The rich observation grid, NOT a 1-row scalar — the crack is closed.
    expect(browseRows.length).toBe(4)               // all GDP obs (2018/2019/2020 GE + 2020 AM)
    expect(browseRows).toEqual(stewardRows)          // browse IS the steward obs read
  })

  it('a governed browse is NOT the grain-∅ scalar (the W-P5b crack)', () => {
    // With grain the head is the shaped scalar (1 row per metric); WITHOUT grain it browses.
    const scalar: DataSpec = { type: 'metric', metrics: ['pipe:gdp-base'] }   // grain-∅ scalar
    const scalarRows = interpretSpec(scalar, ctxRange, store)
    expect(scalarRows.length).toBe(1)                // the OLD (wrong-for-browse) 1-row shape
    const browse: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['pipe:gdp-base'] }], encoding: { label: 'id' },
    }
    expect(interpretSpec(browse, ctxRange, store).length).toBeGreaterThan(1)   // browse ≠ scalar
  })

  it('a CALC metric browse = per-year values with an honest null at the first period', () => {
    const browse: DataSpec = {
      type: 'pipeline', pipe: [{ op: 'source', metrics: ['pipe:gdp-yoy'] }],
      encoding: { label: 'id' },
    }
    const rows = interpretSpec(browse, ctxRange, store)
    // GDP@GE = {2018:80, 2019:90, 2020:100}; YoY over the ordered members.
    expect(rows.map((r) => r['id'])).toEqual(['2018', '2019', '2020'])
    expect(rows[0]!['value']).toBeNull()                          // first period — honest no-data (ADR-045)
    expect(Number(rows[1]!['value'])).toBeCloseTo(12.5)           // (90/80 − 1)×100
    expect(Number(rows[2]!['value'])).toBeCloseTo(11.111, 2)      // (100/90 − 1)×100
    // NEVER a fabricated 0 at the edge (Law 11 / FF-CANVAS-NEVER-LIES).
    expect(rows[0]!['value']).not.toBe(0)
  })

  it('a browse + a pure tail composes (source browse → filter)', () => {
    const browse: DataSpec = {
      type: 'pipeline',
      pipe: [{ op: 'source', metrics: ['pipe:gdp-base'] }, { op: 'filter', where: { geo: 'GE' } }],
      encoding: { label: 'id' },
    }
    const rows = interpretSpec(browse, ctxRange, store)
    expect(rows.length).toBe(3)                       // the GE rows only (AM filtered out)
    expect(rows.every((r) => r['geo'] === 'GE')).toBe(true)
  })
})
