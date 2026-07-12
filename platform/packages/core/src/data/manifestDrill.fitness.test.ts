// ── FF-MANIFEST-DRILL — the DRILL last-mile: manifest hierarchy → live drill ──────
//
//  Proves the AR-42 drill capability is FULLY LIVE end-to-end through the manifest
//  wire — the thread this milestone closed:
//
//    codelist (parent_code edges, the SSOT)
//        │  reifyHierarchy  (Law 5 — level COUNT = tree depth, never hand-authored)
//        ▼
//    ManifestDimension.hierarchy   (the zero-dep wire contract, @statdash/contracts)
//        │  registerManifestDimensions  (the boot refinement — threads hierarchy)
//        ▼
//    getDimension(id).hierarchy    (POPULATED — previously dropped ⇒ drill inert)
//        │  evalMetricDrill  (the M2-composed drill seam, additivity-respecting)
//        ▼
//    drilled rows                  (a base measure rolls up; a ratio re-derives)
//
//  Before this thread, registerManifestDimensions dropped `hierarchy`, so
//  getDimension('geo').hierarchy was undefined and the drill was inert. Here we prove
//  the wire carries it, the boot threads it, and the seam lights up — for geo AND
//  sector (Law 1 generic), while a FLAT dim stays flat (byte-identical base path).
//
// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest'
import { ExternalStore }             from './store-impl'
import { registerMetric }            from './metric'
import { registerManifestDimensions } from './manifest-catalog'
import { getDimension }              from './dimension'
import { reifyHierarchy, evalMetricDrill } from './drill'
import type { Classifier, Observation } from '../sdmx'
import type { SectionContext }       from '../core/context'
import type { ManifestDimension, ManifestDimensionHierarchy } from '@statdash/contracts'
import type { Expr }                 from '@statdash/expr'

// A self-nested GEO codelist: country GE ▸ regions ▸ municipalities (depth 2).
const GEO: Classifier = [
  { code: 'GE' },
  { code: 'R1', parent: 'GE' }, { code: 'R2', parent: 'GE' },
  { code: 'M1', parent: 'R1' }, { code: 'M2', parent: 'R1' },
  { code: 'M3', parent: 'R2' }, { code: 'M4', parent: 'R2' },
]
// A self-nested SECTOR codelist (NACE-style) — the SECOND dim-pair (Law 1).
const SECTOR: Classifier = [
  { code: 'TOT' },
  { code: 'A', parent: 'TOT' }, { code: 'B', parent: 'TOT' },
  { code: 'A1', parent: 'A' }, { code: 'A2', parent: 'A' }, { code: 'B1', parent: 'B' },
]
// A FLAT codelist — no parent edges ⇒ NO drill path (the byte-identical base case).
const APPROACH: Classifier = [{ code: 'PROD' }, { code: 'EXP' }, { code: 'INC' }]

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

const PER_CAPITA: Expr = { op: 'div', left: { $derived: 'g' }, right: { $derived: 'p' } }
const emptyCtx: SectionContext = { dims: {} }

beforeEach(() => {
  registerMetric('mfd_gdp', { code: 'GDP', label: { en: 'GDP' } })
  registerMetric('mfd_pop', { code: 'POP', label: { en: 'Population' } })
  registerMetric('mfd_gdp_per_capita', {
    label: { en: 'GDP per capita' },
    calc: { inputs: { g: { measure: 'mfd_gdp' }, p: { measure: 'mfd_pop' } }, expr: PER_CAPITA },
  })
})

// ── The manifest a boot receives: the hierarchy is REIFIED from the codelist ──────
//  reifyHierarchy derives the LEVEL COUNT from the codelist depth (Law 5) — exactly
//  what the api bootstrap does server-side via MAX(nlevel(code_path)). The reified
//  core levels are PROJECTED to the zero-dep WIRE shape (label-less { dim } tiers),
//  precisely as the api emits them into ManifestDimension.hierarchy. A flat dim
//  reifies to `undefined`, so its ManifestDimension carries no hierarchy.
function manifestDim(id: string, code: string, classifier: Classifier): ManifestDimension {
  const reified = reifyHierarchy(classifier, code)
  const hierarchy: ManifestDimensionHierarchy | undefined = reified
    ? { levels: reified.levels.map((l) => ({ dim: l.dim })) }
    : undefined
  return { id, code, label: { en: id }, ...(hierarchy ? { hierarchy } : {}) }
}

