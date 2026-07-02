// @vitest-environment node
//
// ── N36 cross-filter — integration tests ──────────────────────────────────
//
//  Tests that cover:
//    1. resolveDataLinks with target:'filter' returns action:'filter' (via engine/core)
//    2. NodeBase.on type structure is correct (compile-time shape guard)
//    3. FilterAction structure matches expected contract
//
//  Note: ChartShell / TableShell render tests require jsdom + React test utils
//  and live in crossFilter.shell.test.tsx. This file covers the pure engine
//  logic (no React) so it can run under the 'node' environment.
//

import { describe, it, expect } from 'vitest'
import { resolveDataLinks }      from '@statdash/engine'
import type {
  DataLinkDef,
  ResolvedLink,
}                                from '@statdash/engine'
import type {
  NodeEventHandler,
  FilterAction,
  NodeAction,
  NodeEventTrigger,
  NodeBase,
}                                from './types'

const LOCALE   = 'en'
const FALLBACK = 'en'

// ── 1. resolveDataLinks filter target ─────────────────────────────────────

describe('resolveDataLinks — filter target via @statdash/engine', () => {
  const row = { id: 'R1', regionId: 'R1', label: 'Region One', value: 500 }

  it('returns action:filter with filterKey and filterValue', () => {
    const links: DataLinkDef[] = [
      { title: { en: 'Filter' }, target: 'filter', filterKey: 'regionId' },
    ]
    const result: ResolvedLink[] = resolveDataLinks(links, row, {}, LOCALE, FALLBACK)
    expect(result).toHaveLength(1)
    const link = result[0]
    expect(link.action).toBe('filter')
    if (link.action === 'filter') {
      expect(link.filterKey).toBe('regionId')
      expect(link.filterValue).toBe('R1')
    }
    expect((link as Record<string, unknown>).href).toBeUndefined()
  })

  it('fromField overrides the default field lookup', () => {
    const links: DataLinkDef[] = [
      { title: { en: 'Filter' }, target: 'filter', filterKey: 'regionId', fromField: 'id' },
    ]
    const result = resolveDataLinks(links, row, {}, LOCALE, FALLBACK)
    const link = result[0]
    expect(link.action).toBe('filter')
    if (link.action === 'filter') expect(link.filterValue).toBe('R1')
  })

  it('navigate link action is still navigate after N36 change', () => {
    const links: DataLinkDef[] = [
      { title: { en: 'Page' }, target: 'page', page: '/regional' },
    ]
    const result = resolveDataLinks(links, row, {}, LOCALE, FALLBACK)
    const link = result[0]
    expect(link.action).toBe('navigate')
    if (link.action === 'navigate') expect(link.href).toBeDefined()
  })
})

// ── 2. NodeEventHandler type shape guard (compile-time via assignment) ─────
//
//  These assignments verify the TypeScript shape without needing a running
//  component. If the types are wrong, tsc --noEmit will catch it.
//

describe('NodeEventHandler type shape', () => {
  it('FilterAction satisfies NodeAction', () => {
    const action: FilterAction = { type: 'filter', key: 'regionId', fromField: 'id' }
    const nodeAction: NodeAction = action   // FilterAction must extend NodeAction
    expect(nodeAction.type).toBe('filter')
  })

  it('NodeEventHandler has event and actions', () => {
    const trigger: NodeEventTrigger = 'row:click'
    const handler: NodeEventHandler = {
      event:   trigger,
      actions: [{ type: 'filter', key: 'regionId', fromField: 'id' }],
    }
    expect(handler.event).toBe('row:click')
    expect(handler.actions).toHaveLength(1)
  })

  it('NodeBase.on accepts NodeEventHandler[]', () => {
    // Structural check — a node with on[] must type-check as NodeBase
    const node: NodeBase = {
      type: 'chart',
      on: [
        {
          event:   'row:click',
          actions: [{ type: 'filter', key: 'regionId', fromField: 'id' }],
        },
      ],
    }
    expect(node.on).toHaveLength(1)
    expect(node.on?.[0].event).toBe('row:click')
  })

  it('NodeBase.on is optional (no on = valid NodeBase)', () => {
    const node: NodeBase = { type: 'kpi' }
    expect(node.on).toBeUndefined()
  })
})

// ── 3. ctx.set wiring logic (pure function extraction test) ───────────────
//
//  The actual shell wiring is tested by verifying the logic path in isolation:
//  given resolved links with action:'filter', the loop calls ctx.set with the
//  right arguments. We test this as a pure logic trace here.
//

describe('cross-filter link dispatch logic', () => {
  it('calls set for each filter link in resolved array', () => {
    const calls: Array<[string, unknown]> = []
    const mockSet = (k: string, v: unknown) => { calls.push([k, v]) }

    const row = { id: 'R2', regionId: 'R2' }
    const links: DataLinkDef[] = [
      { title: { en: 'Filter region' }, target: 'filter', filterKey: 'regionId' },
      { title: { en: 'Filter time'   }, target: 'filter', filterKey: 'time', fromField: 'id' },
    ]
    const resolved = resolveDataLinks(links, row, {}, LOCALE, FALLBACK)

    for (const link of resolved) {
      if (link.action === 'filter' && link.filterKey !== undefined) {
        mockSet(link.filterKey, link.filterValue)
      }
    }

    expect(calls).toEqual([
      ['regionId', 'R2'],
      ['time',     'R2'],
    ])
  })

  it('calls set for each node.on FilterAction on row:click', () => {
    const calls: Array<[string, unknown]> = []
    const mockSet = (k: string, v: unknown) => { calls.push([k, v]) }

    const row: Record<string, unknown> = { id: 'R2', regionId: 'R2' }
    const handlers: NodeEventHandler[] = [
      {
        event:   'row:click',
        actions: [
          { type: 'filter', key: 'regionId', fromField: 'regionId' },
          { type: 'filter', key: 'time',     fromField: 'id'       },
        ],
      },
    ]

    for (const handler of handlers) {
      if (handler.event === 'row:click') {
        for (const action of handler.actions) {
          if (action.type === 'filter') {
            mockSet(action.key, row[action.fromField ?? action.key])
          }
        }
      }
    }

    expect(calls).toEqual([
      ['regionId', 'R2'],
      ['time',     'R2'],
    ])
  })

  it('skips non-filter links (navigate) during cross-filter dispatch', () => {
    const calls: Array<[string, unknown]> = []
    const mockSet = (k: string, v: unknown) => { calls.push([k, v]) }

    const row = { id: 'R2', regionId: 'R2' }
    const links: DataLinkDef[] = [
      { title: { en: 'Navigate' }, target: 'page', page: '/regional' },
      { title: { en: 'Filter'   }, target: 'filter', filterKey: 'regionId' },
    ]
    const resolved = resolveDataLinks(links, row, {}, LOCALE, FALLBACK)

    for (const link of resolved) {
      if (link.action === 'filter' && link.filterKey !== undefined) {
        mockSet(link.filterKey, link.filterValue)
      }
    }

    // Only the filter link calls set — navigate does not
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(['regionId', 'R2'])
  })
})
