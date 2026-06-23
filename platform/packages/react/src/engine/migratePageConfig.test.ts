// @vitest-environment node
//
// ── migratePageConfig tests — N19 schema migration runner ──────────────
//
//  Tests the page-level migration runner.
//  Uses the singleton nodeRegistry — registers unique type strings per-test
//  to avoid cross-test interference (singleton persists across tests).
//
//  Reference: validatePageTree.test.ts (same pattern).
//

import { describe, it, expect, vi } from 'vitest'
import { migratePageConfig }         from './migratePageConfig'
import { nodeRegistry }              from './register-all'
import type { NodeBase, NodePageConfig } from './types'

// ── No-op shell (nodeRegistry requires a renderer even in config-only tests)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shell = (_node: any, _ctx: any, _children: any) => null

// ── Helpers ────────────────────────────────────────────────────────────

// Config-only fixtures use generic NodeBase children with arbitrary `type`
// strings (registered per-test), so the helper accepts the loose record form
// and casts at the NodePageConfig boundary — NodeDef's concrete discriminants
// are not relevant to the migration-traversal behaviour under test.
function makePage(overrides: { children?: NodeBase[] } & Record<string, unknown>): NodePageConfig {
  return {
    type:     'page',
    id:       'p1',
    children: [],
    ...overrides,
  } as unknown as NodePageConfig
}

// ── Reference equality — unchanged pages ───────────────────────────────

describe('migratePageConfig — same reference when nothing migrated', () => {

  it('returns the original page reference when no types have a migrate hook', () => {
    nodeRegistry.register('migrate-no-hook', 'default', shell, { version: 1 })

    const child: NodeBase = { type: 'migrate-no-hook', id: 'c1' }
    const page = makePage({ children: [child] })

    expect(migratePageConfig(page)).toBe(page)
  })

  it('returns the original page reference when node _version equals current version', () => {
    nodeRegistry.register('migrate-same-v', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2 } as unknown as NodeBase),
    })

    const child: NodeBase = { type: 'migrate-same-v', id: 'c2', _version: 2 } as NodeBase & { _version: number }
    const page = makePage({ children: [child] })

    expect(migratePageConfig(page)).toBe(page)
  })

  it('returns the original page reference for a page with no children', () => {
    const page = makePage({ children: [] })
    expect(migratePageConfig(page)).toBe(page)
  })

})

// ── Migration fires ────────────────────────────────────────────────────

describe('migratePageConfig — migration fires for stale nodes', () => {

  it('returns a NEW page reference when a node needs migration', () => {
    nodeRegistry.register('migrate-stale-v1', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2, migrated: true } as unknown as NodeBase),
    })

    const child: NodeBase = { type: 'migrate-stale-v1', id: 'c3' }
    const page = makePage({ children: [child] })

    const result = migratePageConfig(page)
    expect(result).not.toBe(page)
  })

  it('migrated node has the updated fields from the migrate hook', () => {
    nodeRegistry.register('migrate-enriched', 'default', shell, {
      version: 3,
      migrate: (old) => ({ ...old, _version: 3, extra: 'added' } as unknown as NodeBase),
    })

    const child: NodeBase = { type: 'migrate-enriched', id: 'c4' }
    const page = makePage({ children: [child] })

    const result = migratePageConfig(page)
    const migratedChild = (result as unknown as { children: NodeBase[] }).children[0]
    expect((migratedChild as unknown as Record<string, unknown>)['extra']).toBe('added')
  })

  it('stamps schemaVersion on the returned page after migration', () => {
    nodeRegistry.register('migrate-stamp-v', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2 } as unknown as NodeBase),
    })

    const child: NodeBase = { type: 'migrate-stamp-v', id: 'c5' }
    const page = makePage({ children: [child] })

    const result = migratePageConfig(page)
    expect(typeof result.schemaVersion).toBe('number')
    expect(result.schemaVersion).toBeGreaterThanOrEqual(1)
  })

  it('migrate hook is called with the correct fromVersion', () => {
    const migrateFn = vi.fn((old: Record<string, unknown>, _from: number) => ({ ...old, _version: 5 } as unknown as NodeBase))
    nodeRegistry.register('migrate-from-v', 'default', shell, {
      version: 5,
      migrate: migrateFn,
    })

    const child: NodeBase = { type: 'migrate-from-v', id: 'c6', _version: 3 } as NodeBase & { _version: number }
    const page = makePage({ children: [child] })

    migratePageConfig(page)

    expect(migrateFn).toHaveBeenCalledOnce()
    // Second argument is the stored version
    expect(migrateFn.mock.calls[0][1]).toBe(3)
  })

  it('only migrates the node that is behind; others keep their reference', () => {
    nodeRegistry.register('migrate-selective-a', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2 } as unknown as NodeBase),
    })
    nodeRegistry.register('migrate-selective-b', 'default', shell, { version: 1 })

    const childA: NodeBase = { type: 'migrate-selective-a', id: 'ca' }   // version 1 < 2 → migrates
    const childB: NodeBase = { type: 'migrate-selective-b', id: 'cb' }   // no migrate hook → same ref

    const page = makePage({ children: [childA, childB] })
    const result = migratePageConfig(page)
    const resultChildren = (result as unknown as { children: NodeBase[] }).children

    // childA was migrated → different reference
    expect(resultChildren[0]).not.toBe(childA)
    // childB was not migrated → same reference
    expect(resultChildren[1]).toBe(childB)
  })

})

// ── Deep tree traversal ────────────────────────────────────────────────

describe('migratePageConfig — deep tree traversal', () => {

  it('migrates a node at depth 2 and rebuilds the parent chain', () => {
    nodeRegistry.register('migrate-deep-outer', 'default', shell, { version: 1 })
    nodeRegistry.register('migrate-deep-inner', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2, deep: true } as unknown as NodeBase),
    })

    const grandchild: NodeBase = { type: 'migrate-deep-inner', id: 'gc1' }
    const parent: NodeBase     = { type: 'migrate-deep-outer', id: 'par', children: [grandchild] } as NodeBase & { children: NodeBase[] }
    const page = makePage({ children: [parent] })

    const result = migratePageConfig(page)

    expect(result).not.toBe(page)

    const resultParent = (result as unknown as { children: NodeBase[] }).children[0]
    expect(resultParent).not.toBe(parent)   // parent chain rebuilt

    const resultGrandchild = (resultParent as unknown as { children: NodeBase[] }).children[0]
    expect((resultGrandchild as unknown as Record<string, unknown>)['deep']).toBe(true)
  })

  it('same ref at all levels when deep node is already current', () => {
    nodeRegistry.register('migrate-deep-stable-outer', 'default', shell, { version: 1 })
    nodeRegistry.register('migrate-deep-stable-inner', 'default', shell, {
      version: 2,
      migrate: (old) => ({ ...old, _version: 2 } as unknown as NodeBase),
    })

    // Inner node at current version → no migration
    const grandchild: NodeBase = {
      type: 'migrate-deep-stable-inner', id: 'gc2',
      _version: 2,
    } as NodeBase & { _version: number }
    const parent: NodeBase     = { type: 'migrate-deep-stable-outer', id: 'par2', children: [grandchild] } as NodeBase & { children: NodeBase[] }
    const page = makePage({ children: [parent] })

    expect(migratePageConfig(page)).toBe(page)
  })

})
