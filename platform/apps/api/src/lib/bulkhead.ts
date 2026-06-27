// ── Bulkhead — bounded concurrency + load shedding (API-11 / API-14) ──────────
//
//  The canonical upload runs a SYNCHRONOUS in-process drive (parse → stage →
//  publish reference → stage facts) over the pg pool. A handful of concurrent
//  large uploads saturate BOTH the event loop and the pool — a resource-
//  exhaustion DoS vector. The 25 MB bodyLimit guards SIZE; this guards
//  CONCURRENCY: at most `maxConcurrent` uploads run at once, a small `maxQueue`
//  absorbs a burst, and anything beyond is LOAD-SHED (fail-fast 429) rather than
//  piling onto a saturated server (the Bulkhead + Load-Shedding resilience
//  patterns, SKILL §3).
//
//  Generic + framework-free (no Fastify, no Problem import): a reusable concurrency
//  primitive. The caller translates a shed into its transport error (the route
//  maps BulkheadRejectedError → RFC 9457 429). Lifecycle callbacks feed the
//  telemetry port without coupling the primitive to the metric names.

/** Thrown by run() when the bulkhead is full (both slots AND queue saturated). */
export class BulkheadRejectedError extends Error {
  constructor(public readonly name: string) {
    super(`bulkhead '${name}' is saturated — request shed`)
    this.name = 'BulkheadRejectedError'
  }
}

export interface BulkheadOptions {
  /** Stable name for diagnostics. */
  readonly name: string
  /** Max tasks running concurrently. */
  readonly maxConcurrent: number
  /** Max tasks waiting for a slot before new tasks are shed. */
  readonly maxQueue: number
  /** Called when a task is shed (queue full) — wire the shed counter here. */
  readonly onShed?: () => void
  /** Called whenever the active count changes — wire the in-flight gauge here. */
  readonly onChange?: (active: number, queued: number) => void
}

export interface Bulkhead {
  /** Run `task` under the concurrency limit, or throw BulkheadRejectedError if full. */
  run<T>(task: () => Promise<T>): Promise<T>
  readonly active: number
  readonly queued: number
}

/**
 * A semaphore with a bounded FIFO waiter queue. Acquire → run → release, with the
 * next waiter promoted on release. Past `maxConcurrent + maxQueue` in flight, run()
 * rejects synchronously (load-shed) — the caller never blocks unboundedly.
 */
export function createBulkhead(opts: BulkheadOptions): Bulkhead {
  const { name, maxConcurrent, maxQueue, onShed, onChange } = opts
  let active = 0
  const waiters: Array<() => void> = []

  const notify = (): void => onChange?.(active, waiters.length)

  const release = (): void => {
    active -= 1
    const next = waiters.shift()
    if (next) {
      active += 1
      next() // promote the next waiter into a running slot
    }
    notify()
  }

  const acquire = async (): Promise<void> => {
    if (active < maxConcurrent) {
      active += 1
      notify()
      return
    }
    if (waiters.length >= maxQueue) {
      onShed?.()
      throw new BulkheadRejectedError(name)
    }
    // Wait for a freed slot; the resolver promotes us (active already incremented).
    await new Promise<void>((resolve) => {
      waiters.push(resolve)
      notify()
    })
  }

  return {
    async run(task) {
      await acquire()
      try {
        return await task()
      } finally {
        release()
      }
    },
    get active() { return active },
    get queued() { return waiters.length },
  }
}
