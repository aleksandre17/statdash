import { describe, it, expect } from 'vitest'
import { createSnapshotStore, type StoredSnapshot, type PageDataSnapshot } from './snapshot-store.js'

const snap = (): PageDataSnapshot => ({ generatedAt: new Date().toISOString() })

const entry = (): StoredSnapshot => ({ snapshot: snap(), createdAt: Date.now(), params: {} })

describe('createSnapshotStore (LRU)', () => {
  it('stores and retrieves by token', () => {
    const store = createSnapshotStore(100)
    const e = entry()
    store.set('t1', e)
    expect(store.get('t1')).toBe(e)
    expect(store.get('missing')).toBeUndefined()
  })

  it('evicts the least-recently-used entry past capacity', () => {
    const store = createSnapshotStore(2)
    store.set('a', entry())
    store.set('b', entry())
    store.set('c', entry()) // evicts 'a'
    expect(store.get('a')).toBeUndefined()
    expect(store.get('b')).toBeDefined()
    expect(store.get('c')).toBeDefined()
    expect(store.size).toBe(2)
  })

  it('a get() marks recency, sparing an entry from eviction', () => {
    const store = createSnapshotStore(2)
    store.set('a', entry())
    store.set('b', entry())
    store.get('a')          // 'a' now most-recent; 'b' is LRU
    store.set('c', entry()) // evicts 'b', not 'a'
    expect(store.get('a')).toBeDefined()
    expect(store.get('b')).toBeUndefined()
    expect(store.get('c')).toBeDefined()
  })
})
