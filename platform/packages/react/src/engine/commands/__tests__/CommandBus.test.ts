// ── CommandBus unit tests ──────────────────────────────────────────────────
//
//  Covers: dispatch · handler registration · duplicate guard · missing-handler
//  guard · middleware veto · middleware priority ordering.
//
//  All platform command types are available — tests use 'filter:set' as the
//  simplest payload shape; the dispatch/middleware logic is type-independent.
//

import { describe, it, expect, vi } from 'vitest'
import { DefaultCommandBus } from '../CommandBus'

describe('DefaultCommandBus', () => {
  it('dispatches to registered handler', () => {
    const bus = new DefaultCommandBus()
    const handler = vi.fn()
    bus.handle('filter:set', handler)
    bus.dispatch({ type: 'filter:set', key: 'year', value: '2024' })
    expect(handler).toHaveBeenCalledWith({ type: 'filter:set', key: 'year', value: '2024' })
  })

  it('throws on duplicate handler registration', () => {
    const bus = new DefaultCommandBus()
    bus.handle('filter:set', vi.fn())
    expect(() => bus.handle('filter:set', vi.fn())).toThrow('already registered')
  })

  it('throws when dispatching with no handler registered', () => {
    const bus = new DefaultCommandBus()
    expect(() => bus.dispatch({ type: 'filter:set', key: 'x', value: 'y' })).toThrow('no handler')
  })

  it('middleware can veto by not calling next()', () => {
    const bus = new DefaultCommandBus()
    const handler = vi.fn()
    bus.handle('filter:set', handler)
    bus.use({ intercept: (_cmd, _next) => { /* veto — do not call next */ } })
    bus.dispatch({ type: 'filter:set', key: 'year', value: '2024' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('middleware runs in ascending priority order', () => {
    const order: number[] = []
    const bus = new DefaultCommandBus()
    bus.handle('filter:set', vi.fn())
    // Register higher priority (10) first, then lower (1) — expect [1, 10]
    bus.use({ priority: 10, intercept: (_, next) => { order.push(10); next() } })
    bus.use({ priority: 1,  intercept: (_, next) => { order.push(1);  next() } })
    bus.dispatch({ type: 'filter:set', key: 'x', value: 'y' })
    expect(order).toEqual([1, 10])
  })

  it('multiple middleware in chain all run when none veto', () => {
    const calls: string[] = []
    const bus = new DefaultCommandBus()
    bus.handle('filter:set', vi.fn())
    bus.use({ name: 'a', intercept: (_, next) => { calls.push('a'); next() } })
    bus.use({ name: 'b', intercept: (_, next) => { calls.push('b'); next() } })
    bus.dispatch({ type: 'filter:set', key: 'x', value: 'y' })
    expect(calls).toEqual(['a', 'b'])
  })

  it('middleware without priority sorts after those with priority', () => {
    const order: string[] = []
    const bus = new DefaultCommandBus()
    bus.handle('filter:set', vi.fn())
    bus.use({ name: 'no-prio', intercept: (_, next) => { order.push('no-prio'); next() } })
    bus.use({ priority: 5, name: 'prio-5', intercept: (_, next) => { order.push('prio-5'); next() } })
    bus.dispatch({ type: 'filter:set', key: 'x', value: 'y' })
    expect(order).toEqual(['prio-5', 'no-prio'])
  })

  it('different command types can each have their own handler', () => {
    const bus = new DefaultCommandBus()
    const filterHandler       = vi.fn()
    const perspectiveHandler  = vi.fn()
    bus.handle('filter:set', filterHandler)
    bus.handle('perspective:set', perspectiveHandler)
    bus.dispatch({ type: 'filter:set', key: 'k', value: 'v' })
    bus.dispatch({ type: 'perspective:set', id: 'year' })
    expect(filterHandler).toHaveBeenCalledTimes(1)
    expect(perspectiveHandler).toHaveBeenCalledTimes(1)
  })
})
