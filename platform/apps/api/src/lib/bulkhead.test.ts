import { describe, it, expect } from 'vitest'
import { createBulkhead, BulkheadRejectedError } from './bulkhead.js'

/** A task that resolves when we tell it to (a controllable in-flight slot). */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe('createBulkhead (API-11 load shedding)', () => {
  it('runs up to maxConcurrent immediately and reports active', async () => {
    const bh = createBulkhead({ name: 't', maxConcurrent: 2, maxQueue: 0 })
    const a = deferred(); const b = deferred()
    const ra = bh.run(() => a.promise)
    const rb = bh.run(() => b.promise)
    expect(bh.active).toBe(2)
    a.resolve(); b.resolve()
    await Promise.all([ra, rb])
    expect(bh.active).toBe(0)
  })

  it('queues a burst up to maxQueue, then SHEDS (fail-fast 429 path)', async () => {
    let shed = 0
    const bh = createBulkhead({ name: 't', maxConcurrent: 1, maxQueue: 1, onShed: () => { shed++ } })
    const a = deferred(); const b = deferred()

    const ra = bh.run(() => a.promise) // runs (slot)
    const rb = bh.run(() => b.promise) // queued (1 waiter)
    // Third is beyond 1 running + 1 queued → shed.
    await expect(bh.run(async () => {})).rejects.toBeInstanceOf(BulkheadRejectedError)
    expect(shed).toBe(1)

    // Drain: a completes → b promoted and runs.
    a.resolve()
    await ra
    b.resolve()
    await rb
    expect(bh.active).toBe(0)
    expect(bh.queued).toBe(0)
  })

  it('a freed slot promotes the next waiter (FIFO)', async () => {
    const order: number[] = []
    const bh = createBulkhead({ name: 't', maxConcurrent: 1, maxQueue: 5 })
    const gate = deferred()
    const first = bh.run(async () => { await gate.promise; order.push(1) })
    const second = bh.run(async () => { order.push(2) })
    gate.resolve()
    await Promise.all([first, second])
    expect(order).toEqual([1, 2])
  })
})
