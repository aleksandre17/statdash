// @vitest-environment node
//
// ── B1 fitness — the cross-store `blend` desugar (react binding layer) ──
//
//  Locks the gap-crossing half of adr_data_blending_decision (B1): the react
//  binding layer is the ONLY layer that holds the store manifest (ctx.stores,
//  Law 3), so the second-store fetch + the blend → joinByField desugar live in
//  resolveBlends here. Core stays single-store (its engine-side invariants are
//  netted in packages/core/.../transform/blend.fitness.test.ts).
//
//    FF-BLEND-ROUTES-SECOND-STORE — a node whose blend.from.storeKey names a
//        DIFFERENT store than its primary resolves rows from BOTH stores; the
//        merged output carries fields from both, joined on `by`. Proves the
//        binding-layer glue actually reaches the second store.
//    FF-BLEND-DESUGARS-TO-JOIN — a blend step lowers to a joinByField that is
//        row-identical to a hand-built join with the same secondary rows + by +
//        mode. Proves the declarative façade IS the existing engine.
//    FF-BLEND-KEY-GENERIC (react half) — a blend joins on `geo` as readily as
//        `time`; the desugar never hardcodes a privileged dim (Law 1).
//
import { describe, it, expect } from 'vitest'
import { resolveBlends, resolveStoreByKey, _storeCache } from './resolveNodeRows'
import { staticStore, applyPipeline } from '@statdash/engine'
import type { DataStore, EngineRow, StoreQuery, TransformStep, RawRow } from '@statdash/engine'
import type { RenderContext } from './types'

// ── A canned-obs store — returns rows by measure for { type:'obs' } queries ─
//  Spreads staticStore so it is a valid DataStore but is NOT the staticStore
//  singleton ⇒ resolveStoreByKey wraps it in a CachedStore (the real path).
function obsStore(byMeasure: Record<string, EngineRow[]>): DataStore {
  return {
    ...staticStore,
    querySync(q: StoreQuery): EngineRow[] {
      if (q.type === 'obs') {
        const m = Array.isArray(q.measure) ? q.measure[0] : q.measure
        return byMeasure[m] ?? []
      }
      return []
    },
  }
}

const sectionCtx = { timeMode: 'range', dims: {} } as RenderContext['sectionCtx']

// Primary store: GDP totals by year. Secondary store: regional GVA by year.
const gdpStore = obsStore({
  B1G: [
    { time: 2022, value: 100 },
    { time: 2023, value: 110 },
  ],
})
const regionalStore = obsStore({
  GVA: [
    { time: 2022, value: 40 },
    { time: 2023, value: 45 },
  ],
})

function ctxWith(stores: Record<string, DataStore>): RenderContext {
  return { stores, sectionCtx } as unknown as RenderContext
}

// A blend pulling regional GVA from the `regional` store, joined on `time`.
const blendStep: TransformStep = {
  op:   'blend',
  from: { storeKey: 'regional', query: { measure: 'GVA' } },
  by:   'time',
  mode: 'left',
  rename: { value: 'gva' },
}

describe('resolveStoreByKey — explicit-key (non-cascade) store resolution', () => {
  it('resolves the named secondary store, wrapped via the shared _storeCache', () => {
    const ctx = ctxWith({ gdp: gdpStore, regional: regionalStore })
    const result = resolveStoreByKey(ctx, 'regional')
    expect(_storeCache.get(regionalStore)).toBe(result)
  })

  it('falls back to staticStore for a missing key (a misconfigured blend is safe)', () => {
    const ctx = ctxWith({ gdp: gdpStore })
    expect(resolveStoreByKey(ctx, 'nonexistent')).toBe(staticStore)
  })
})

