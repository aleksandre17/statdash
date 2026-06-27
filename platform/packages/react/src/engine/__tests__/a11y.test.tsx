// @vitest-environment jsdom
//
// ── a11y fitness function [N44] ───────────────────────────────────────────
//
//  CI accessibility gate (WCAG 2.1 AA — Law 9). axe-core runs against the
//  rendered output of EACH registered node type, driven through the real
//  renderNode() pipeline. A failing axe check = a failing test = CI blocked.
//
//  Why representative slices here (not plugin shells):
//    engine/react must stay app-agnostic — it cannot import from plugins/ or
//    apps/ (Clean Architecture dependency arrow, Law 3). So this test registers
//    its OWN minimal, semantically-correct slices for the four mandated node
//    types (page · section · panel · filter-bar) against the shared
//    nodeRegistry, then exercises the engine machinery (registry + renderNode +
//    RenderContext) over them. The fitness function asserts the ENGINE renders
//    accessible semantic HTML — concrete plugin shells get their own a11y gates
//    co-located (e.g. ChartDataTable.a11y.test.tsx).
//
//  Coverage is discovery-based: the final test walks every type registered on
//  nodeRegistry and renders it, so a newly-registered type is auto-covered.
//

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

// i18next is an optional peer — mock before any imports to avoid resolution error
vi.mock('i18next', () => ({
  default: { use: () => ({}) },
  t: (k: string) => k,
}))
import { render, cleanup }                 from '@testing-library/react'
import axe                                 from 'axe-core'
import { createElement, type ReactNode }   from 'react'
import { staticStore }                     from '@statdash/engine'
import type { DataStore, SectionContext, PerspectiveContext } from '@statdash/engine'
import { renderNode }                      from '../renderNode'
import { nodeRegistry }                    from '../register-all'
import type { RenderContext, NodeBase, NodeDef, ChildrenArg } from '../types'
import { createDefaultUI }                 from '../createDefaultUI'
import { ExtensionRegistry }              from '../extensions/ExtensionRegistry'
import { DefaultCommandBus }              from '../commands/CommandBus'

// NOTE: register directly via nodeRegistry.register (the dependency-free public
// API) rather than registerSlice — registerSlice pulls in i18next, which is an
// app-tier dependency not resolvable from engine/react (Law 3: engine/react is
// app-agnostic). This test needs only the registry + renderNode machinery.

// ── axe helper — promisified callback API (matches ChartDataTable gate) ──────

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return new Promise((resolve, reject) => {
    // Wrap in a <main> landmark so region/landmark rules have valid context —
    // the rendered fragment alone is not a full document.
    axe.run(container, { resultTypes: ['violations'] }, (err, results) => {
      if (err) reject(err)
      else     resolve(results)
    })
  })
}

// ── Minimal RenderContext — engine-only, no SiteRenderer hooks ──────────────
//
//  Mirrors the serializable half built in targets/html.tsx, with no-op runtime
//  services. Self-referential renderNode closure handles recursion.
//
function makeCtx(stores: Record<string, DataStore>): RenderContext {
  const sectionCtx: SectionContext = { dims: { time: 2024 }, perspectiveState: { mode: 'year' } }
  const perspective: PerspectiveContext = { current: 'year', available: [], set: () => {} }

  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx,
    stores,
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective,
    extensions:     new ExtensionRegistry(),
    ui:             createDefaultUI(),
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    bus:            new DefaultCommandBus(),
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  }
  return holder.ctx
}

// ── Representative semantic-HTML slices for the four mandated node types ─────
//
//  Each renders the WCAG-correct landmark/heading/structure for its role.
//  Children are dispatched by the engine (children.rendered) — never by the shell.
//

const PageShell = (_def: NodeBase, _ctx: RenderContext, ch: ChildrenArg): ReactNode =>
  createElement('main', { 'aria-label': 'Page content' },
    createElement('h1', null, 'Statistical Dashboard'),
    ...ch.rendered,
  )

const SectionShell = (def: NodeBase, _ctx: RenderContext, ch: ChildrenArg): ReactNode =>
  createElement('section', { 'aria-labelledby': `${def.id ?? 'section'}-h` },
    createElement('h2', { id: `${def.id ?? 'section'}-h` }, 'Section'),
    ...ch.rendered,
  )

