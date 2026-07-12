// @vitest-environment node
//
// ── FF-DRILL-CONSUMER — the `drill` NodeAction re-renders a metric at the drilled grain ─
//
//  The RENDER half of AR-42 P2. The engine fitness (data/drill.fitness — FF-HIERARCHY-DRILL)
//  proves evalMetricDrill is additivity-correct at the seam; THIS proves the same seam flows
//  through the REAL render binding the runner uses (resolveNodeRows → resolveDrill), driven
//  by a DECLARED `drill` action + the drill-state param the gesture writes:
//
//    • NOT drilled (no active drill param) ⇒ the metric spec renders its base grain,
//      BYTE-IDENTICAL to today (the Consumer returns undefined, the base path runs).
//    • drilled to REGION ⇒ the chart re-renders one row per region, each region summing
//      its descendant leaves — and the region rows SUM BACK to the base total (additivity).
//    • a RATIO metric drilled ⇒ RE-DERIVED at each region (ΣGDP÷ΣPOP), never sum-of-cells
//      (FF-NO-SUM-OF-RATIO, through the render binding).
//    • Law 1 — a SECOND dim (sector) drills through the same generic Consumer.
//    • the arm rides the ONE write point — a re-click on the same level clears the drill
//      param (applySelection replace toggle → roll-up).
//
import { describe, it, expect, beforeEach } from 'vitest'
import {
  ExternalStore,
  registerMetric,
  registerDimension,
  applySelection,
} from '@statdash/engine'
import type { DataStore, Observation, Classifier, SectionContext } from '@statdash/engine'
import type { Expr } from '@statdash/expr'
import { resolveNodeRows } from './resolveNodeRows'
import { drillParamKey } from './node-events'
import type { NodeBase, RenderContext } from './types'

/** Bracket-read an ad-hoc grain field off a neutral render row (DataRow has no index sig). */
const field = (r: unknown, k: string): unknown => (r as Record<string, unknown>)[k]

// Self-nested GEO codelist (array form): country GE ▸ regions ▸ municipalities. Facts carry
// LEAF (municipality) codes; a region read sums its descendant leaves via the DimResolver.
const GEO: Classifier = [
  { code: 'GE' },
  { code: 'R1', parent: 'GE' }, { code: 'R2', parent: 'GE' },
  { code: 'M1', parent: 'R1' }, { code: 'M2', parent: 'R1' },
  { code: 'M3', parent: 'R2' }, { code: 'M4', parent: 'R2' },
]
const SECTOR: Classifier = [
  { code: 'TOT' },
  { code: 'A', parent: 'TOT' }, { code: 'B', parent: 'TOT' },
  { code: 'A1', parent: 'A' }, { code: 'A2', parent: 'A' }, { code: 'B1', parent: 'B' },
]

const GEO_OBS: Observation[] = [
  { measure: 'GDP', geo: 'M1', value: 60 }, { measure: 'GDP', geo: 'M2', value: 30 }, // R1 → 90
  { measure: 'GDP', geo: 'M3', value: 20 }, { measure: 'GDP', geo: 'M4', value: 40 }, // R2 → 60
  { measure: 'POP', geo: 'M1', value: 3 },  { measure: 'POP', geo: 'M2', value: 2 },  // R1 → 5
  { measure: 'POP', geo: 'M3', value: 1 },  { measure: 'POP', geo: 'M4', value: 3 },  // R2 → 4
]
const SECTOR_OBS: Observation[] = [
  { measure: 'GDP', sector: 'A1', value: 10 }, { measure: 'GDP', sector: 'A2', value: 15 }, // A → 25
  { measure: 'GDP', sector: 'B1', value: 5 },                                               // B → 5
]

const geoStore    = new ExternalStore(GEO_OBS,    { classifiers: { geo: GEO } })
const sectorStore = new ExternalStore(SECTOR_OBS, { classifiers: { sector: SECTOR } })

const PER_CAPITA: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }

