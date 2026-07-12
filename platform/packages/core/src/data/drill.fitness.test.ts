// ── FF-HIERARCHY-DRILL — the governed dimension-hierarchy drill [ADR-034 S4] ─────
//
//  Proves the AR-40/50 ⟷ AR-42 bridge primitive:
//
//    (1) REIFY — a member's level / children / members-at-depth reify from the SDMX
//        codelist `parent` edges; the DimensionHierarchy declares only axis + label,
//        never member relations (Law 5, no double-authoring).
//    (2) GRAIN-AWARE DRILL — a metric queried at level L, drilled to L+1, re-aggregates
//        coherently: a base (additive) measure ROLLS UP over the level's members (each
//        rollup cell sums its descendant leaves); the finer level reads the leaves.
//    (3) ADDITIVITY-RESPECTING — a ratio / calc metric drilled to a coarser level is
//        RE-DERIVED from its additive components at that coordinate, NEVER summed
//        (FF-NO-SUM-OF-RATIO holds through the drill).
//    (4) PARITY — a drill at the LEAF level is byte-equivalent to grain-enumeration
//        (`evalMeasureAtGrain(ref, ctx, store, [axis])`) — the reversible-expansion gate.
//    (5) LAW 1 — the same mechanism drills a SECOND dim-pair (sector), zero special-casing.
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalStore }        from './store-impl'
import { registerMetric }       from './metric'
import { evalMeasureAtGrain }   from './metric-grain'
import { childrenOf, depthOf, membersAtDepth } from './codelist'
import { drillAxis, reifyLevelMembers, evalMetricDrill } from './drill'
import type { DimensionDef }    from './dimension'
import type { Classifier, Observation } from '../sdmx'
import type { SectionContext }  from '../core/context'
import type { Expr }            from '@statdash/expr'

// ── A self-nested GEO codelist: country GE ▸ regions ▸ municipalities ─────────────
//  Array form — code IS the id; `parent` is a code. Facts carry LEAF (municipality)
//  codes; a region/country read sums its descendant leaves via the store's DimResolver.
const GEO: Classifier = [
  { code: 'GE' },                 // country  (depth 0, root)
  { code: 'R1', parent: 'GE' },   // region   (depth 1)
  { code: 'R2', parent: 'GE' },
  { code: 'M1', parent: 'R1' },   // municipality (depth 2, leaf)
  { code: 'M2', parent: 'R1' },
  { code: 'M3', parent: 'R2' },
  { code: 'M4', parent: 'R2' },
]

// A self-nested SECTOR codelist (NACE-style) — the SECOND dim-pair (Law 1).
const SECTOR: Classifier = [
  { code: 'TOT' },                // total    (depth 0)
  { code: 'A',  parent: 'TOT' },  // section  (depth 1)
  { code: 'B',  parent: 'TOT' },
  { code: 'A1', parent: 'A' },    // division (depth 2, leaf)
  { code: 'A2', parent: 'A' },
  { code: 'B1', parent: 'B' },
]

// GDP + population at LEAF grain (geo=municipality), single time slice.
const GEO_OBS: Observation[] = [
  { measure: 'GDP', geo: 'M1', value: 60 }, { measure: 'GDP', geo: 'M2', value: 30 },  // R1 → 90
  { measure: 'GDP', geo: 'M3', value: 20 }, { measure: 'GDP', geo: 'M4', value: 40 },  // R2 → 60
  { measure: 'POP', geo: 'M1', value: 3 },  { measure: 'POP', geo: 'M2', value: 2 },   // R1 → 5
  { measure: 'POP', geo: 'M3', value: 1 },  { measure: 'POP', geo: 'M4', value: 3 },   // R2 → 4
]
const SECTOR_OBS: Observation[] = [
  { measure: 'GDP', sector: 'A1', value: 10 }, { measure: 'GDP', sector: 'A2', value: 15 }, // A → 25
  { measure: 'GDP', sector: 'B1', value: 5 },                                               // B → 5
]

