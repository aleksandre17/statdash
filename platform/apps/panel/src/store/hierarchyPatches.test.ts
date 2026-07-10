// ── hierarchyPatches.test — the single insert/move engine (V6) ────────────────
//
//  insertNodePatch + moveNodePatch are the one path every V6 surface (Outline,
//  palette drop, Cmd-K, slash) mutates the flat store through. These assert the
//  mechanical contract: insert lands at the right container/index; move detaches
//  + re-attaches losslessly; illegal self/descendant nests are refused.
//
import { describe, it, expect } from 'vitest'
import { insertNodePatch, moveNodePatch } from './constructor.pages'
import type { CanvasPage, CanvasNode } from '../types/constructor'

function basePage(): CanvasPage {
  return {
    id:    'p1',
    type:  'inner-page',
    title: { ka: 'გვ', en: 'Pg' },
    slug:  'pg',
    nodeIds: ['a', 'b'],
    nodes: {
      a: { id: 'a', type: 'section', props: {}, childIds: ['a1'] },
      a1: { id: 'a1', type: 'kpi-strip', props: {}, childIds: [] },
      b: { id: 'b', type: 'section', props: {}, childIds: [] },
    },
  }
}

const state = (page: CanvasPage) => ({ pages: [page], activePageId: page.id })
const newNode = (id: string): CanvasNode => ({ id, type: 'hero', props: {}, childIds: [] })

describe('insertNodePatch', () => {
  it('appends a node to the page top-level when parentId === pageId', () => {
    const patch = insertNodePatch(state(basePage()), 'p1', newNode('x'), 'p1')
    const next = patch.pages![0]
    expect(next.nodeIds).toEqual(['a', 'b', 'x'])
    expect(next.nodes.x.type).toBe('hero')
  })

  it('inserts at an explicit index', () => {
    const patch = insertNodePatch(state(basePage()), 'p1', newNode('x'), 'p1', 1)
    expect(patch.pages![0].nodeIds).toEqual(['a', 'x', 'b'])
  })

  it('nests a node under a parent node (childIds)', () => {
    const patch = insertNodePatch(state(basePage()), 'p1', newNode('x'), 'a')
    expect(patch.pages![0].nodes.a.childIds).toEqual(['a1', 'x'])
  })

  it('is a no-op for an unknown parent', () => {
    const patch = insertNodePatch(state(basePage()), 'p1', newNode('x'), 'ghost')
    expect(patch).toEqual({})
  })
})

describe('moveNodePatch', () => {
  it('reorders a top-level node', () => {
    const patch = moveNodePatch(state(basePage()), 'p1', 'b', 'p1', 0)
    expect(patch.pages![0].nodeIds).toEqual(['b', 'a'])
  })

  it('re-nests a top-level node under a container, detaching it from top-level', () => {
    const patch = moveNodePatch(state(basePage()), 'p1', 'b', 'a', 0)
    const next = patch.pages![0]
    expect(next.nodeIds).toEqual(['a'])
    expect(next.nodes.a.childIds).toEqual(['b', 'a1'])
  })

  it('promotes a nested node back to top-level', () => {
    const patch = moveNodePatch(state(basePage()), 'p1', 'a1', 'p1')
    const next = patch.pages![0]
    expect(next.nodes.a.childIds).toEqual([])
    expect(next.nodeIds).toEqual(['a', 'b', 'a1'])
  })

  it('refuses to nest a node into itself', () => {
    const patch = moveNodePatch(state(basePage()), 'p1', 'a', 'a', 0)
    expect(patch).toEqual({})
  })

  it('refuses to nest a node into its own descendant (would orphan the subtree)', () => {
    const patch = moveNodePatch(state(basePage()), 'p1', 'a', 'a1', 0)
    expect(patch).toEqual({})
  })

  it('keeps the moved node object identity (props/subtree ride along)', () => {
    const page = basePage()
    const patch = moveNodePatch(state(page), 'p1', 'a', 'b', 0)
    // 'a' carries its child 'a1' — the subtree survives the move.
    expect(patch.pages![0].nodes.b.childIds).toEqual(['a'])
    expect(patch.pages![0].nodes.a.childIds).toEqual(['a1'])
  })
})
