// @vitest-environment jsdom
//
// ── FF-DUALVIEW-CONSISTENT — invariant I-6 (data-on-section, views-are-pure) ──
//
//  SCOPE (owner clarification): this equality applies ONLY within ONE section's
//  dual/multi-view. A section OWNS its `data`; its `view.role` children are pure
//  re-encodings of the SAME resolved rows — a table/map is NOT a second query.
//  Toggling the active view never re-queries; values agree across views of the
//  SAME section BY CONSTRUCTION (all read one `ctx.rows`).
//
//  This equality is EXPLICITLY NOT asserted across different sections/panels: a
//  chart in one panel and a table in another MAY legitimately have different data
//  pipes. The negative control below proves the boundary — a child that declares
//  its OWN `data` DOES issue a second store read, and that is allowed.
//
//  The mechanism under test is resolveNodeRows: a child with NO `data` inherits
//  the parent's `ctx.rows` (zero store reads); a child WITH `data` re-resolves.
//  We render THROUGH the real renderNode pipeline against a sync spy store and
//  count raw store reads — the invariant is structural, not merely visual.
//

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup }                    from '@testing-library/react'
import { createElement, type ReactNode }      from 'react'
import type { DataStore, EngineRow, DataRow } from '@statdash/engine'
import { renderNode }                         from './renderNode'
import { nodeRegistry }                       from './register-all'
import type { RenderContext, NodeBase, NodeDef, ChildrenArg } from './types'

// ── Spy store — sync, returns fixed rows, counts raw reads ──────────────────
const SECTION_ROWS: EngineRow[] = [
  { geo: 'GE', value: 111 },
  { geo: 'AM', value: 222 },
]
function makeSpyStore(rows: EngineRow[] = SECTION_ROWS) {
  const calls = { count: 0 }
  const store: DataStore = {
    querySync(): EngineRow[] { calls.count++; return rows },
    caps: { queryTypes: ['obs'], batching: false, streaming: false, sync: true },
  }
  return { store, calls }
}

// ── Shells: a container that renders its children + a leaf that captures rows ─
// The leaf reflects ctx.rows into a shared sink keyed by its view.role, so the
// test can assert every view saw the SAME section-owned rows.
const rowSink: Record<string, DataRow[]> = {}

function containerShell(_def: NodeBase, _ctx: RenderContext, children: ChildrenArg): ReactNode {
  return createElement(
    'div',
    { 'data-testid': 'container' },
    ...children.defs.map((_d, i) => children.rendered[i]),
  )
}
function leafShell(def: NodeBase, ctx: RenderContext): ReactNode {
  const role = (def as NodeBase).view?.role ?? '_'
  rowSink[role] = ctx.rows ?? []
  return createElement('div', { 'data-testid': `leaf-${role}` }, String((ctx.rows ?? []).length))
}

function makeCtx(store: DataStore): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:   { dims: { geo: '' } },
    stores:       { main: store },
    pageStoreKey: 'main',
    filterParams: {},
    vars:         {},
    locale:       'en',
    rows:         [],
    renderNode:   (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as unknown as RenderContext
  return holder.ctx
}

const QUERY = { type: 'query', query: { measure: 'X' } } as unknown

beforeEach(() => {
  for (const k of Object.keys(rowSink)) delete rowSink[k]
  nodeRegistry.register('i6-section', 'default', containerShell, { category: 'layout' })
  nodeRegistry.register('i6-leaf',    'default', leafShell,      { category: 'data' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('I-6 — a section owns data; same-section view children are pure re-encodings', () => {
  it('resolves ONE section `data`; view.role children add ZERO store reads and see the SAME rows', () => {
    // Baseline: the section alone resolves its data with N store reads.
    const base = makeSpyStore()
    render(
      renderNode(
        { type: 'i6-section', data: QUERY, children: [] } as unknown as NodeBase,
        makeCtx(base.store),
      ) as React.ReactElement,
    )
    const baseline = base.calls.count
    expect(baseline).toBeGreaterThan(0) // the section really did read the store

    // Same section + TWO view.role children with NO `data` of their own.
    const dual = makeSpyStore()
    render(
      renderNode(
        {
          type: 'i6-section',
          data: QUERY,
          children: [
            { type: 'i6-leaf', view: { role: 'chart', label: 'Chart' } },
            { type: 'i6-leaf', view: { role: 'table', label: 'Table' } },
          ],
        } as unknown as NodeBase,
        makeCtx(dual.store),
      ) as React.ReactElement,
    )

    // I-6: the children issued NO additional store reads — same read count as
    // the childless section. The table/map is NOT a second query.
    expect(dual.calls.count).toBe(baseline)

    // Both views re-encoded the SAME section-owned rows (agreement by construction).
    expect(rowSink['chart']).toEqual(SECTION_ROWS)
    expect(rowSink['table']).toEqual(SECTION_ROWS)
    expect(rowSink['chart']).toEqual(rowSink['table'])
  })

  it('SCOPE BOUNDARY — a child that declares its OWN `data` DOES re-query (cross-panel is allowed)', () => {
    // A child with its own DISTINCT `data` is a different data pipe, NOT a
    // same-section view. I-6 does NOT constrain it: it legitimately re-reads.
    const base = makeSpyStore()
    render(
      renderNode(
        { type: 'i6-section', data: QUERY, children: [] } as unknown as NodeBase,
        makeCtx(base.store),
      ) as React.ReactElement,
    )
    const baseline = base.calls.count

    const withOwnData = makeSpyStore()
    render(
      renderNode(
        {
          type: 'i6-section',
          data: QUERY,
          children: [
            // Distinct query ⇒ distinct cache key ⇒ a real second store read.
            { type: 'i6-leaf', view: { role: 'table' }, data: { type: 'query', query: { measure: 'Y' } } },
          ],
        } as unknown as NodeBase,
        makeCtx(withOwnData.store),
      ) as React.ReactElement,
    )

    // The self-fetching child added a read on top of the section's — proof the
    // one-data guarantee is scoped to children that DON'T carry their own data.
    expect(withOwnData.calls.count).toBeGreaterThan(baseline)
  })
})
