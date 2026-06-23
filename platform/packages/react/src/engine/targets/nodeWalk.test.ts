// @vitest-environment node
//
// ── nodeWalk.test.ts — shared generic node-tree helpers ──────────────────────
//

import { describe, it, expect } from 'vitest'
import { isNodeObject, collectChildNodes } from './nodeWalk'

// ── isNodeObject ──────────────────────────────────────────────────────────────

describe('isNodeObject', () => {

  it('returns true for a plain object with a type string', () => {
    expect(isNodeObject({ type: 'panel', id: 'x' })).toBe(true)
  })

  it('returns true for an object whose only field is type', () => {
    expect(isNodeObject({ type: 'page' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isNodeObject(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isNodeObject(undefined)).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isNodeObject('panel')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isNodeObject(42)).toBe(false)
  })

  it('returns false for an array (even if items have type)', () => {
    expect(isNodeObject([{ type: 'panel' }])).toBe(false)
  })

  it('returns false for an object missing the type field', () => {
    expect(isNodeObject({ id: 'x', label: 'Y' })).toBe(false)
  })

  it('returns false when type is a number, not a string', () => {
    expect(isNodeObject({ type: 42 })).toBe(false)
  })

})

// ── collectChildNodes ─────────────────────────────────────────────────────────

describe('collectChildNodes', () => {

  it('returns empty array when node has no array or node-object fields', () => {
    expect(collectChildNodes({ type: 'page', title: 'Home', order: 1 })).toEqual([])
  })

  it('collects nodes from an array field (children)', () => {
    const child1 = { type: 'section', id: 's1' }
    const child2 = { type: 'panel',   id: 'p1' }
    const node   = { type: 'page', children: [child1, child2] }
    const result = collectChildNodes(node)
    expect(result).toEqual([child1, child2])
  })

  it('collects a single-object field (header)', () => {
    const header = { type: 'page-header', title: 'H' }
    const node   = { type: 'page', header }
    const result = collectChildNodes(node)
    expect(result).toEqual([header])
  })

  it('skips non-node primitives in arrays', () => {
    const child = { type: 'section' }
    const node  = { type: 'page', items: [child, 'string-item', 42, null] }
    expect(collectChildNodes(node)).toEqual([child])
  })

  it('collects from multiple fields in document order', () => {
    const header  = { type: 'header' }
    const child1  = { type: 'section', id: 's1' }
    const child2  = { type: 'section', id: 's2' }
    const footer  = { type: 'footer' }
    const node    = { type: 'page', header, children: [child1, child2], footer }
    const result  = collectChildNodes(node)
    // header → children[0] → children[1] → footer (Object.keys order)
    expect(result).toEqual([header, child1, child2, footer])
  })

  it('does not recurse — returns only direct child nodes', () => {
    const grandchild = { type: 'panel' }
    const child      = { type: 'section', children: [grandchild] }
    const node       = { type: 'page', children: [child] }
    const result     = collectChildNodes(node)
    // Only child — grandchild is NOT included (caller recurses)
    expect(result).toEqual([child])
    expect(result).not.toContain(grandchild)
  })

  it('returns the same object references (no deep copy)', () => {
    const child = { type: 'section', id: 's1' }
    const node  = { type: 'page', children: [child] }
    expect(collectChildNodes(node)[0]).toBe(child)
  })

  it('ignores array fields whose items are all non-nodes', () => {
    const node = { type: 'page', tags: ['a', 'b', 'c'], counts: [1, 2, 3] }
    expect(collectChildNodes(node)).toEqual([])
  })

  it('skips data field — DataSpec object with type=query is not a child node', () => {
    // G8: data is in DATA_CARRYING_KEYS — must never be walked as a child
    const node = { type: 'panel', data: { type: 'query' } }
    expect(collectChildNodes(node)).toEqual([])
  })

  it('skips transforms field — TransformStep array is not treated as child nodes', () => {
    // G8: transforms is in DATA_CARRYING_KEYS
    const node = { type: 'panel', transforms: [{ op: 'sort' }] }
    expect(collectChildNodes(node)).toEqual([])
  })

})
