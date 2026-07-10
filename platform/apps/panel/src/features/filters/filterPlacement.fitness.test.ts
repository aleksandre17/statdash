// ── FF-FILTERS-DERIVED-PLACEMENT — the page filter pipeline weighs itself (SL-5) ─
//
//  Proves the filters relocate-audit is GROUNDED in `deriveWeight`, not asserted by
//  hand: the page filter pipeline's container is a pure function of its schema shape
//  through the Placement Law kernel — never a per-type literal.
//    • a POPULATED pipeline is a §3.1 rich sub-document → oversize → 'focus-view'
//      (escalate OUT of the page dock — FF-NO-CRAMMED-DOCK), regardless of breadth;
//    • an EMPTY/absent pipeline is a light stub → 'dock-panel' (stays inline).
//  The verdict flows through `placeSubject('page', …)` — the SAME kernel the fixture
//  and every other subject use — so a crammed page dock is unrepresentable for the
//  REAL subject, not just the SL-4 fixture.
//
import { describe, it, expect } from 'vitest'
import type { BarView } from './filterSchemaModel'
import type { ParamNode } from '@statdash/engine'
import {
  filterPipelineShape, filtersPipelineContainer, shouldEscalateFilters,
} from './filterPlacement'

const param = (key: string): ParamNode =>
  ({ key, type: 'hidden', default: '' } as unknown as ParamNode)

const bar = (id: string, keys: string[]): BarView =>
  ({ id, bar: { position: 'sticky', filters: {} } as BarView['bar'], params: keys.map(param) })

describe('FF-FILTERS-DERIVED-PLACEMENT — shape is derived from the schema', () => {
  it('an empty pipeline (no bars) weighs FLAT — a light in-dock stub', () => {
    expect(filterPipelineShape([])).toEqual({ flatFields: 0, hasRichType: false })
    expect(filtersPipelineContainer([])).toBe('dock-panel')
    expect(shouldEscalateFilters([])).toBe(false)
  })

  it('a populated pipeline is a RICH sub-document → oversize → focus-view (escalates)', () => {
    const bars = [bar('bar1', ['region', 'year'])]
    expect(filterPipelineShape(bars).hasRichType).toBe(true)
    expect(filtersPipelineContainer(bars)).toBe('focus-view')
    expect(shouldEscalateFilters(bars)).toBe(true)
  })

  it('richness dominates breadth — one bar and many bars BOTH escalate (never a lighter cell)', () => {
    const one   = [bar('bar1', ['a'])]
    const many  = [bar('bar1', ['a', 'b', 'c']), bar('bar2', ['d', 'e']), bar('bar3', ['f'])]
    expect(filtersPipelineContainer(one)).toBe('focus-view')
    expect(filtersPipelineContainer(many)).toBe('focus-view')
  })
})