beforeEach(() => {
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })
  registerMetric('pop', { code: 'POP', label: { en: 'Population' } })
  registerMetric('gdp_per_capita', {
    label: { en: 'GDP per capita' },
    calc:  { inputs: { g: { measure: 'gdp' }, p: { measure: 'pop' } }, expr: PER_CAPITA },
  })
  registerDimension('geo', {
    code: 'geo', label: { en: 'Geography' },
    hierarchy: { levels: [{ dim: 'geo', label: { en: 'Country' } }, { dim: 'geo', label: { en: 'Region' } }, { dim: 'geo', label: { en: 'Municipality' } }] },
  })
  registerDimension('sector', {
    code: 'sector', label: { en: 'Activity' },
    hierarchy: { levels: [{ dim: 'sector', label: { en: 'Total' } }, { dim: 'sector', label: { en: 'Section' } }, { dim: 'sector', label: { en: 'Division' } }] },
  })
})

/** A minimal RenderContext — only the fields resolveNodeRows / resolveDrill read. */
function makeCtx(dataStore: DataStore, filterParams: Record<string, unknown> = {}): RenderContext {
  const sectionCtx: SectionContext = { dims: {} }
  return {
    sectionCtx,
    stores:       { default: dataStore },
    pageStoreKey: 'default',
    vars:         {},
    filterParams,
    locale:       'en',
    rows:         [],
  } as unknown as RenderContext
}

/** A metric-spec chart node declaring a `drill` action along `dim` (target level 1). */
function drillNode(metric: string, dim: string): NodeBase {
  return {
    type: 'chart', id: `chart-${metric}`,
    data: { type: 'metric', metrics: [metric] },
    on:   [{ event: 'point:click', actions: [{ type: 'drill', dimension: dim, toLevel: 1 }] }],
  } as unknown as NodeBase
}

describe('FF-DRILL-CONSUMER — a declared drill re-renders the metric at the drilled grain', () => {
  it('NOT drilled: the metric spec renders its base grain (byte-identical base path)', () => {
    // No drill param active ⇒ resolveDrill returns undefined ⇒ base MetricSpec (grain-∅ = the
    // national total, 60+30+20+40 = 150). The declared drill action alone changes nothing.
    const rows = resolveNodeRows(drillNode('gdp', 'geo'), makeCtx(geoStore))
    const total = rows.reduce((s, r) => s + Number(r.value), 0)
    expect(total).toBe(150)
  })

  it('drilled to REGION: one row per region, each summing its leaves; regions SUM to the base total', () => {
    const ctx  = makeCtx(geoStore, { [drillParamKey('geo')]: '1' })
    const rows = resolveNodeRows(drillNode('gdp', 'geo'), ctx)
    const byGeo = Object.fromEntries(rows.map((r) => [String(field(r,'geo')), r.value]))
    expect(byGeo).toEqual({ R1: 90, R2: 60 })          // additive rollup over municipalities
    expect(rows.reduce((s, r) => s + Number(r.value), 0)).toBe(150) // additivity: regions Σ = nation
  })

  it('additivity-correct: a RATIO metric drilled RE-DERIVES per region (never sum-of-cells)', () => {
    const ctx  = makeCtx(geoStore, { [drillParamKey('geo')]: '1' })
    const rows = resolveNodeRows(drillNode('gdp_per_capita', 'geo'), ctx)
    const byGeo = Object.fromEntries(rows.map((r) => [String(field(r,'geo')), r.value]))
    expect(byGeo.R1).toBe(90 / 5)                       // ΣGDP ÷ ΣPOP = 18
    expect(byGeo.R2).toBe(60 / 4)                       // = 15
    expect(byGeo.R1).not.toBe(60 / 3 + 30 / 2)          // NOT the 35 sum-of-ratios falsehood
  })

  it('Law 1: a SECOND dim (sector) drills through the SAME generic Consumer', () => {
    const ctx  = makeCtx(sectorStore, { [drillParamKey('sector')]: '1' })
    const rows = resolveNodeRows(drillNode('gdp', 'sector'), ctx)
    const bySector = Object.fromEntries(rows.map((r) => [String(field(r,'sector')), r.value]))
    expect(bySector).toEqual({ A: 25, B: 5 })           // section rollup sums its divisions
  })

  it('the arm rides ONE write point: a re-click on the same level rolls up (param clears)', () => {
    // The drill fold is applySelection replace: first click writes the level; a re-click on
    // the same active level clears it (roll-up) — the SAME toggle every selection-write uses.
    expect(applySelection('replace', '', '1')).toBe('1')   // drill down
    expect(applySelection('replace', '1', '1')).toBe('')   // re-click → roll up (cleared)
  })
})
