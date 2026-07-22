// @vitest-environment jsdom
// ── FF-NODE-FRAME-NONDEGENERATE — every whole-node frame is single-anchored + measures true ──
//
//  The 0109 collapse: on the LIVE canvas all 16 whole-node selection frames collapsed to a
//  4×4 dot at viewport (0,0), so nothing but the leaf items could be selected. Root cause
//  (proven): `renderNode`'s ASYNC store path (live mode = the default) applied the
//  `after` middleware chain TWICE — once inside `renderWithRows` and once around the outer
//  Suspense boundary. The ONE `canvas:node-anchor` middleware therefore stamped
//  `data-part-node-id` twice per node → two nested `display:contents` wrappers → the
//  overlay's `firstElementChild` box resolution landed on the boxless second wrapper → a
//  0×0 frame at the origin. Structural mode (a SYNC store) single-stamped, so selection
//  worked there — which is exactly why this shipped green: no fitness rendered a node
//  through the async path and asserted a single anchor.
//
//  This guard pins BOTH layers of the fix:
//    (a) ROOT — a node carries `data-part-node-id` EXACTLY ONCE, through BOTH the sync and
//        the async render path (the async path is the one that regressed).
//    (b) DEFENSE — `resolveAnchorBox` descends through EVERY leading `display:contents`
//        wrapper to the real content box, so even a future wrapper-count regression measures
//        truly instead of collapsing. (jsdom has no layout engine, so geometry
//        non-degeneracy itself is pinned by the Playwright e2e; here we pin the box-
//        RESOLUTION logic + the single-anchor invariant that made the box boxless.)
//
import { describe, it, expect, beforeAll } from 'vitest'
import { render, act } from '@testing-library/react'
import { createElement } from 'react'
import { renderNode, nodeRegistry, PART_NODE_ID_ATTR } from '@statdash/react/engine'
import type { NodeBase, RenderContext, ChildrenArg } from '@statdash/react/engine'
import { staticStore } from '@statdash/engine'
import type { DataStore, EngineRow, QueryResult, SectionContext, StoreQuery } from '@statdash/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { resolveAnchorBox } from './anchorBox'

// The canvas node-anchor middleware (the ONE data-part-node-id producer) is registered by
// setupCanvasRegistry. We ALSO register a trivial, hook-free container shell so a node can be
// rendered through renderNode with NO SiteProvider — isolating the middleware wrap (the seam
// that regressed) from the real shells' React-context needs. The middleware is type-agnostic,
// so a minimal shell exercises the exact double-stamp path a real chart/section did.
beforeAll(() => {
  setupCanvasRegistry()
  nodeRegistry.register(
    '__frame-fixture', 'default',
    (_def: NodeBase, _ctx: RenderContext, children: ChildrenArg) =>
      createElement('div', { className: 'frame-fixture-box' }, ...children.rendered),
    { canHaveChildren: true, slots: { main: { field: 'children', accepts: [], label: { ka: '', en: '' }, multi: true } } },
  )
})

function makeCtx(store: DataStore): RenderContext {
  const ctx: RenderContext = {
    sectionCtx: { dims: { time: 2024 } },
    stores: { default: store },
    pageStoreKey: 'default',
    filterParams: {}, vars: {}, locale: 'ka', fallbackLocale: 'ka',
    perspectiveKey: 'mode',
    perspective: { current: 'year', available: [], set: () => {} },
    rows: [],
    eventBus: { publish: () => {}, subscribe: () => () => {} },
    set: () => {}, resolveLinks: () => [],
    renderNode: (n: NodeBase, o?: Partial<RenderContext>) => renderNode(n, { ...ctx, ...o }),
  } as unknown as RenderContext
  return ctx
}

/** A caps.sync===false store — the LIVE-mode path every node takes on the real canvas. */
function asyncStore(): DataStore {
  let warm = false
  return {
    ...staticStore,
    caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: false },
    async queryAsync(_q: StoreQuery, _c: SectionContext): Promise<QueryResult> { warm = true; return { state: 'done', data: [] } },
    querySync(_q: StoreQuery, _c: SectionContext): EngineRow[] { if (!warm) throw new Error('cold'); return [] },
  } as DataStore
}

// A container with a child node — both must be framable (single-anchored) on the canvas.
const tree = {
  type: '__frame-fixture', id: 'sec-1',
  children: [{ type: '__frame-fixture', id: 'sec-1a', children: [] }],
} as unknown as NodeBase

function stampCount(id: string): number {
  return document.querySelectorAll(`[${PART_NODE_ID_ATTR}="${id}"]`).length
}

describe('FF-NODE-FRAME-NONDEGENERATE — (a) exactly one node-anchor per node', () => {
  it('SYNC store path stamps each node once', () => {
    render(renderNode(tree, makeCtx({ ...staticStore } as DataStore)) as React.ReactElement)
    expect(stampCount('sec-1')).toBe(1)
    expect(stampCount('sec-1a')).toBe(1)
  })

  it('ASYNC store path (live mode) stamps each node ONCE — the 0109 double-anchor is gone', async () => {
    await act(async () => {
      render(renderNode(tree, makeCtx(asyncStore())) as React.ReactElement)
    })
    // Before the fix these were 2 — two nested display:contents data-part-node-id wrappers,
    // which is what collapsed the overlay's measured box to 0×0 at the origin.
    expect(stampCount('sec-1')).toBe(1)
    expect(stampCount('sec-1a')).toBe(1)
  })
})

describe('FF-NODE-FRAME-NONDEGENERATE — (b) box resolution descends through display:contents', () => {
  function contents(): HTMLDivElement {
    const d = document.createElement('div')
    d.style.display = 'contents'
    return d
  }

  it('descends a SINGLE contents wrapper to the real box (the normal, single-anchor shape)', () => {
    const anchor = contents()
    const boxEl = document.createElement('div')            // real content box (display:block)
    anchor.appendChild(boxEl)
    document.body.appendChild(anchor)
    expect(resolveAnchorBox(anchor)).toBe(boxEl)
  })

  it('descends TWO nested contents wrappers to the real box (a wrapper-count regression stays measurable)', () => {
    const outer = contents(); const inner = contents()
    const boxEl = document.createElement('div')
    inner.appendChild(boxEl); outer.appendChild(inner)
    document.body.appendChild(outer)
    // With the old `firstElementChild` (one unwrap) this returned `inner` (0×0) → the collapse.
    expect(resolveAnchorBox(outer)).toBe(boxEl)
  })

  it('returns the anchor itself when it has no child (honest not-rendered 0×0 case)', () => {
    const anchor = contents()
    document.body.appendChild(anchor)
    expect(resolveAnchorBox(anchor)).toBe(anchor)
    expect(resolveAnchorBox(null)).toBeNull()
  })
})
