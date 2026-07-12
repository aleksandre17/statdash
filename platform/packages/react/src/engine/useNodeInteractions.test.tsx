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
    // Ref-lowering services for state-bound `{$ctx}` action fields (AR-38 §4.1).
    sectionCtx:   { dims: {} },
    vars:         {},
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

  // ── AR-38 §4.1 — state-bound `{$ctx:_selKey}` action key (the composition pivot) ──
  //  The composition table's row:click writes `key:{$ctx:_selKey}`. `_selKey` is a page
  //  var resolving to `region` — so the SAME handler targets the `region` param whether
  //  the table is a SimpleTable (State A: rows=region) or a PivotTable (State B: region
  //  on the series/column axis, click emits a representative row whose id is the region
  //  code). The rotation targets `region` in BOTH states — this is the fix's spine.
  describe('FF-ACTION-KEY-POSTEL — state-bound {$ctx} key rotates via the one write point', () => {
    const def = {
      type: 'table',
      on: [{ event: 'row:click', actions: [
        { type: 'filter', key: { $ctx: '_selKey' }, fromField: 'id', mode: 'toggle', max: 10 },
      ] }],
    } as unknown as NodeBase

    it('State A (SimpleTable row) → writes the region param (key resolved from vars)', () => {
      const { ctx, dispatch } = mockCtx({
        vars: { _selKey: 'region' }, sectionCtx: { dims: {} } as never, filterParams: {},
      })
      const { result } = renderHook(() => useNodeInteractions(def, ctx))
      result.current.emit('row:click', { id: 'R2' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R2' })
    })

    it('State B (pivot series-representative row) → adds a 2nd region to the SAME param', () => {
      const { ctx, dispatch } = mockCtx({
        vars: { _selKey: 'region' }, sectionCtx: { dims: {} } as never,
        filterParams: { region: 'R2' },
      })
      const { result } = renderHook(() => useNodeInteractions(def, ctx))
      // The pivot emits a representative row of the clicked region series (id = code).
      result.current.emit('row:click', { id: 'R5', series: 'Imereti', label: 'Agriculture' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R2,R5' })
    })

    it('a `$ctx` key preferring dims over vars still resolves (one dispatcher, dims→vars)', () => {
      const { ctx, dispatch } = mockCtx({
        vars: {}, sectionCtx: { dims: { _selKey: 'region' } } as never,
      })
      const { result } = renderHook(() => useNodeInteractions(def, ctx))
      result.current.emit('row:click', { id: 'R9' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'region', value: 'R9' })
    })
  })

  // ── AR-42 P1 — the additive union arms (HighlightAction · interval:brush) ────
  //  Both ride the EXACT same applySelection/CommandBus spine as FilterAction — no
  //  second interaction plane (FF-XF-ONE-WRITE-POINT). A highlight styles a Consumer
  //  without scoping a query (the param it writes is read by an encoding condition,
  //  never query.filter); an interval:brush folds a [lo,hi] range through the new
  //  applySelection `interval` mode into a range param.
  describe('AR-42 P1 — highlight arm rides the one write point', () => {
    it('a row:hover highlight reaches the ONE write point (filter:set, transient param)', () => {
      const def = {
        type: 'chart',
        on: [{ event: 'row:hover', actions: [{ type: 'highlight', key: 'hl_sector', fromField: 'sector' }] }],
      } as unknown as NodeBase
      const { ctx, dispatch } = mockCtx()
      const { result } = renderHook(() => useNodeInteractions(def, ctx))

      result.current.emit('row:hover', { sector: 'A' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'hl_sector', value: 'A' })
    })

    it('a filter + a highlight on one gesture dispatch atomically through the SAME spine', () => {
      const def = {
        type: 'chart',
        on: [{ event: 'point:click', actions: [
          { type: 'filter',    key: 'sector', fromField: 'sector' },
          { type: 'highlight', key: 'hl_geo', fromField: 'geo'    },
        ] }],
      } as unknown as NodeBase
      const { ctx, dispatch } = mockCtx()
      const { result } = renderHook(() => useNodeInteractions(def, ctx))

      result.current.emit('point:click', { sector: 'A', geo: 'R2' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:setMany', values: { sector: 'A', hl_geo: 'R2' } })
    })
  })

  describe('AR-42 P1 — interval:brush folds a [lo,hi] range', () => {
    it('a brush emits a normalized range param (min,max) via the interval mode', () => {
      const def = {
        type: 'chart',
        on: [{ event: 'interval:brush', actions: [
          { type: 'filter', key: 'year', fromField: 'range', mode: 'interval' },
        ] }],
      } as unknown as NodeBase
      const { ctx, dispatch } = mockCtx()
      const { result } = renderHook(() => useNodeInteractions(def, ctx))

      // The brush surface hands the two bounds (any order) as the encoded field value.
      result.current.emit('interval:brush', { range: '2020,2010' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'year', value: '2010,2020' })
    })

    it('a degenerate/empty brush clears the range param', () => {
      const def = {
        type: 'chart',
        on: [{ event: 'interval:brush', actions: [
          { type: 'filter', key: 'year', fromField: 'range', mode: 'interval' },
        ] }],
      } as unknown as NodeBase
      const { ctx, dispatch } = mockCtx({ filterParams: { year: '2010,2020' } })
      const { result } = renderHook(() => useNodeInteractions(def, ctx))

      result.current.emit('interval:brush', { range: '' })
      expect(dispatch).toHaveBeenCalledWith({ type: 'filter:set', key: 'year', value: '' })
    })
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
