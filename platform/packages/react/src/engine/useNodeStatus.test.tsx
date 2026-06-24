// @vitest-environment jsdom
//
// ── useNodeStatus — 'node:status' publish seam fitness test (Pattern E) ─────
//
//  Pins the contract:
//    1. deriveNodeStatus: rows>0 → 'ok'; empty/absent → 'empty'; hasError → 'error'.
//    2. The hook publishes 'node:status' on ctx.eventBus on first mount.
//    3. It DEDUPES — no re-publish when status is unchanged across renders.
//    4. It re-publishes when status transitions (empty → ok).
//

import { describe, it, expect, vi } from 'vitest'
import { render, cleanup }          from '@testing-library/react'
import { createElement }            from 'react'
import { EventBus }                 from '../events/EventBus'
import type { PlatformEventMap }    from '../events/events'
import { useNodeStatus, deriveNodeStatus } from './useNodeStatus'
import type { RenderContext }       from './types'
import type { DataRow }             from '@statdash/engine'

function ctxWithBus(bus: EventBus<PlatformEventMap>): RenderContext {
  return { eventBus: bus } as unknown as RenderContext
}

function Harness({ ctx, rows, hasError }: { ctx: RenderContext; rows?: DataRow[]; hasError?: boolean }) {
  useNodeStatus(ctx, 'chart', rows, 'n1', hasError)
  return null
}

describe('deriveNodeStatus', () => {
  it('maps rows>0 → ok, empty/absent → empty, error flag → error', () => {
    expect(deriveNodeStatus([{ a: 1 }] as unknown as DataRow[])).toBe('ok')
    expect(deriveNodeStatus([])).toBe('empty')
    expect(deriveNodeStatus(undefined)).toBe('empty')
    expect(deriveNodeStatus([{ a: 1 }] as unknown as DataRow[], true)).toBe('error')
  })
})

describe('useNodeStatus — publish seam', () => {
  it('publishes node:status on mount with attribution', () => {
    const bus = new EventBus<PlatformEventMap>()
    const seen = vi.fn()
    bus.subscribe('node:status', seen)

    render(createElement(Harness, { ctx: ctxWithBus(bus), rows: [{ a: 1 }] as unknown as DataRow[] }))
    expect(seen).toHaveBeenCalledWith({ nodeId: 'n1', nodeType: 'chart', status: 'ok' })
    cleanup()
  })

  it('dedupes — no re-publish when status is unchanged on re-render', () => {
    const bus = new EventBus<PlatformEventMap>()
    const seen = vi.fn()
    bus.subscribe('node:status', seen)

    const ctx = ctxWithBus(bus)
    const { rerender } = render(createElement(Harness, { ctx, rows: [{ a: 1 }] as unknown as DataRow[] }))
    rerender(createElement(Harness, { ctx, rows: [{ a: 2 }] as unknown as DataRow[] })) // still 'ok'
    expect(seen).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('re-publishes on a status transition (empty → ok)', () => {
    const bus = new EventBus<PlatformEventMap>()
    const seen = vi.fn()
    bus.subscribe('node:status', seen)

    const ctx = ctxWithBus(bus)
    const { rerender } = render(createElement(Harness, { ctx, rows: [] }))            // empty
    rerender(createElement(Harness, { ctx, rows: [{ a: 1 }] as unknown as DataRow[] })) // ok
    expect(seen).toHaveBeenCalledTimes(2)
    expect(seen).toHaveBeenLastCalledWith({ nodeId: 'n1', nodeType: 'chart', status: 'ok' })
    cleanup()
  })
})
