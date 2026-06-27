// @vitest-environment node
//
// ── FF-SSR-WALKER-VIEW-AWARE + FF-SNAPSHOT-VIEW-EQUIV [P-opt] ─────────────────
//
//  Locks the perspective-aware SSR walkers (warm.ts collectRequirements +
//  api.ts walkNode). The live DOM is already lazy: renderNode.ts:228 gates on
//  `view.visibleWhen` BEFORE resolveNodeRows. Pre-P-opt the SSR walkers ignored
//  that gate and warmed/resolved BOTH perspectives (~2× slices/snapshot). These
//  fitness functions prove:
//
//   FF-SSR-WALKER-VIEW-AWARE — the warm walker SKIPS an inactive-perspective
//     node's requirements: mode=year excludes the range-only node's slices and
//     vice-versa; and quantifies the reduction (~half the slices per snapshot).
//
//   FF-SNAPSHOT-VIEW-EQUIV — the active-perspective api snapshot is
//     render-equivalent to the active-perspective live render: every slice the
//     active perspective needs is present, every inactive node is status:'empty'
//     with no frame (exactly what the live renderNode produces — null subtree).
//     Non-vacuous: a baseline assertion proves the inactive node WOULD resolve a
//     frame if it were visible, so the skip is a real subtraction, not a no-op.
//
//  Test page (a 2-perspective page, mirroring the gdp/accounts shape):
//    - a YEAR-only node   gated by { op:'perspective-is', perspective:'year'  } carrying code Y
//    - a RANGE-only node  gated by { op:'perspective-is', perspective:'range' } carrying code R
//    - an UNGATED node    (always visible) carrying code U
//

import { describe, it, expect, vi }        from 'vitest'
import { warmPageStore }                    from './warm'
import { renderPageToJSON }                 from './api'
import type { StaticRenderContext }         from './html'
import type { NodePageConfig }              from '../types'
import { staticStore }                      from '@statdash/engine'
import { _storeCache }                      from '../resolveNodeRows'

// ── Helpers ─────────────────────────────────────────────────────────────────

function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

/** Raw store wrapped by resolveStore into a warmable CachedStore. */
function makeRawStore() {
  return { ...staticStore, _marker: Symbol('fitness-store') }
}

/** StaticRenderContext for a given active perspective id (mode.current). */
function ctxFor(
  activeView: string,
  stores: Record<string, import('@statdash/engine').DataStore>,
): StaticRenderContext {
  return {
    sectionCtx:     { dims: { time: 2024 } },
    stores,
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective: { current: activeView, available: [], set: () => {} },
  }
}

/** A 2-perspective page: year-only, range-only, and ungated data nodes. */
const TWO_PERSPECTIVE_PAGE = asPage({
  type:     'inner-page',
  children: [
    {
      type: 'section',
      id:   'year-only',
      view: { visibleWhen: { op: 'perspective-is', perspective: 'year' } },
      data: { type: 'row-list', rows: [{ code: 'Y' }] },
    },
    {
      type: 'section',
      id:   'range-only',
      view: { visibleWhen: { op: 'perspective-is', perspective: 'range' } },
      data: { type: 'row-list', rows: [{ code: 'R' }] },
    },
    {
      type: 'section',
      id:   'ungated',
      data: { type: 'row-list', rows: [{ code: 'U' }] },
    },
  ],
})

/** Pull the warmed requirement codes for a page + ctx via the CachedStore spy. */
function warmedCodes(page: NodePageConfig, ctx: StaticRenderContext, opts?: { snapshot?: 'active' | 'all-perspectives' }): string[] {
  const rawStore = ctx.stores['main'] as ReturnType<typeof makeRawStore>
  // Prime the CachedStore so _storeCache has the wrapper, then spy on the next warm.
  warmPageStore(page, ctx, opts)
  const cached  = _storeCache.get(rawStore)!
  const warmSpy = vi.spyOn(cached, 'warm')
  warmPageStore(page, ctx, opts)
  const [reqs] = warmSpy.mock.calls[0] as [{ code: string }[]]
  warmSpy.mockRestore()
  return reqs.map(r => r.code)
}

// ── FF-SSR-WALKER-VIEW-AWARE ──────────────────────────────────────────────────