describe('FF-MANIFEST-DRILL — reifyHierarchy derives levels from codelist depth (Law 5)', () => {
  it('a dim WITH parent edges → one level per tree depth (coarsest→finest)', () => {
    expect(reifyHierarchy(GEO, 'geo')).toEqual({
      levels: [{ dim: 'geo' }, { dim: 'geo' }, { dim: 'geo' }],   // depth 2 → 3 levels
    })
    expect(reifyHierarchy(SECTOR, 'sector')?.levels).toHaveLength(3)
  })
  it('a FLAT dim (no parent edges) → undefined (no drill path)', () => {
    expect(reifyHierarchy(APPROACH, 'approach')).toBeUndefined()
    expect(reifyHierarchy(undefined, 'geo')).toBeUndefined()
  })
  it('optional per-tier labels flow onto the reified levels (Law 4)', () => {
    const h = reifyHierarchy(GEO, 'geo', [{ en: 'Country' }, { en: 'Region' }, { en: 'Municipality' }])
    expect(h?.levels).toEqual([
      { dim: 'geo', label: { en: 'Country' } },
      { dim: 'geo', label: { en: 'Region' } },
      { dim: 'geo', label: { en: 'Municipality' } },
    ])
  })
})

describe('FF-MANIFEST-DRILL — registerManifestDimensions THREADS hierarchy → getDimension', () => {
  it('the boot populates getDimension(id).hierarchy (previously dropped ⇒ drill inert)', () => {
    registerManifestDimensions([
      manifestDim('mfd_geo', 'geo', GEO),
      manifestDim('mfd_sector', 'sector', SECTOR),
      manifestDim('mfd_approach', 'approach', APPROACH),
    ])
    expect(getDimension('mfd_geo')?.hierarchy?.levels).toHaveLength(3)
    expect(getDimension('mfd_sector')?.hierarchy?.levels).toHaveLength(3)
    // A flat dim is registered but carries NO hierarchy — the byte-identical base path.
    expect(getDimension('mfd_approach')).toBeDefined()
    expect(getDimension('mfd_approach')?.hierarchy).toBeUndefined()
  })
})

describe('FF-MANIFEST-DRILL — the threaded hierarchy lights up evalMetricDrill (end-to-end)', () => {
  beforeEach(() => {
    registerManifestDimensions([
      manifestDim('mfd_geo', 'geo', GEO),
      manifestDim('mfd_sector', 'sector', SECTOR),
    ])
  })

  it('GEO: drill to region rolls up additively over the reified members', () => {
    const def = getDimension('mfd_geo')!
    const rows = evalMetricDrill('mfd_gdp', def, { dimension: 'mfd_geo', level: 1 }, emptyCtx, geoStore, GEO)
    expect(rows).toEqual([
      { geo: 'R1', value: 90, id: 'R1', label: 'R1' },
      { geo: 'R2', value: 60, id: 'R2', label: 'R2' },
    ])
  })

  it('GEO: a non-additive ratio RE-DERIVES at the drilled grain (FF-NO-SUM-OF-RATIO)', () => {
    const def = getDimension('mfd_geo')!
    const rows = evalMetricDrill('mfd_gdp_per_capita', def, { dimension: 'mfd_geo', level: 1 }, emptyCtx, geoStore, GEO)
    expect(rows).toEqual([
      { geo: 'R1', value: 90 / 5, id: 'R1', label: 'R1' },   // ΣGDP ÷ ΣPOP, not Σ(cells)
      { geo: 'R2', value: 60 / 4, id: 'R2', label: 'R2' },
    ])
    expect(rows[0]!.value).not.toBe(60 / 3 + 30 / 2)          // the summed-ratio falsehood
  })

  it('SECTOR (Law 1): the SAME threaded mechanism drills a second dim-pair', () => {
    const def = getDimension('mfd_sector')!
    const rows = evalMetricDrill('mfd_gdp', def, { dimension: 'mfd_sector', level: 1 }, emptyCtx, sectorStore, SECTOR)
    expect(rows).toEqual([
      { sector: 'A', value: 25, id: 'A', label: 'A' },
      { sector: 'B', value: 5,  id: 'B', label: 'B' },
    ])
  })
})