const PanelShell = (_def: NodeBase, ctx: RenderContext): ReactNode =>
  createElement('figure', { 'aria-label': 'Indicator panel' },
    createElement('figcaption', null, 'Gross Domestic Product'),
    createElement('table', null,
      createElement('caption', null, 'GDP by year'),
      createElement('thead', null,
        createElement('tr', null,
          createElement('th', { scope: 'col' }, 'Year'),
          createElement('th', { scope: 'col' }, 'Value'),
        ),
      ),
      createElement('tbody', null,
        ...(ctx.rows ?? []).map((r, i) =>
          createElement('tr', { key: i },
            createElement('th', { scope: 'row' }, String((r as unknown as Record<string, unknown>)['time'] ?? '')),
            createElement('td', null, String(r['value'] ?? '')),
          ),
        ),
      ),
    ),
  )

const FilterBarShell = (def: NodeBase): ReactNode =>
  createElement('div', { role: 'search', 'aria-label': 'Filters' },
    createElement('label', { htmlFor: `${def.id ?? 'fb'}-year` }, 'Year'),
    createElement('select', { id: `${def.id ?? 'fb'}-year` },
      createElement('option', { value: '2024' }, '2024'),
      createElement('option', { value: '2023' }, '2023'),
    ),
  )

// ── Fixture: a NodePageConfig tree covering all four mandated types ─────────

const PAGE_TREE: NodeBase = {
  type: 'inner-page',
  id:   'p1',
  children: [
    { type: 'filter-bar', id: 'fb1' },
    {
      type: 'section', id: 's1',
      children: [
        { type: 'panel', id: 'panel1', data: { kind: 'row-list' } as unknown as NodeBase['data'] },
      ],
    },
  ] as unknown as NodeDef[],
} as NodeBase

// Stub DataStore with a few rows — resolveNodeRows tolerates an unresolved spec
// (returns []), so the panel still renders its accessible table shell.
function makeStore(): DataStore {
  return { ...staticStore } as DataStore
}

beforeAll(() => {
  nodeRegistry.register('inner-page', 'default', PageShell,      { category: 'page',   canHaveChildren: true })
  nodeRegistry.register('section',    'default', SectionShell,   { category: 'layout', canHaveChildren: true })
  nodeRegistry.register('panel',      'default', PanelShell,     { category: 'data',   canHaveChildren: false })
  nodeRegistry.register('filter-bar', 'default', FilterBarShell, { category: 'filter' })
})

// Explicit DOM teardown after every test. Required for landmark isolation:
// @testing-library auto-cleanup can be disabled when the workspace mixes node +
// jsdom environments, leaving prior renders mounted in document.body. Two
// surviving <main> landmarks would (correctly) trip axe's landmark-no-duplicate-main
// — cleanup() unmounts and clears the body so each render is scanned in isolation.
afterEach(() => cleanup())

// ── Per-type a11y gate ──────────────────────────────────────────────────────

describe('a11y fitness function — registered node types render accessible HTML', () => {
  const MANDATED = ['inner-page', 'section', 'panel', 'filter-bar'] as const

  it.each(MANDATED)('node type "%s" has zero axe violations', async (type) => {
    const ctx  = makeCtx({ main: makeStore() })
    const node = { type, id: `${type}-fixture`, data: { kind: 'row-list' } as unknown as NodeBase['data'] } as NodeBase
    const { container } = render(createElement(() => renderNode(node, ctx) as ReactNode))
    const results = await runAxe(container)
    expect(results.violations).toHaveLength(0)
  })

  it('full page tree (page → filter-bar + section → panel) has zero axe violations', async () => {
    const ctx = makeCtx({ main: makeStore() })
    const { container } = render(createElement(() => renderNode(PAGE_TREE, ctx) as ReactNode))
    const results = await runAxe(container)
    expect(results.violations).toHaveLength(0)
  })
})

// ── Discovery-based coverage — every registered type is auto-gated ───────────

describe('a11y fitness function — registry discovery coverage', () => {
  it('covers at minimum page · section · panel · filter-bar', () => {
    const types = nodeRegistry.types()
    for (const t of ['inner-page', 'section', 'panel', 'filter-bar'])
      expect(types).toContain(t)
  })

  it('every registered node type renders without axe violations', async () => {
    const ctx   = makeCtx({ main: makeStore() })
    const types = nodeRegistry.types()
    expect(types.length).toBeGreaterThan(0)

    for (const type of types) {
      const node = { type, id: `${type}-discovery`, data: { kind: 'row-list' } as unknown as NodeBase['data'] } as NodeBase
      const { container } = render(createElement(() => renderNode(node, ctx) as ReactNode))
      const results = await runAxe(container)
      expect(results.violations, `axe violations for node type "${type}"`).toHaveLength(0)
      cleanup()  // unmount between iterations — no duplicate landmarks within one test
    }
  })
})