describe('FF-BLEND-ROUTES-SECOND-STORE — a blend reaches a DIFFERENT store', () => {
  it('merged rows carry fields from BOTH the primary and the secondary store', () => {
    const ctx = ctxWith({ gdp: gdpStore, regional: regionalStore })

    // Primary rows (as the node would resolve from the page/default store).
    const primary: RawRow[] = [
      { time: 2022, value: 100 },
      { time: 2023, value: 110 },
    ]
    const lowered = resolveBlends([blendStep], ctx)
    const merged  = applyPipeline(primary, lowered)

    // Each row carries primary `value` AND the secondary `gva` (renamed), joined on time.
    expect(merged).toEqual([
      { time: 2022, value: 100, gva: 40 },
      { time: 2023, value: 110, gva: 45 },
    ])
  })

  it('a blend over a store that is ALSO the primary still routes by explicit key', () => {
    // Even when the secondary key equals the page store, resolveStoreByKey fetches
    // by the declared key (never the cascade) — the second query is independent.
    const ctx = ctxWith({ regional: regionalStore })
    const lowered = resolveBlends([blendStep], ctx)
    const step = lowered[0] as Extract<TransformStep, { op: 'joinByField' }>
    expect(step.op).toBe('joinByField')
    expect(step.source).toEqual([
      { time: 2022, gva: 40 },
      { time: 2023, gva: 45 },
    ])
  })
})

describe('FF-BLEND-DESUGARS-TO-JOIN — blend lowers to a row-identical joinByField', () => {
  it('resolveBlends rewrites blend → joinByField carrying the resolved secondary rows', () => {
    const ctx = ctxWith({ regional: regionalStore })
    const lowered = resolveBlends([blendStep], ctx)
    expect(lowered).toHaveLength(1)

    const step = lowered[0] as Extract<TransformStep, { op: 'joinByField' }>
    expect(step.op).toBe('joinByField')
    expect(step.by).toBe('time')
    expect(step.mode).toBe('left')
    // source = the secondary store's rows, projected/renamed per the blend config.
    expect(step.source).toEqual([
      { time: 2022, gva: 40 },
      { time: 2023, gva: 45 },
    ])
  })

  it('the desugared pipeline output equals a HAND-BUILT joinByField (the façade IS the engine)', () => {
    const ctx = ctxWith({ regional: regionalStore })
    const primary: RawRow[] = [
      { time: 2022, value: 100 },
      { time: 2023, value: 110 },
    ]

    const viaBlend = applyPipeline(primary, resolveBlends([blendStep], ctx))

    const handBuilt: TransformStep = {
      op: 'joinByField', by: 'time', mode: 'left',
      source: [
        { time: 2022, gva: 40 },
        { time: 2023, gva: 45 },
      ],
    }
    const viaHand = applyPipeline(primary, [handBuilt])

    expect(viaBlend).toEqual(viaHand)
  })

  it('mode defaults to left when omitted (Tableau primary-driven)', () => {
    const ctx = ctxWith({ regional: regionalStore })
    const noMode: TransformStep = {
      op: 'blend', from: { storeKey: 'regional', query: { measure: 'GVA' } }, by: 'time',
    }
    const step = resolveBlends([noMode], ctx)[0] as Extract<TransformStep, { op: 'joinByField' }>
    expect(step.mode).toBe('left')
  })

  it('a pipeline with NO blend is returned byte-identical (untouched)', () => {
    const ctx = ctxWith({ regional: regionalStore })
    const plain: TransformStep[] = [{ op: 'sort', by: 'time', dir: 'asc' }]
    expect(resolveBlends(plain, ctx)).toBe(plain)
  })
})

describe('FF-BLEND-KEY-GENERIC (react half) — the desugar is dimension-blind (Law 1)', () => {
  it('a blend joins on `geo` exactly as it does on `time` — no privileged dim', () => {
    const geoStore = obsStore({
      POP: [
        { geo: 'GE', pop: 3.7 },
        { geo: 'AM', pop: 2.9 },
      ],
    })
    const ctx = ctxWith({ pop: geoStore })
    const onGeo: TransformStep = {
      op: 'blend', from: { storeKey: 'pop', query: { measure: 'POP' } }, by: 'geo', mode: 'left',
    }
    const primary: RawRow[] = [
      { geo: 'GE', value: 100 },
      { geo: 'AM', value: 50 },
    ]
    const merged = applyPipeline(primary, resolveBlends([onGeo], ctx))
    expect(merged).toEqual([
      { geo: 'GE', value: 100, pop: 3.7 },
      { geo: 'AM', value: 50, pop: 2.9 },
    ])
  })
})
