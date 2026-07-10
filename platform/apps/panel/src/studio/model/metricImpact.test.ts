// ── metricImpact — blast-radius reverse index (M2.2 governance) ────────────────
import { describe, it, expect } from 'vitest'
import type { PropSchema } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode } from '../../types/constructor'
import { computeMetricImpact } from './metricImpact'

// A stub schema source: every node declares one governed metric-ref field at `measure`.
const METRIC_FIELD = [{ field: 'measure', type: 'enum-ref', source: 'metrics', label: 'Measure' }] as unknown as PropSchema
const getSchema = (_node: CanvasNode): PropSchema => METRIC_FIELD

function node(id: string, measure?: string): CanvasNode {
  return { id, type: 'chart', props: measure ? { measure } : {}, childIds: [] }
}
function page(id: string, title: string, nodes: CanvasNode[]): CanvasPage {
  return { id, type: 'inner-page', title: { ka: title, en: title }, slug: id, nodeIds: nodes.map((n) => n.id), nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

describe('computeMetricImpact — schema-driven, not a naive string scan', () => {
  const pages = [
    page('p1', 'Overview', [node('a', 'gdp_level'), node('b', 'gdp_level'), node('c', 'pop_total')]),
    page('p2', 'Detail', [node('d', 'gdp_level')]),
    page('p3', 'Empty', [node('e')]),
  ]

  it('counts blocks + distinct pages referencing the metric', () => {
    const impact = computeMetricImpact(pages, 'gdp_level', getSchema, 'en')
    expect(impact.blocks).toBe(3)
    expect(impact.pages.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(impact.pages[0].title).toBe('Overview')
  })

  it('an unreferenced metric has zero blast radius (safe to delete)', () => {
    expect(computeMetricImpact(pages, 'unused', getSchema, 'en')).toEqual({ blocks: 0, pages: [] })
  })

  it('does NOT false-positive on a non-measure prop that merely contains the id', () => {
    const scanPages = [page('p', 'x', [{ id: 'n', type: 'text', props: { text: 'gdp_level is our metric' }, childIds: [] }])]
    // `text` is not the schema-declared measure field → no reference.
    expect(computeMetricImpact(scanPages, 'gdp_level', getSchema, 'en').blocks).toBe(0)
  })
})
