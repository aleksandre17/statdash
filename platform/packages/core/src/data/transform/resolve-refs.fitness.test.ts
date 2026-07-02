// ── FF-PIVOT-* — state-bound pipeline-step params (resolvePipeRefs, AR-36) ────────
//
//  Locks the invariants of the pipeline sibling of resolveEncodingRefs: the OLAP
//  roll-up LEVEL (aggregate `by`) and display order (sort `by`/`dir`) bind to state
//  so the regional composition panel is ONE pivot, not two visibleWhen A/B panels.
//
//  • FF-PIVOT-AGNOSTIC   — the resolver is dimension-blind (Law 1): it substitutes
//    whatever field/list the config named, for ANY dims — no sector/geo literal.
//  • byte-identity       — a ref-free pipeline is returned by the SAME reference.
//  • comma-split         — a `by` ref resolves to a comma-string → the group-by array.
//  • $ctx→dims, $ref→vars — same two-step resolution the encoding-ref pass uses.

import { describe, it, expect } from 'vitest'
import { resolvePipeRefs } from './resolve-refs'
import type { TransformStep } from './types'
import type { RefServices } from '../../ref/ref'

describe('resolvePipeRefs — FF-PIVOT-* (state-bound roll-up + order)', () => {
  it('byte-identical: a ref-free pipeline is returned by the SAME reference', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: ['a', 'b'], measure: 'value', agg: 'sum' },
      { op: 'sort', by: 'value', dir: 'desc' },
    ]
    const out = resolvePipeRefs(steps, { dims: {}, vars: {} })
    expect(out).toBe(steps)            // same reference, zero allocation
  })

  it('resolves an aggregate `by` {$ctx} → comma-string → the group-by array (state B)', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: { $ctx: '_byDims' } as never, measure: 'value', agg: 'sum' },
    ]
    const services: RefServices = { dims: {}, vars: { _byDims: 'sector,geo,time' } }
    const out = resolvePipeRefs(steps, services)
    expect(out).not.toBe(steps)
    expect((out[0] as { by: string[] }).by).toEqual(['sector', 'geo', 'time'])
  })

  it('resolves an aggregate `by` {$ctx} → single-dim roll-up (state A)', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: { $ctx: '_byDims' } as never, measure: 'value', agg: 'sum' },
    ]
    const out = resolvePipeRefs(steps, { dims: {}, vars: { _byDims: 'geo' } })
    expect((out[0] as { by: string[] }).by).toEqual(['geo'])
  })

  it('resolves sort `by` + `dir` {$ctx} refs to concrete values', () => {
    const steps: TransformStep[] = [
      { op: 'sort', by: { $ctx: '_sortBy' } as never, dir: { $ctx: '_sortDir' } as never },
    ]
    const out = resolvePipeRefs(steps, { dims: {}, vars: { _sortBy: 'sectorOrder', _sortDir: 'asc' } })
    expect(out[0]).toMatchObject({ op: 'sort', by: 'sectorOrder', dir: 'asc' })
  })

  it('$ctx resolves from dims, else falls back to vars ($ref) — same as the encoding pass', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: { $ctx: 'k' } as never, measure: 'value', agg: 'sum' },
    ]
    // dims wins when present…
    expect((resolvePipeRefs(steps, { dims: { k: 'x' }, vars: { k: 'y' } })[0] as { by: string[] }).by)
      .toEqual(['x'])
    // …else the var-scope fallback resolves.
    expect((resolvePipeRefs(steps, { dims: {}, vars: { k: 'y' } })[0] as { by: string[] }).by)
      .toEqual(['y'])
  })

  it('FF-PIVOT-AGNOSTIC: dimension-blind — works for ARBITRARY dims (no sector/geo literal)', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: { $ctx: '_by' } as never, measure: 'v', agg: 'sum' },
      { op: 'sort', by: { $ctx: '_ord' } as never, dir: 'asc' },
    ]
    // Two dims the platform never privileges — the pivot rotates them identically.
    const out = resolvePipeRefs(steps, { dims: {}, vars: { _by: 'product,store', _ord: 'productOrder' } })
    expect((out[0] as { by: string[] }).by).toEqual(['product', 'store'])
    expect(out[1]).toMatchObject({ by: 'productOrder' })
  })

  it('an unresolved / empty `by` ref degrades to whole-set (empty groupBy), never crashes', () => {
    const steps: TransformStep[] = [
      { op: 'aggregate', by: { $ctx: '_missing' } as never, measure: 'v', agg: 'sum' },
    ]
    const out = resolvePipeRefs(steps, { dims: {}, vars: {} })
    expect((out[0] as { by: string[] }).by).toEqual([])
  })
})