const geoStore    = new ExternalStore(GEO_OBS,    { classifiers: { geo: GEO } })
const sectorStore = new ExternalStore(SECTOR_OBS, { classifiers: { sector: SECTOR } })

// GDP per capita = GDP ÷ POP — a ratio ⇒ non-additive by the structural default.
const PER_CAPITA: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }

const geoDef: DimensionDef = {
  code: 'geo', label: { en: 'Geography' },
  hierarchy: { levels: [
    { dim: 'geo', label: { en: 'Country' } },
    { dim: 'geo', label: { en: 'Region' } },
    { dim: 'geo', label: { en: 'Municipality' } },
  ] },
}
const sectorDef: DimensionDef = {
  code: 'sector', label: { en: 'Activity' },
  hierarchy: { levels: [
    { dim: 'sector', label: { en: 'Total' } },
    { dim: 'sector', label: { en: 'Section' } },
    { dim: 'sector', label: { en: 'Division' } },
  ] },
}

beforeEach(() => {
  registerMetric('gdp', { code: 'GDP', label: { en: 'GDP' } })          // additive (default)
  registerMetric('pop', { code: 'POP', label: { en: 'Population' } })   // additive (default)
  registerMetric('gdp_per_capita', {
    label: { en: 'GDP per capita' },
    calc: { inputs: { g: { measure: 'gdp' }, p: { measure: 'pop' } }, expr: PER_CAPITA },
  })
})

const emptyCtx: SectionContext = { dims: {} }

// ── (1) REIFY — the tree comes from the codelist parent edges, not the declaration ──
describe('FF-HIERARCHY-DRILL — member relations REIFY from the SDMX codelist (Law 5)', () => {
  it('depthOf / childrenOf / membersAtDepth read the parent edges', () => {
    expect(depthOf(GEO, 'GE')).toBe(0)
    expect(depthOf(GEO, 'R1')).toBe(1)
    expect(depthOf(GEO, 'M1')).toBe(2)

    expect(childrenOf(GEO, 'GE')).toEqual(['R1', 'R2'])
    expect(childrenOf(GEO, 'R1')).toEqual(['M1', 'M2'])
    expect(childrenOf(GEO, 'M1')).toEqual([])   // leaf

    expect(membersAtDepth(GEO, 0)).toEqual(['GE'])
    expect(membersAtDepth(GEO, 1)).toEqual(['R1', 'R2'])
    expect(membersAtDepth(GEO, 2)).toEqual(['M1', 'M2', 'M3', 'M4'])
  })

  it('reifyLevelMembers maps a hierarchy LEVEL onto its reified codelist depth', () => {
    expect(reifyLevelMembers(geoDef, 0, GEO)).toEqual(['GE'])
    expect(reifyLevelMembers(geoDef, 1, GEO)).toEqual(['R1', 'R2'])
    expect(reifyLevelMembers(geoDef, 2, GEO)).toEqual(['M1', 'M2', 'M3', 'M4'])
    // The declaration carries NO members — an absent classifier reifies nothing.
    expect(reifyLevelMembers(geoDef, 1, undefined)).toEqual([])
  })

  it('record (surrogate-id) classifier form reifies identically', () => {
    const geoRec: Classifier = {
      '0': { code: 'GE' },
      '1': { code: 'R1', parent: 0 }, '2': { code: 'R2', parent: 0 },
      '3': { code: 'M1', parent: 1 }, '4': { code: 'M2', parent: 1 },
    }
    expect(membersAtDepth(geoRec, 1)).toEqual(['R1', 'R2'])
    expect(childrenOf(geoRec, 'R1')).toEqual(['M1', 'M2'])
  })
})

