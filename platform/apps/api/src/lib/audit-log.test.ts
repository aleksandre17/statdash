import { describe, it, expect } from 'vitest'
import { createInMemoryAuditLogger } from './audit-log.js'

describe('createInMemoryAuditLogger (ring buffer)', () => {
  it('stamps ts and returns entries newest-first', () => {
    const audit = createInMemoryAuditLogger(10)
    audit.log({ action: 'a' })
    audit.log({ action: 'b' })
    audit.log({ action: 'c' })

    const recent = audit.recent()
    expect(recent.map(e => e.action)).toEqual(['c', 'b', 'a'])
    // ts is stamped by the logger (caller never supplies it).
    expect(recent.every(e => typeof e.ts === 'string' && e.ts.length > 0)).toBe(true)
  })

  it('recent(N) returns the N newest entries, newest-first', () => {
    const audit = createInMemoryAuditLogger(100)
    for (let i = 0; i < 5; i++) audit.log({ action: `act-${i}` })
    expect(audit.recent(2).map(e => e.action)).toEqual(['act-4', 'act-3'])
  })

  it('evicts oldest on overflow (FIFO, bounded memory)', () => {
    const audit = createInMemoryAuditLogger(3)
    audit.log({ action: '1' })
    audit.log({ action: '2' })
    audit.log({ action: '3' })
    audit.log({ action: '4' }) // evicts '1'

    const all = audit.recent()
    expect(all).toHaveLength(3)
    expect(all.map(e => e.action)).toEqual(['4', '3', '2'])
    expect(all.some(e => e.action === '1')).toBe(false)
  })

  it('recent(N) where N exceeds held count returns all held', () => {
    const audit = createInMemoryAuditLogger(10)
    audit.log({ action: 'only' })
    expect(audit.recent(50).map(e => e.action)).toEqual(['only'])
  })

  it('recent(0) returns nothing', () => {
    const audit = createInMemoryAuditLogger(10)
    audit.log({ action: 'x' })
    expect(audit.recent(0)).toEqual([])
  })

  it('preserves userId, resource, and payload on the entry', () => {
    const audit = createInMemoryAuditLogger(10)
    audit.log({ userId: 'u1', action: 'config.save', resource: 'page-1', payload: { v: 2 } })
    const [e] = audit.recent()
    expect(e).toMatchObject({ userId: 'u1', action: 'config.save', resource: 'page-1', payload: { v: 2 } })
  })
})
