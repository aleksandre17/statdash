// @vitest-environment jsdom
//
// ── NodeView / getShell — registry-as-composition fitness test ─────────────
//
//  Pins the framework composition contract (Option D):
//    1. A shell can render ANOTHER shell purely BY NAME via <NodeView>, with no
//       direct import of the target shell — registry-as-composition.
//    2. NodeView routes through the full renderNode pipeline, so the composed
//       node is self-contained: it sees ctx, validates, isolates crashes, etc.
//    3. nodeRegistry.getShell(type) returns the same directly-callable renderer
//       as get(type) — the low-level half of the capability.
//    4. NodeView on an unregistered type degrades to null (fail-soft seam).
//
//  Engine-agnostic (Law 3): registers its own minimal slices against a fresh
//  NodeRegistry — no plugin/app imports.
//

import { describe, it, expect } from 'vitest'
import { render, cleanup }      from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { NodeRegistry }         from './NodeRegistry'
import type { RenderContext, NodeBase, NodeDef, ChildrenArg } from './types'

// ── Test doubles ───────────────────────────────────────────────────────────

/** Minimal RenderContext — only the fields renderNode + these shells touch. */
function makeCtx(): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2024 } },
    stores:         {},
    filterParams:   {},
    vars:           {},
    color:          '#0080BE',
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:           { current: 'year', available: [], set: () => {} },
    effects:        [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNodeRef(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as unknown as RenderContext
  return holder.ctx
}

// renderNode is imported lazily through the registry's pipeline; the ctx closure
// only needs a reference for recursion. We import the real one below.
import { renderNode } from './renderNode'
const renderNodeRef = renderNode

// ── A leaf "chart" shell — the composition TARGET (never imported by composer) ─
const ChartShell = (def: NodeBase): ReactNode =>
  createElement('div', { 'data-testid': 'chart', 'data-title': (def as { title?: string }).title ?? '' },
    'CHART',
  )

// ── A "composer" shell — renders a chart BY NAME, no import of ChartShell ─────
//  This is the whole point: the composer holds only a type string + a def.
function makeComposerShell(reg: NodeRegistry) {
  return (_def: NodeBase, ctx: RenderContext, _ch: ChildrenArg): ReactNode => {
    // Low-level path: look the shell up by name and invoke it directly.
    // The local ChartShell mock (below) reads def.title for data-title, so the
    // composed node carries `title`. Cast through NodeBase: this test's mock is
    // typed (def: NodeBase), looser than the real ChartNode the typed overload expects.
    const shell = reg.getShell('chart')
    const inner = shell
      ? shell(
          { type: 'chart', title: 'composed-via-getShell' } as unknown as Parameters<typeof shell>[0],
          ctx,
          { defs: [], rendered: [], renderChild: () => null, slots: {} },
        )
      : null
    return createElement('div', { 'data-testid': 'composer' }, inner)
  }
}

describe('NodeRegistry.getShell — directly-callable shell lookup', () => {
  it('returns the same renderer object as get()', () => {
    const reg = new NodeRegistry()
    reg.register('chart', 'default', ChartShell)
    expect(reg.getShell('chart')).toBe(reg.get('chart'))
  })

  it('returns undefined for an unregistered type', () => {
    const reg = new NodeRegistry()
    expect(reg.getShell('nope')).toBeUndefined()
  })

  it('falls back to default variant when the named variant is absent', () => {
    const reg = new NodeRegistry()
    reg.register('chart', 'default', ChartShell)
    expect(reg.getShell('chart', 'compact')).toBe(reg.get('chart', 'default'))
  })

  it('a composer shell renders a chart purely by name (no direct import)', () => {
    const reg = new NodeRegistry()
    reg.register('chart',    'default', ChartShell)
    reg.register('composer', 'default', makeComposerShell(reg), { canHaveChildren: false })

    // Drive the composer through the SAME callable contract get() exposes.
    const ctx = makeCtx()
    const composer = reg.getShell('composer')!
    const out = composer(
      { type: 'composer' } as NodeBase,
      ctx,
      { defs: [], rendered: [], renderChild: () => null, slots: {} },
    )

    const { getByTestId } = render(out as React.ReactElement)
    expect(getByTestId('composer')).toBeTruthy()
    expect(getByTestId('chart').getAttribute('data-title')).toBe('composed-via-getShell')
    cleanup()
  })
})

// ── NodeView — high-level JSX composition through the real pipeline ──────────
//
//  NodeView reads the singleton nodeRegistry (via renderNode → register-all),
//  so we register the chart on that shared registry for these cases.

import { NodeView }     from './NodeView'
import { nodeRegistry } from './register-all'

describe('NodeView — registry composition in JSX', () => {
  it('renders a registered node by name through renderNode', () => {
    nodeRegistry.register('nv-chart', 'default', ChartShell, { category: 'data' })

    const ctx = makeCtx()
    const { getByTestId } = render(
      createElement(NodeView, {
        type: 'nv-chart' as never,
        def:  { type: 'nv-chart', title: 'composed-via-NodeView' } as never,
        ctx,
      }),
    )
    expect(getByTestId('chart').getAttribute('data-title')).toBe('composed-via-NodeView')
    cleanup()
  })

  it('degrades to null for an unregistered type (fail-soft seam)', () => {
    const ctx = makeCtx()
    const { container } = render(
      createElement(NodeView, {
        type: 'totally-unregistered' as never,
        def:  { type: 'totally-unregistered' } as never,
        ctx,
      }),
    )
    expect(container.innerHTML).toBe('')
    cleanup()
  })

  it('reconciles the addressed type onto the def passed to renderNode', () => {
    // def authored WITHOUT a redundant type — NodeView injects the looked-up type.
    nodeRegistry.register('nv-chart2', 'default', ChartShell, { category: 'data' })

    const ctx = makeCtx()
    const { getByTestId } = render(
      createElement(NodeView, {
        type: 'nv-chart2' as never,
        def:  { title: 'type-injected' } as never,
        ctx,
      }),
    )
    expect(getByTestId('chart').getAttribute('data-title')).toBe('type-injected')
    cleanup()
  })
})
