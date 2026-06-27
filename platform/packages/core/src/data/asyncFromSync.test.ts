import { describe, it, expect, vi } from 'vitest'
import type { DataStore, StoreQuery, QueryResult } from './store'
import { asyncFromSync }                           from './store'
import type { SectionContext }                     from '../core/context'

// ── minimal fixtures ───────────────────────────────────────────────────

const ctx: SectionContext = {
  dims: { time: 2024 },
}

const q: StoreQuery = { type: 'val', code: 'GDP' }

function makeStore(impl: DataStore['querySync']): DataStore {
  return {
    querySync: impl,
    caps: { queryTypes: ['val'], batching: false, streaming: false, sync: true },
  }
}

// ── asyncFromSync ──────────────────────────────────────────────────────

describe('asyncFromSync', () => {
  it('wraps a sync store — done state with data on success', async () => {
    const row = { value: 42 }
    const store = makeStore(() => [row])

    const fn = asyncFromSync(store)
    const result: QueryResult = await fn(q, ctx)

    expect(result.state).toBe('done')
    expect(result.data).toEqual([row])
    expect(result.error).toBeUndefined()
  })

  it('wraps error — state:error with error message on throw', async () => {
    const store = makeStore(() => { throw new Error('data unavailable') })

    const fn = asyncFromSync(store)
    const result: QueryResult = await fn(q, ctx)

    expect(result.state).toBe('error')
    expect(result.error).toBe('data unavailable')
    expect(result.data).toEqual([])
  })

  it('does not throw — always returns a Promise even on non-Error throws', async () => {
    const store = makeStore(() => { throw 'string error' })

    const fn = asyncFromSync(store)
    const resultPromise = fn(q, ctx)

    await expect(resultPromise).resolves.toMatchObject({
      state: 'error',
      error: 'string error',
    })
  })

  it('forwards the rows returned by querySync unchanged', async () => {
    const rows = [{ value: 1 }, { value: 2 }, { value: 3 }]
    const store = makeStore(() => rows)

    const fn = asyncFromSync(store)
    const result = await fn(q, ctx)

    expect(result.data).toBe(rows) // same reference — no copy
  })

  it('calls querySync with the exact q and ctx arguments', async () => {
    const spy = vi.fn().mockReturnValue([])
    const store = makeStore(spy)

    const fn = asyncFromSync(store)
    await fn(q, ctx)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(q, ctx)
  })
})