describe('FF-SSR-WALKER-VIEW-AWARE — warm walker honours the active-perspective gate', () => {

  it('mode=year warms the year-only + ungated slices, SKIPS the range-only slice', () => {
    const codes = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('year', { main: makeRawStore() }))
    expect(codes).toContain('Y')   // year-only — active
    expect(codes).toContain('U')   // ungated   — always
    expect(codes).not.toContain('R') // range-only — SKIPPED (inactive perspective)
  })

  it('mode=range warms the range-only + ungated slices, SKIPS the year-only slice', () => {
    const codes = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('range', { main: makeRawStore() }))
    expect(codes).toContain('R')
    expect(codes).toContain('U')
    expect(codes).not.toContain('Y') // year-only — SKIPPED (inactive perspective)
  })

  it('quantifies the reduction — active-perspective warms ~half the gated slices vs all-perspectives', () => {
    const all    = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('year', { main: makeRawStore() }), { snapshot: 'all-perspectives' })
    const active = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('year', { main: makeRawStore() }), { snapshot: 'active' })

    // all-perspectives = pre-P-opt eager union: Y + R + U (3 slices).
    expect(all.sort()).toEqual(['R', 'U', 'Y'])
    // active = active perspective only: Y + U (2 slices) — the one range-only
    // slice is dropped. The two perspective-gated slices (Y, R) halve to one.
    expect(active.sort()).toEqual(['U', 'Y'])

    const gatedAll    = all.filter(c => c === 'Y' || c === 'R').length     // 2
    const gatedActive = active.filter(c => c === 'Y' || c === 'R').length  // 1
    expect(gatedActive).toBe(gatedAll / 2) // exactly half the perspective-gated slices warmed
  })

  it('all-perspectives is byte-identical to the pre-P-opt eager walk (gate disabled)', () => {
    const yearUnion  = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('year',  { main: makeRawStore() }), { snapshot: 'all-perspectives' })
    const rangeUnion = warmedCodes(TWO_PERSPECTIVE_PAGE, ctxFor('range', { main: makeRawStore() }), { snapshot: 'all-perspectives' })
    // The union is independent of the active perspective — every node warms.
    expect(yearUnion.sort()).toEqual(rangeUnion.sort())
    expect(yearUnion.sort()).toEqual(['R', 'U', 'Y'])
  })

})

// ── FF-SNAPSHOT-VIEW-EQUIV ────────────────────────────────────────────────────

describe('FF-SNAPSHOT-VIEW-EQUIV — active-perspective snapshot == active-perspective live render', () => {

  /** Find a NodeDataEntry by id anywhere in the snapshot tree. */
  function findEntry(entry: import('./api').NodeDataEntry, id: string): import('./api').NodeDataEntry | undefined {
    if (entry.id === id) return entry
    for (const c of entry.children) {
      const hit = findEntry(c, id)
      if (hit) return hit
    }
    return undefined
  }

  it('mode=year — the range-only node is status:empty with no frame; year-only + ungated resolve', () => {
    const snapshot = renderPageToJSON(TWO_PERSPECTIVE_PAGE, ctxFor('year', { main: staticStore }))
    const page     = snapshot.nodes[0]

    const yearOnly  = findEntry(page, 'year-only')!
    const rangeOnly = findEntry(page, 'range-only')!
    const ungated   = findEntry(page, 'ungated')!

    // Active-perspective nodes resolve a frame (status ok, even if value 0 via staticStore).
    expect(yearOnly.status).toBe('ok')
    expect(yearOnly.frame).toBeDefined()
    expect(ungated.status).toBe('ok')
    expect(ungated.frame).toBeDefined()

    // Inactive-perspective node — NOT resolved, mirrors live renderNode → null.
    expect(rangeOnly.status).toBe('empty')
    expect(rangeOnly.frame).toBeUndefined()
  })

  it('mode=range — the year-only node is status:empty; range-only + ungated resolve', () => {
    const snapshot = renderPageToJSON(TWO_PERSPECTIVE_PAGE, ctxFor('range', { main: staticStore }))
    const page     = snapshot.nodes[0]

    expect(findEntry(page, 'range-only')!.status).toBe('ok')
    expect(findEntry(page, 'range-only')!.frame).toBeDefined()
    expect(findEntry(page, 'ungated')!.status).toBe('ok')

    expect(findEntry(page, 'year-only')!.status).toBe('empty')
    expect(findEntry(page, 'year-only')!.frame).toBeUndefined()
  })

  it('NON-VACUOUS — the same hidden node DOES resolve a frame when its perspective is active', () => {
    // Prove the skip is a real subtraction: range-only is empty in year mode,
    // but ok-with-frame in range mode. If the gate were a no-op, both would resolve.
    const inYear  = renderPageToJSON(TWO_PERSPECTIVE_PAGE, ctxFor('year',  { main: staticStore })).nodes[0]
    const inRange = renderPageToJSON(TWO_PERSPECTIVE_PAGE, ctxFor('range', { main: staticStore })).nodes[0]

    const findById = (e: import('./api').NodeDataEntry, id: string): import('./api').NodeDataEntry | undefined => {
      if (e.id === id) return e
      for (const c of e.children) { const h = findById(c, id); if (h) return h }
      return undefined
    }

    expect(findById(inYear,  'range-only')!.status).toBe('empty')
    expect(findById(inRange, 'range-only')!.status).toBe('ok')
  })

  it('all-perspectives — every node resolves regardless of active perspective (Law-9 completeness)', () => {
    const snapshot = renderPageToJSON(TWO_PERSPECTIVE_PAGE, ctxFor('year', { main: staticStore }), { snapshot: 'all-perspectives' })
    const page     = snapshot.nodes[0]

    const findById = (e: import('./api').NodeDataEntry, id: string): import('./api').NodeDataEntry | undefined => {
      if (e.id === id) return e
      for (const c of e.children) { const h = findById(c, id); if (h) return h }
      return undefined
    }

    // Even the range-only node (inactive in year mode) resolves under all-perspectives.
    expect(findById(page, 'year-only')!.status).toBe('ok')
    expect(findById(page, 'range-only')!.status).toBe('ok')
    expect(findById(page, 'ungated')!.status).toBe('ok')
  })

})
