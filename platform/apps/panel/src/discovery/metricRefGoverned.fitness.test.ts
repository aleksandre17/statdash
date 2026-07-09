// ── FF-METRIC-REF-GOVERNED — a block's metric-ref is governed-noun-first ──────
//
//  AR-49 M0 (SPEC-authoring-reconception-M0.md §2–§3, item 11 panel seam). The
//  vision's load-bearing property: authoring is GOVERNED-NOUN-FIRST. A data block's
//  metric-ref must resolve ONLY through the governed semantic catalog (metric-ids),
//  never through a raw SDMX code — and the bind must write that governed id to the
//  block's OWN schema-declared measure path, so a palette bind is byte-identical to
//  hand-authoring (spec §3), and resolveMeasureRef lowers it with no new runtime.
//
//  We assert over the ACTUAL merged chart schema (item 10), resolved the way the
//  panel resolves it — `nodeRegistry.getSchema('chart','default')` after
//  setupCanvasRegistry() — so this fitness tracks the real registered schema, not a
//  hand-copied fixture. The invariant is proved across the seam:
//    1. the metric-ref is a GOVERNED enum-ref (source:'metrics'), not a raw cube.*;
//    2. it sits at the schema-declared measure dot-path (data.query.measure);
//    3. the picker's vocabulary is metric-IDS — a raw underlying code can never be
//       an option value (so the field can only ever emit a governed id);
//    4. the bind writes that governed id to exactly that path (Law 2: a string).
//
//  Complements EnumRefField.semantic.test.tsx (the rendered control emits only
//  registered ids); here we pin the ARCHITECTURAL governance invariant end-to-end.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry } from '@statdash/react/engine'
import type { MetricDef } from '@statdash/engine'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { firstMetricField, metricRefFields, bindMetricToProps, isMetricBindable } from './metricBinding'
import { metricOptions, isSemanticSource } from './semanticCatalogOptions'
import { isCubeSource } from './cubeEnumOptions'

const CHART_MEASURE_PATH = 'data.query.measure'

// A catalog whose ids DIFFER from their underlying SDMX codes — the decisive shape
// for "governed id, never raw code": if any option value equals a code, governance
// has leaked. (These mirror geostat.provisioning metric-ids like 'gdp.current'.)
const catalog: Record<string, MetricDef> = {
  'gdp.current':    { code: 'B1GQ',    label: { en: 'GDP (current)', ka: 'მშპ' } },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { en: 'GDP · growth',  ka: 'ზრდა' }, unit: { en: '%', ka: '%' } },
}
const RAW_CODES = Object.values(catalog).map((d) => d.code as string)

beforeAll(() => { setupCanvasRegistry() })

describe('FF-METRIC-REF-GOVERNED — the merged chart schema declares a governed metric-ref', () => {
  it('resolves the real merged chart schema through the registry (item 10)', () => {
    const schema = nodeRegistry.getSchema('chart', 'default')
    expect(schema, 'chart schema must be registered').toBeTruthy()
    expect(schema!.length).toBeGreaterThan(0)
  })

  it('the metric-ref is a GOVERNED enum-ref (source:metrics), never a raw cube.* source', () => {
    const schema = nodeRegistry.getSchema('chart', 'default')!
    const field = firstMetricField(schema)
    expect(field, 'chart must declare a metric-ref bind target').not.toBeNull()
    expect(field!.type).toBe('enum-ref')
    expect(field!.source).toBe('metrics')
    expect(isSemanticSource(field!.source)).toBe(true)   // governed catalog
    expect(isCubeSource(field!.source)).toBe(false)      // NOT raw SDMX cube discovery
  })

  it('the metric-ref binds at the schema-declared measure dot-path (data.query.measure)', () => {
    const schema = nodeRegistry.getSchema('chart', 'default')!
    expect(metricRefFields(schema).map((f) => f.field)).toContain(CHART_MEASURE_PATH)
    expect(firstMetricField(schema)!.field).toBe(CHART_MEASURE_PATH)
    expect(isMetricBindable(schema)).toBe(true)
  })
})

describe('FF-METRIC-REF-GOVERNED — the picker emits governed ids, never raw codes', () => {
  it('every option value is a registered metric-id (⊆ the catalog ids)', () => {
    const values = metricOptions(catalog, 'en').map((o) => o.value)
    expect(values.sort()).toEqual(Object.keys(catalog).sort())
    for (const v of values) expect(v in catalog).toBe(true)
  })

  it('no option value is ever a raw underlying SDMX code (governance cannot leak)', () => {
    const values = metricOptions(catalog, 'en').map((o) => o.value)
    for (const code of RAW_CODES) expect(values).not.toContain(code)
  })
})

describe('FF-METRIC-REF-GOVERNED — bind writes the governed id to the schema-declared path', () => {
  it('binds a metric-id to data.query.measure (byte-identical to hand-authoring the id)', () => {
    const schema = nodeRegistry.getSchema('chart', 'default')!
    const field  = firstMetricField(schema)!
    const bound  = bindMetricToProps({}, field.field, 'gdp.realGrowth')

    const written = (bound.data as { query: { measure: unknown } }).query.measure
    expect(written).toBe('gdp.realGrowth')       // the governed id
    expect(typeof written).toBe('string')        // Law 2 — data, never a function
    expect(RAW_CODES).not.toContain(written)     // never a raw code
    expect(written as string in catalog).toBe(true) // a registered governed noun
  })
})
