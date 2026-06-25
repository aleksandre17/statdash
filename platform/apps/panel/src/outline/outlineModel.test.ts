// ── outlineModel.test — flat store → depth-stamped tree rows (V6) ─────────────
import { describe, it, expect } from 'vitest'
import { buildOutlineRows } from './outlineModel'
import type { CanvasPage } from '../types/constructor'

const page: CanvasPage = {
  id: 'p1', title: { ka: 'გ', en: 'P' }, slug: 'p',
  nodeIds: ['a', 'b'],
  nodes: {
    a:  { id: 'a',  type: 'section', props: { title: 'Overview' }, childIds: ['a1'] },
    a1: { id: 'a1', type: 'kpi-strip', props: {}, childIds: [] },
    b:  { id: 'b',  type: 'hero', props: {}, childIds: [] },
  },
}

describe('buildOutlineRows', () => {
  it('flattens the hierarchy depth-first in document order', () => {
    const rows = buildOutlineRows(page, new Set())
    expect(rows.map((r) => r.id)).toEqual(['a', 'a1', 'b'])
  })

  it('stamps aria depth / posinset / setsize for the tree pattern', () => {
    const rows = buildOutlineRows(page, new Set())
    const [a, a1, b] = rows
    expect(a.depth).toBe(1);  expect(a.posInSet).toBe(1); expect(a.setSize).toBe(2)
    expect(a1.depth).toBe(2); expect(a1.posInSet).toBe(1); expect(a1.setSize).toBe(1)
    expect(b.depth).toBe(1);  expect(b.posInSet).toBe(2); expect(b.setSize).toBe(2)
  })

  it('prunes descendants of a collapsed node', () => {
    const rows = buildOutlineRows(page, new Set(['a']))
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])   // a1 pruned
    expect(rows.find((r) => r.id === 'a')!.hasChildren).toBe(true)
  })

  it('prefers a title-ish prop for the row label, falling back to the type', () => {
    const rows = buildOutlineRows(page, new Set())
    expect(rows.find((r) => r.id === 'a')!.label).toBe('Overview')
    expect(rows.find((r) => r.id === 'b')!.label).toBe('hero')   // no title → type
  })
})
