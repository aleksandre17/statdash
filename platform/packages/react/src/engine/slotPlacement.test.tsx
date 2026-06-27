// @vitest-environment jsdom
//
// ── Slot-placement render-time validation — fitness test (Pattern C) ────────
//
//  Pins the framework guardrail: when a child node type is placed in a parent
//  slot whose SlotDef.accepts does NOT list it, renderNode emits a non-blocking
//  'slot-placement' warning diagnostic — AND still renders the child.
//
//  Contract under test:
//    1. Illegal placement → one diagWarning('slot-placement') is emitted.
//    2. The offending child STILL renders (non-blocking / Postel's Law).
//    3. A legal placement (child type ∈ accepts) → NO warning.
//    4. A slot with no accepts list (any type) → NO warning.
//
//  Engine-agnostic (Law 3): registers its own minimal slices on the singleton
//  registry that renderNode reads, and observes via the public diagnostic seam.
//

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup }      from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { setDiagnosticObserver, type Diagnostic } from '@statdash/engine'
import { renderNode }     from './renderNode'
import { nodeRegistry }   from './register-all'
import type { RenderContext, NodeBase, NodeDef, ChildrenArg, SlotDef } from './types'

// ── Minimal RenderContext (mirrors NodeView.test.tsx) ───────────────────────
function makeCtx(): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2024 } },
    stores:         {},
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:           { current: 'year', available: [], set: () => {} },
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as unknown as RenderContext
  return holder.ctx
}

// A leaf shell that simply renders a marker div with its type.
const leafShell = (def: NodeBase): ReactNode =>
  createElement('div', { 'data-testid': `leaf-${def.type}` }, def.type)

// A container shell that renders its primary-slot children.
const containerShell = (_def: NodeBase, _ctx: RenderContext, ch: ChildrenArg): ReactNode =>
  createElement('div', { 'data-testid': 'container' }, ...ch.rendered)

const STRICT_SLOT: Record<string, SlotDef> = {
  children: { field: 'children', label: { en: 'Content' }, accepts: ['ok-leaf'], multi: true },
}
const OPEN_SLOT: Record<string, SlotDef> = {
  children: { field: 'children', label: { en: 'Content' }, multi: true }, // no accepts → any
}

let diags: Diagnostic[] = []

beforeEach(() => {
  diags = []
  setDiagnosticObserver(d => diags.push(d))
  nodeRegistry.register('ok-leaf',  'default', leafShell, { category: 'data' })
  nodeRegistry.register('bad-leaf', 'default', leafShell, { category: 'data' })
})

afterEach(() => {
  cleanup()
  setDiagnosticObserver(() => {})
})

describe('renderNode — slot-placement validation (Pattern C)', () => {
  it('warns AND still renders when a child type is not in slot.accepts', () => {
    nodeRegistry.register('sp-strict', 'default', containerShell, { slots: STRICT_SLOT })

    const node: NodeBase = {
      type: 'sp-strict',
      // @ts-expect-error runtime children for the test container
      children: [{ type: 'bad-leaf' }],
    }
    const { getByTestId } = render(renderNode(node, makeCtx()) as React.ReactElement)

    // (2) child still renders — non-blocking
    expect(getByTestId('leaf-bad-leaf')).toBeTruthy()
    // (1) exactly one slot-placement warning
    const sp = diags.filter(d => d.code === 'slot-placement')
    expect(sp).toHaveLength(1)
    expect(sp[0].level).toBe('warning')
    expect(sp[0].context).toMatchObject({ parentType: 'sp-strict', childType: 'bad-leaf' })
  })

  it('does NOT warn when the child type IS accepted', () => {
    nodeRegistry.register('sp-strict2', 'default', containerShell, { slots: STRICT_SLOT })

    const node: NodeBase = {
      type: 'sp-strict2',
      // @ts-expect-error runtime children for the test container
      children: [{ type: 'ok-leaf' }],
    }
    render(renderNode(node, makeCtx()) as React.ReactElement)
    expect(diags.filter(d => d.code === 'slot-placement')).toHaveLength(0)
  })

  it('does NOT warn when the slot has no accepts list (any type allowed)', () => {
    nodeRegistry.register('sp-open', 'default', containerShell, { slots: OPEN_SLOT })

    const node: NodeBase = {
      type: 'sp-open',
      // @ts-expect-error runtime children for the test container
      children: [{ type: 'bad-leaf' }],
    }
    render(renderNode(node, makeCtx()) as React.ReactElement)
    expect(diags.filter(d => d.code === 'slot-placement')).toHaveLength(0)
  })
})
