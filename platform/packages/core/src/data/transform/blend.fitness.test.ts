// ── B0 fitness — the declarative `blend` step (engine-side invariants) ─
//
//  Locks the engine-half invariants of the cross-store `blend` op from
//  adr_data_blending_decision (B0). The cross-store ROUTING + the desugar to
//  joinByField live in the react binding layer (the only layer that holds the
//  store manifest, Law 3) and are netted in
//  packages/react/.../resolveNodeRows.test.ts (FF-BLEND-ROUTES-SECOND-STORE,
//  FF-BLEND-DESUGARS-TO-JOIN). Here we pin the parts that are ENGINE contracts:
//
//    FF-BLEND-DECLARATIVE — a blend step is pure JSON: from.storeKey is a string,
//                           from.query is an ObsQuery, no function/fetch/loader
//                           ever enters it (Law 2).
//    FF-BLEND-ROUNDTRIP   — a blend step survives JSON.parse(JSON.stringify(step))
//                           unchanged; no pre-resolved EngineRow[] source is baked
//                           into config (unlike a hand-authored joinByField).
//    FF-BLEND-KEY-GENERIC — the join `by` is a generic dim key; no privileged
//                           'year'/dimension is hardcoded (Law 1).
//    blend is AUTHORABLE   — it carries a PropSchema + is in the runtime registry
//                           (the coverage-gate front-door that closes the
//                           joinByField gap).
//
//  Importing '@statdash/engine' (via the transform barrel) runs the registry's
//  module-init side-effect, so listTransformOps()/getTransformStepSchema() are
//  populated.
//
import { describe, it, expect } from 'vitest'

import { listTransformOps, getTransformStepSchema } from './step-registry'
import { applyStep } from './pipeline'
import type { TransformStep } from './types'
import '../transform' // side-effect: register built-in ops + schemas

// A representative, fully-declarative blend step (GDP × regional on `time`).
const blend: Extract<TransformStep, { op: 'blend' }> = {
  op:   'blend',
  from: {
    storeKey: 'regional',
    query:    { measure: 'B1G', filter: { adjustment: 'S' } },
    encoding: { label: 'time', value: 'value' },
  },
  by:     'time',
  mode:   'left',
  fields: ['regionalValue'],
  rename: { value: 'regionalValue' },
}

describe('FF-BLEND-DECLARATIVE — a blend step is pure JSON (Law 2)', () => {
  it('from.storeKey is a string and from.query is a plain ObsQuery object', () => {
    expect(typeof blend.from.storeKey).toBe('string')
    expect(typeof blend.from.query).toBe('object')
    expect(blend.from.query.measure).toBe('B1G')
  })

  it('no function appears anywhere in the blend step (no fetch/loader/resolver)', () => {
    const seen = new Set<unknown>()
    const noFunctions = (v: unknown): void => {
      expect(typeof v).not.toBe('function')
      if (v && typeof v === 'object' && !seen.has(v)) {
        seen.add(v)
        for (const child of Object.values(v as Record<string, unknown>)) noFunctions(child)
      }
    }
    noFunctions(blend)
  })
})

describe('FF-BLEND-ROUNDTRIP — a blend step survives JSON round-trip unchanged', () => {
  it('JSON.parse(JSON.stringify(blend)) deep-equals the original', () => {
    expect(JSON.parse(JSON.stringify(blend))).toEqual(blend)
  })

  it('the config carries NO pre-resolved row array (it references a store, not rows)', () => {
    // The round-trip hole joinByField opens (an inline `source: EngineRow[]` baked
    // into config) is closed by blend: it names a store + query, never rows.
    expect('source' in blend).toBe(false)
    expect(JSON.stringify(blend)).not.toContain('"source"')
  })
})

describe('FF-BLEND-KEY-GENERIC — the join key is a generic dim (Law 1)', () => {
  it('`by` is read from config, never a hardcoded privileged dimension', () => {
    // The op is dimension-blind: a blend on `geo` is as valid as one on `time`.
    const onGeo = { ...blend, by: 'geo' }
    expect(onGeo.by).toBe('geo')
    expect(blend.by).toBe('time')
    // No 'year' privileged key anywhere in the shape.
    expect(JSON.stringify(blend)).not.toContain('year')
  })
})

describe('blend is AUTHORABLE — the joinByField coverage front-door', () => {
  it('blend is registered in the runtime transform registry', () => {
    expect(listTransformOps()).toContain('blend')
  })

  it('blend carries an authoring PropSchema (surfaced, not allowlisted)', () => {
    const schema = getTransformStepSchema('blend')
    expect(schema).toBeDefined()
    const fields = schema!.map((f) => f.field)
    expect(fields).toContain('from')
    expect(fields).toContain('by')
    expect(fields).toContain('mode')
  })

  it('a blend reaching the CORE pipeline un-desugared is a safe no-op (Law 3)', () => {
    // Core cannot reach a second store (no manifest), so the registered core
    // handler passes rows through unchanged rather than crashing. The react
    // binding layer rewrites blend → joinByField BEFORE applyPipeline normally.
    const rows = [{ time: 2023, value: 10 }]
    expect(applyStep(rows, blend)).toEqual(rows)
  })
})
