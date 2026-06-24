// @vitest-environment jsdom
//
// ── N41 RBAC visibility gate — renderNode(view.visibleToRoles) ──────────────
//
//  Fitness function for the engine/react render seam where RBAC is enforced.
//  view.visibleToRoles gates a node against ctx.auth.roles. The gate runs at
//  the TOP of renderNode (before migrate/validate/resolveRows) and returns
//  null when the caller lacks every listed role. Auth is an app-tier concern
//  (Law 3): engine/react reads ctx.auth — injected by the app tier — while
//  engine/core stays free of any user/role model.
//
//  We register a trivial shell for a private node type so a PERMITTED node
//  yields visible output (non-null), letting us distinguish "hidden by RBAC"
//  (null, returned before shell lookup) from "rendered" (the shell's element).
//

import { describe, it, expect, beforeAll, vi } from 'vitest'

// i18next is an optional peer — mock before any imports to avoid resolution error
vi.mock('i18next', () => ({
  default: { use: () => ({}) },
  t: (k: string) => k,
}))
import { createElement, type ReactNode }   from 'react'
import { renderToStaticMarkup }            from 'react-dom/server'
import type { DataStore, SectionContext, ModeContext } from '@statdash/engine'
import { renderNode }                      from './renderNode'
import { nodeRegistry }                    from './register-all'
import type { RenderContext, NodeBase, NodeDef, AuthContext } from './types'
import { createDefaultUI }                 from './createDefaultUI'
import { ExtensionRegistry }              from './extensions/ExtensionRegistry'
import { DefaultCommandBus }              from './commands/CommandBus'

// ── Minimal engine-only RenderContext (mirrors a11y.test.tsx harness) ───────
function makeCtx(auth?: AuthContext): RenderContext {
  const sectionCtx: SectionContext = { dims: { time: 2024 }, timeMode: 'year' }
  const mode: ModeContext = { current: 'year', available: [], set: () => {} }
  const stores: Record<string, DataStore> = {}

  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx,
    stores,
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    timeModeKey:    'mode',
    mode,
    effects:        [],
    ...(auth ? { auth } : {}),
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

// A node type registered with a trivial shell: a permitted node renders this
// marker, so non-null output proves the gate let it through to the shell.
const PRIVATE_TYPE = 'n41-private-node'
const MARKER = 'n41-visible'

beforeAll(() => {
  nodeRegistry.register(
    PRIVATE_TYPE,
    'default',
    () => createElement('div', { 'data-testid': MARKER }, MARKER),
  )
})

// Render a node to HTML; '' means the gate returned null (nothing rendered).
function renderHtml(node: NodeBase, auth?: AuthContext): string {
  const el = renderNode(node, makeCtx(auth))
  return el == null ? '' : renderToStaticMarkup(el as ReactNode)
}

describe('N41 — view.visibleToRoles gate in renderNode', () => {
  it('hides the node for an anonymous user (no ctx.auth)', () => {
    const node: NodeBase = { type: PRIVATE_TYPE, visibleToRoles: ['admin'] }
    expect(renderHtml(node)).toBe('')
  })

  it('hides the node when ctx.auth has roles but none match', () => {
    const node: NodeBase = { type: PRIVATE_TYPE, visibleToRoles: ['admin'] }
    expect(renderHtml(node, { userId: 'u1', roles: ['editor'] })).toBe('')
  })

  it('renders the node when the user has at least one matching role', () => {
    const node: NodeBase = { type: PRIVATE_TYPE, visibleToRoles: ['admin', 'editor'] }
    const html = renderHtml(node, { userId: 'u1', roles: ['editor'] })
    expect(html).toContain(MARKER)
  })

  it('renders the node when visibleToRoles is absent (visible to all)', () => {
    const node: NodeBase = { type: PRIVATE_TYPE }
    expect(renderHtml(node, { userId: 'u1', roles: [] })).toContain(MARKER)
    // anonymous too
    expect(renderHtml(node)).toContain(MARKER)
  })

  it('treats an empty visibleToRoles array as ungated (visible to all)', () => {
    const node: NodeBase = { type: PRIVATE_TYPE, visibleToRoles: [] }
    expect(renderHtml(node)).toContain(MARKER)
    expect(renderHtml(node, { userId: 'u1', roles: ['anything'] })).toContain(MARKER)
  })
})