// ── (2) GRAIN-AWARE DRILL — additive rollup over the drilled level's members ─────
describe('FF-HIERARCHY-DRILL — a base measure ROLLS UP additively over the level', () => {
  it('drill to REGION sums each region over its descendant municipalities', () => {
    const rows = evalMetricDrill('gdp', geoDef, { dimension: 'dim:geo', level: 1 }, emptyCtx, geoStore, GEO)
    expect(rows).toEqual([
      { geo: 'R1', value: 90, id: 'R1', label: 'R1' },   // M1+M2 = 60+30
      { geo: 'R2', value: 60, id: 'R2', label: 'R2' },   // M3+M4 = 20+40
    ])
  })

  it('drill to MUNICIPALITY (leaf) reads each leaf cell', () => {
    const rows = evalMetricDrill('gdp', geoDef, { dimension: 'dim:geo', level: 2 }, emptyCtx, geoStore, GEO)
    expect(rows.map((r) => [r.geo, r.value])).toEqual([['M1', 60], ['M2', 30], ['M3', 20], ['M4', 40]])
  })

  it('drillAxis names the grain axis at the level (the star-form bridge)', () => {
    expect(drillAxis(geoDef, 1)).toBe('geo')
    expect(drillAxis({ code: 'x', label: { en: 'X' } }, 0)).toBeUndefined()  // no hierarchy
  })
})

// ── (3) ADDITIVITY — a ratio drilled is RE-DERIVED, never summed (FF-NO-SUM-OF-RATIO) ──
describe('FF-HIERARCHY-DRILL — a non-additive ratio re-derives at the drilled grain', () => {
  it('GDP-per-capita at REGION = ΣGDP ÷ ΣPOP, NOT the sum of per-capita cells', () => {
    const rows = evalMetricDrill('gdp_per_capita', geoDef, { dimension: 'dim:geo', level: 1 }, emptyCtx, geoStore, GEO)
    // R1: 90/5 = 18 ; R2: 60/4 = 15 — re-derived from additive components.
    expect(rows).toEqual([
      { geo: 'R1', value: 90 / 5, id: 'R1', label: 'R1' },
      { geo: 'R2', value: 60 / 4, id: 'R2', label: 'R2' },
    ])
    // The scientific falsehood the guard prevents: summing per-capita leaf cells.
    const sumOfCells_R1 = 60 / 3 + 30 / 2   // = 35, the WRONG number
    expect(rows[0]!.value).not.toBe(sumOfCells_R1)
  })
})

// ── (4) PARITY — a leaf-level drill == grain enumeration (reversible expansion) ──
describe('FF-HIERARCHY-DRILL — leaf drill is byte-equivalent to grain enumeration', () => {
  it('evalMetricDrill(leaf) values equal evalMeasureAtGrain(ctx,[axis])', () => {
    const drilled = evalMetricDrill('gdp', geoDef, { dimension: 'dim:geo', level: 2 }, emptyCtx, geoStore, GEO)
    const grained = evalMeasureAtGrain('gdp', emptyCtx, geoStore, ['geo'])
    const norm = (rs: { geo?: unknown; value?: unknown }[]) =>
      rs.map((r) => [String(r.geo), r.value]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    expect(norm(drilled)).toEqual(norm(grained))
  })
})

// ── (5) LAW 1 — a SECOND dim-pair (sector) drills with the same mechanism ────────
describe('FF-HIERARCHY-DRILL — Law 1: the drill is generic over the dim (sector)', () => {
  it('drill a NACE sector tree — section rollup sums its divisions', () => {
    const rows = evalMetricDrill('gdp', sectorDef, { dimension: 'dim:sector', level: 1 }, emptyCtx, sectorStore, SECTOR)
    expect(rows).toEqual([
      { sector: 'A', value: 25, id: 'A', label: 'A' },   // A1+A2 = 10+15
      { sector: 'B', value: 5,  id: 'B', label: 'B' },   // B1
    ])
  })

  it('reifyLevelMembers is generic over the axis', () => {
    expect(reifyLevelMembers(sectorDef, 1, SECTOR)).toEqual(['A', 'B'])
    expect(reifyLevelMembers(sectorDef, 2, SECTOR)).toEqual(['A1', 'A2', 'B1'])
  })
})
