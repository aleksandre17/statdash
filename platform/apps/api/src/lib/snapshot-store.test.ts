import { describe, it, expect } from 'vitest'
import { createSnapshotStore, type StoredSnapshot, type PageDataSnapshot } from './snapshot-store.js'

const snap = (): PageDataSnapshot => ({ generatedAt: new Date().toISOString() })

const entry = (): StoredSnapshot => ({ snapshot: snap(), createdAt: Date.now(), params: {} })

describe('createSnapshotStore (LRU)', () => {
  it('stores and retrieves by token', async () => {
    const store = createSnapshotStore(100)
    const e = entry()
    await store.set('t1', e)
    expect(await store.get('t1')).toBe(e)
    expect(await store.get('missing')).toBeUndefined()
  })

  it('evicts the least-recently-used entry past capacity', async () => {
    const store = createSnapshotStore(2)
    await store.set('a', entry())
    await store.set('b', entry())
    await store.set('c', entry()) // evicts 'a'
    expect(await store.get('a')).toBeUndefined()
    expect(await store.get('b')).toBeDefined()
    expect(await store.get('c')).toBeDefined()
  })

  it('a get() marks recency, sparing an entry from eviction', async () => {
    const store = createSnapshotStore(2)
    await store.set('a', entry())
    await store.set('b', entry())
    await store.get('a')          // 'a' now most-recent; 'b' is LRU
    await store.set('c', entry()) // evicts 'b', not 'a'
    expect(await store.get('a')).toBeDefined()
    expect(await store.get('b')).toBeUndefined()
    expect(await store.get('c')).toBeDefined()
  })
})
