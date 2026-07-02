// @vitest-environment jsdom
//
// ── useNodeInteractions — the ONE cross-filter adapter (dispatch tests) ─────
//
//  Replaces the old crossFilter mock-loop with the REAL hook: a gesture on a
//  node.on[]/dataLinks folds through applySelection and writes via ctx.bus.
//  Encodes FF-XF-SELECT-WRITES (a selection gesture reaches the ONE write point)
//  and the multi-action atomicity (filter:setMany).
//

import { describe, it, expect, vi }  from 'vitest'
import { renderHook }                 from '@testing-library/react'
import { useNodeInteractions }        from './useNodeInteractions'
import type { RenderContext }         from './types'
import type { NodeBase }              from './types'

function mockCtx(overrides: Partial<RenderContext> = {}): { ctx: RenderContext; dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn()
  const ctx = {
    filterParams: {},
    resolveLinks: () => [],
    bus:          { dispatch },
    ...overrides,
  } as unknown as RenderContext
  return { ctx, dispatch }
}

describe('useNodeInteractions — FF-XF-SELECT-WRITES', () => {
  it('a row:click on a node.on[] filter reaches the ONE write point (filter:set)', () => {
    const def = {
      type: 'table',
      on: [{ event: 'row:click', actions: [{ type: 'filter', key: 'region', fromField: 'id' }] }],
    } as unknown as NodeBase
    const { ctx, dispatch } = mockCtx()
    const { result } = renderHook(() => useNodeInteractions(def, ctx))

    result.current.emit('row:click', { id: 'R2' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R2' })
  })

  it('toggle mode accumulates against the current param (multi-select CSV)', () => {
    const def = {
      type: 'geograph',
      on: [{ event: 'selection:change', actions: [{ type: 'filter', key: 'region', mode: 'toggle', max: 2 }] }],
    } as unknown as NodeBase
    const { ctx, dispatch } = mockCtx({ filterParams: { region: 'R2' } })
    const { result } = renderHook(() => useNodeInteractions(def, ctx))

    result.current.emit('selection:change', { region: 'R3' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R2,R3' })
  })

  it('multiple actions on one gesture dispatch atomically (filter:setMany)', () => {
    const def = {
      type: 'chart',
      on: [{
        event: 'point:click',
        actions: [
          { type: 'filter', key: 'region', fromField: 'geo' },
          { type: 'filter', key: 'sector', fromField: 'sector' },
        ],
      }],
    } as unknown as NodeBase
    const { ctx, dispatch } = mockCtx()
    const { result } = renderHook(() => useNodeInteractions(def, ctx))

    result.current.emit('point:click', { geo: 'R2', sector: 'A' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'filter:setMany', values: { region: 'R2', sector: 'A' } })
  })

  it('folds the dataLinks target:filter branch (the historically dropped path)', () => {
    const def = {
      type: 'chart',
      dataLinks: [{ title: { en: 'F' }, target: 'filter', filterKey: 'region' }],
    } as unknown as NodeBase
    const { ctx, dispatch } = mockCtx({
      resolveLinks: () => [{ action: 'filter', title: 'F', filterKey: 'region', filterValue: 'R5' }],
    })
    const { result } = renderHook(() => useNodeInteractions(def, ctx))

    result.current.emit('point:click', { region: 'R5' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R5' })
  })

  it('is inert when no handler matches the trigger (no write)', () => {
    const def = {
      type: 'table',
      on: [{ event: 'row:click', actions: [{ type: 'filter', key: 'region' }] }],
    } as unknown as NodeBase
    const { ctx, dispatch } = mockCtx()
    const { result } = renderHook(() => useNodeInteractions(def, ctx))

    result.current.emit('point:click', { region: 'R2' })   // wrong trigger
    expect(dispatch).not.toHaveBeenCalled()
  })
})
