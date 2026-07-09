// ── FF-NOTIFY-PORT — the panel's own toast seam (store) ────────────────────────
//
//  notify.ts is the ISP-clean replacement for the one live capability react-admin
//  carried (a toast hook). These tests lock the port's behaviour — queue / notify /
//  dismiss — and its react-admin call-signature compatibility, so a call site can be
//  relocated off useNotify() with a one-line import swap and identical semantics.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotifyStore, useToast } from './notify'

// The store is a module-global singleton — clear its queue between cases.
beforeEach(() => { useNotifyStore.setState({ queue: [] }) })

describe('notify store — queue / notify / dismiss', () => {
  it('starts with an empty queue', () => {
    expect(useNotifyStore.getState().queue).toEqual([])
  })

  it('notify() enqueues a toast, defaulting the type to info', () => {
    useNotifyStore.getState().notify('saved')
    const { queue } = useNotifyStore.getState()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ message: 'saved', type: 'info' })
    expect(typeof queue[0].id).toBe('number')
  })

  it('honours an explicit type', () => {
    useNotifyStore.getState().notify('boom', { type: 'error' })
    expect(useNotifyStore.getState().queue[0]).toMatchObject({ message: 'boom', type: 'error' })
  })

  it('preserves FIFO order and assigns unique ids across multiple notifies', () => {
    const { notify } = useNotifyStore.getState()
    notify('a'); notify('b', { type: 'success' }); notify('c', { type: 'warning' })
    const { queue } = useNotifyStore.getState()
    expect(queue.map((t) => t.message)).toEqual(['a', 'b', 'c'])
    expect(new Set(queue.map((t) => t.id)).size).toBe(3) // ids are unique
  })

  it('dismiss() removes only the targeted toast, leaving the rest in order', () => {
    const { notify } = useNotifyStore.getState()
    notify('a'); notify('b'); notify('c')
    const [, second] = useNotifyStore.getState().queue
    useNotifyStore.getState().dismiss(second.id)
    expect(useNotifyStore.getState().queue.map((t) => t.message)).toEqual(['a', 'c'])
  })

  it('dismiss() of an unknown id is a no-op (never throws)', () => {
    useNotifyStore.getState().notify('a')
    expect(() => useNotifyStore.getState().dismiss(-999)).not.toThrow()
    expect(useNotifyStore.getState().queue).toHaveLength(1)
  })
})

describe('useToast — react-admin useNotify() call-signature compatibility', () => {
  it('returns a stable notify action usable as notify(message, { type })', () => {
    const { result, rerender } = renderHook(() => useToast())
    const first = result.current
    expect(typeof first).toBe('function')

    // The RA-compatible call shape — a one-line swap from useNotify().
    act(() => { result.current('done', { type: 'success' }) })
    expect(useNotifyStore.getState().queue[0]).toMatchObject({ message: 'done', type: 'success' })

    // Stable reference across renders (the action identity does not churn).
    rerender()
    expect(result.current).toBe(first)
  })
})
