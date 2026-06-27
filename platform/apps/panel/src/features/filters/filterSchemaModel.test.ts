// ── filterSchemaModel — flat⇄node round-trip + add/edit/reorder [V0] ───────────
//
//  Pins the editor-boundary adapter: the stored MAP form ⇄ the ordered ParamNode[]
//  view is LOSSLESS (an unedited schema round-trips byte-identical), order is
//  preserved on reorder, and add/edit/remove rebuild the map without touching any
//  OTHER bar or the advanced top-level keys (crossValidate / context).
//
import { describe, it, expect } from 'vitest'
import type { FilterSchemaInput } from '@statdash/engine'
import {
  toBarViews, setBarParams, barParams, paramsToFilters, toParamNode, fromParamNode,
} from './filterSchemaModel'

const schema: FilterSchemaInput = {
  bars: {
    main: {
      position: 'sticky',
      order: 0,
      filters: {
        year:   { type: 'year-select', default: '2024' },
        region: { type: 'select', label: 'Region', options: { type: 'static', items: [] }, default: '' },
      },
    },
    other: {
      filters: { mode: { type: 'hidden', default: 'year' } },
    },
  },
  crossValidate: [{ fields: ['year'], check: { year: 'isset' }, message: 'required' } as never],
}

describe('filterSchemaModel — flat⇄node adapters (V0)', () => {
  it('toParamNode / fromParamNode are inverse (key carried explicitly)', () => {
    const def  = { type: 'select' as const, label: 'R', options: { type: 'static' as const, items: [] }, default: '' }
    const node = toParamNode('region', def)
    expect(node).toEqual({ ...def, key: 'region' })
    expect(fromParamNode(node)).toEqual({ key: 'region', def })
  })

  it('projects a bar to an ordered ParamNode[] preserving insertion order', () => {
    const nodes = barParams(schema.bars.main)
    expect(nodes.map((n) => n.key)).toEqual(['year', 'region'])
    expect(nodes[0].type).toBe('year-select')
  })

  it('round-trips the whole schema byte-identical when unedited (lossless)', () => {
    const views = toBarViews(schema)
    // Rebuild each bar from its projected nodes and re-apply — must equal source.
    let rebuilt = schema
    for (const v of views) rebuilt = setBarParams(rebuilt, v.id, v.params)
    expect(rebuilt).toEqual(schema)
    // Advanced top-level keys are preserved verbatim.
    expect(rebuilt.crossValidate).toEqual(schema.crossValidate)
  })

  it('add appends a control to one bar and leaves other bars untouched', () => {
    const nodes = barParams(schema.bars.main)
    const added = [...nodes, toParamNode('sector', { type: 'multi-select', label: 'S', options: { type: 'static', items: [] }, default: '' })]
    const next = setBarParams(schema, 'main', added)
    expect(Object.keys(next.bars.main.filters)).toEqual(['year', 'region', 'sector'])
    expect(next.bars.other).toEqual(schema.bars.other)   // untouched
    expect(next.crossValidate).toEqual(schema.crossValidate)  // untouched
  })

  it('reorder reflects the new order in the rebuilt map', () => {
    const nodes = barParams(schema.bars.main)
    const reordered = [nodes[1], nodes[0]] // region before year
    const next = setBarParams(schema, 'main', reordered)
    expect(Object.keys(next.bars.main.filters)).toEqual(['region', 'year'])
  })

  it('edit replaces one control without disturbing siblings', () => {
    const nodes = barParams(schema.bars.main)
    const edited = nodes.map((n) => (n.key === 'year' ? { ...n, default: '2025' } : n))
    const filters = paramsToFilters(edited)
    expect(filters.year).toMatchObject({ type: 'year-select', default: '2025' })
    expect(filters.region).toEqual(schema.bars.main.filters.region)
  })

  it('remove drops one control and preserves the rest', () => {
    const nodes = barParams(schema.bars.main).filter((n) => n.key !== 'region')
    const next = setBarParams(schema, 'main', nodes)
    expect(Object.keys(next.bars.main.filters)).toEqual(['year'])
  })

  it('tolerates an undefined schema (no bars yet)', () => {
    expect(toBarViews(undefined)).toEqual([])
  })
})
