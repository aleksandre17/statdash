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
