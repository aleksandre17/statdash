// ── FF-KPI-SPECLESS-FAILSOFT — a spec-less kpi-strip interprets to EMPTY, never throws ──
//
//  The jsdom net under the panel real-browser e2e (apps/panel/e2e/boot.e2e.ts).
//  A "green ≠ works" defect the Playwright run caught: `interpretKpis` did
//  `specs.filter(...)` and threw `Cannot read properties of undefined (reading
//  'filter')` when a `kpi-strip` node carried NO `items`. In a real browser that
//  crashed the node into NodeErrorBoundary's fallback card (node-isolated, but the
//  panel showed a broken card). jsdom + the existing unit suites missed it because
//  they ALWAYS pass specs — the mock seed page (mockApi.ts) is the only place a
//  spec-less kpi-strip existed.
//
//  `items` is REQUIRED by the KpiStripNode type, but a hand-authored / API-hydrated
//  node-config may omit it (the untyped JSON boundary). The interpreter must be
//  Postel-tolerant: an absent optional input yields an EMPTY result (the shell then
//  renders <EmptyState/>), it MUST NOT hard-throw. This is the engine-layer twin of
//  the fail-soft chrome guard (`useChromeConfig ?? EMPTY_CHROME_CONFIG`, packages/
//  react). BOTH public per-node entry points are guarded — the render twin
//  (interpretKpis) AND the warm twin (extractKpiRequirements) — so warm === render
//  holds even at the absent-input boundary (a spec-less strip warms nothing).

import { describe, it, expect } from 'vitest'
import { interpretKpis, extractKpiRequirements } from './kpi'
import type { KpiSpec }        from './kpi'
import type { DataStore }      from './store'
import { TIME_DIM }            from '../core/context'
import type { SectionContext } from '../core/context'

// A store that would THROW if any read were issued — proves an empty spec set reads
// nothing (no accidental read on the absent-input path).
const store: DataStore = {
  querySync() { throw new Error('no read expected for a spec-less kpi-strip') },
  caps: { queryTypes: ['val'], batching: false, streaming: false, sync: true },
}

const ctx: SectionContext = { dims: { [TIME_DIM]: 2025 } }

describe('FF-KPI-SPECLESS-FAILSOFT · interpretKpis tolerates absent specs', () => {
  it('undefined specs → empty KPI set, no throw (the e2e crash)', () => {
    // The exact runtime shape of a `kpi-strip` node authored without `items`.
    const specs = undefined as unknown as KpiSpec[]
    expect(() => interpretKpis(specs, ctx, store)).not.toThrow()
    expect(interpretKpis(specs, ctx, store)).toEqual([])
  })

  it('empty specs → empty KPI set (the well-formed empty case, unchanged)', () => {
    expect(interpretKpis([], ctx, store)).toEqual([])
  })
})

describe('FF-KPI-SPECLESS-FAILSOFT · extractKpiRequirements twin', () => {
  it('undefined specs → zero requirements, no throw (warm === render at the empty boundary)', () => {
    const specs = undefined as unknown as KpiSpec[]
    expect(() => extractKpiRequirements(specs, ctx)).not.toThrow()
    expect(extractKpiRequirements(specs, ctx)).toEqual([])
  })
})
