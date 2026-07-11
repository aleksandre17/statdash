// ── dataFlow — the Data-Flow Spine projection (AR-49 M4.3 · Move 3) ─────────────
//
//  Proves the flow map is a faithful PROJECTION of the registries we already own:
//  metrics grouped by source, the spec column (codes vs calc-inputs), the used-by
//  reverse index reusing computeMetricImpact, the un-sourced bucket, and the shared
//  search filter. Pure — no network, a stub schema source (mirrors metricImpact.test).
//
import { describe, it, expect } from 'vitest'
import type { MetricDef } from '@statdash/engine'
import type { PropSchema } from '@statdash/react/engine'
import type { CanvasPage, CanvasNode, DataSourceDef } from '../../types/constructor'
import { projectDataFlow, UNSOURCED_ID } from './dataFlow'

// Every node declares one governed metric-ref field at `measure` (as in the app).
const METRIC_FIELD = [{ field: 'measure', type: 'enum-ref', source: 'metrics', label: 'Measure' }] as unknown as PropSchema
const getSchema = (_node: CanvasNode): PropSchema => METRIC_FIELD

function node(id: string, measure?: string): CanvasNode {
  return { id, type: 'chart', props: measure ? { measure } : {}, childIds: [] }
}
function page(id: string, title: string, nodes: CanvasNode[]): CanvasPage {
  return { id, type: 'inner-page', title: { ka: title, en: title }, slug: id, nodeIds: nodes.map((n) => n.id), nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

const metrics: Record<string, MetricDef> = {
  'gdp.level':   { code: 'B1GQ', label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' }, dataSource: 'stats', methodology: 'https://x' },
  'pop.total':   { code: ['POP', 'POP_F'], label: { ka: 'მოს.', en: 'Population' }, dataSource: 'demo' },
  'gdp.percap':  { calc: { inputs: { num: { measure: 'gdp.level' }, den: { measure: 'pop.total' } }, expr: {} as never }, label: { ka: 'ერთ სულზე', en: 'GDP per capita' }, dataSource: 'stats' },
  orphan:        { code: 'ORPH', label: { ka: 'უწყ.', en: 'Orphan' } }, // no dataSource
}
const dataSources: DataSourceDef[] = [
  { id: 'stats', name: 'GeoStat', type: 'sdmx-json', config: {}, status: 'connected' },
]
const pages = [
  page('p1', 'Overview', [node('a', 'gdp.level'), node('b', 'gdp.level')]),
  page('p2', 'Detail', [node('c', 'pop.total')]),
]

describe('projectDataFlow — the flow map is a projection of the registries', () => {
  const model = projectDataFlow({ metrics, pages, getSchema, dataSources, locale: 'en' })

  it('groups metrics by their dataSource, real sources first and the un-sourced bucket last', () => {
    expect(model.sources.map((s) => s.id)).toEqual(['demo', 'stats', UNSOURCED_ID])
    expect(model.sources.at(-1)?.unsourced).toBe(true)
    expect(model.totalSources).toBe(2) // demo + stats, not the bucket
  })

  it('joins the Layer-1 source registry for the kind + status badge when the storeKey matches', () => {
    const stats = model.sources.find((s) => s.id === 'stats')!
    expect(stats.kind).toBe('sdmx-json')
    expect(stats.status).toBe('connected')
    const demo = model.sources.find((s) => s.id === 'demo')!
    expect(demo.kind).toBeUndefined() // no matching DataSourceDef → no fabricated badge
  })

  it('projects the spec column from codes (base) and input refs (derived)', () => {
    const stats = model.sources.find((s) => s.id === 'stats')!
    const level = stats.metrics.find((m) => m.id === 'gdp.level')!
    expect(level.calc).toBe(false)
    expect(level.codes).toEqual(['B1GQ'])
    const percap = stats.metrics.find((m) => m.id === 'gdp.percap')!
    expect(percap.calc).toBe(true)
    expect(percap.calcInputs).toEqual(['gdp.level', 'pop.total'])
  })

  it('projects used-by from computeMetricImpact (the same reverse index)', () => {
    const level = model.sources.find((s) => s.id === 'stats')!.metrics.find((m) => m.id === 'gdp.level')!
    expect(level.usedBy.blocks).toBe(2)
    expect(level.usedBy.pages.map((p) => p.id)).toEqual(['p1'])
  })

  it('counts metrics referenced by no block as dead-end candidates (surfaced, not hidden)', () => {
    // gdp.percap + orphan are unused (0 blocks).
    expect(model.unusedMetrics).toBe(2)
  })

  it('the shared search query filters the flow by label / id / code / source', () => {
    const filtered = projectDataFlow({ metrics, pages, getSchema, dataSources, locale: 'en', query: 'popul' })
    expect(filtered.totalMetrics).toBe(1)
    expect(filtered.sources.flatMap((s) => s.metrics.map((m) => m.id))).toEqual(['pop.total'])
  })
})
