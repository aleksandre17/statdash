// ── metricBinding — schema-driven metric bind is byte-identical (AR-49 M0) ────
//
//  Proves the panel-side half of the M0 compatibility guarantee (spec §3): the
//  bind DISCOVERS the block's measure field from its own PropSchema (never a
//  hardcoded per-type path — Law 1/OCP) and writes the metric-id there via the
//  SAME setAtPath the Inspector uses, so the produced props are byte-identical to
//  hand-authoring the metric in the Inspector's EnumRefField.
//
import { describe, it, expect } from 'vitest'
import type { PropSchema } from '@statdash/react/engine'
import {
  metricRefFields, firstMetricField, isMetricBindable, bindMetricToProps,
} from './metricBinding'
import { setAtPath } from '../inspector/showWhen'

// A block schema shaped like item 10's governed data block: a metric-ref field at
// a nested measure path, alongside a dimension-ref and a plain field (neither is a
// metric target).
const metricSchema: PropSchema = [
  { field: 'chartType',     type: 'string' as const,   label: { ka: '', en: 'Chart type' } },
  { field: 'value.measure', type: 'enum-ref' as const, source: 'metrics',    label: { ka: '', en: 'Metric' }, required: true },
  { field: 'value.filter.geo', type: 'enum-ref' as const, source: 'dimensions', label: { ka: '', en: 'Region' } },
]

const noMetricSchema: PropSchema = [
  { field: 'title',   type: 'string' as const, label: { ka: '', en: 'Title' } },
  { field: 'measure', type: 'enum-ref' as const, source: 'cube.measures', label: { ka: '', en: 'Measure' } },
]

describe('metricBinding — target field discovery', () => {
  it('finds the metric-ref field(s) — source:metrics enum-refs only', () => {
    expect(metricRefFields(metricSchema).map((f) => f.field)).toEqual(['value.measure'])
  })

  it('ignores dimension-ref, cube.* and plain fields (not metric targets)', () => {
    expect(metricRefFields(noMetricSchema)).toEqual([])
    expect(firstMetricField(noMetricSchema)).toBeNull()
  })

  it('isMetricBindable reflects whether a metric-ref field is declared', () => {
    expect(isMetricBindable(metricSchema)).toBe(true)
    expect(isMetricBindable(noMetricSchema)).toBe(false)
    expect(isMetricBindable([])).toBe(false)
  })
})

describe('metricBinding — byte-identical write', () => {
  it('writes the metric-id into the discovered measure field path', () => {
    const before = { chartType: 'bar', value: { measure: '', filter: { geo: 'GE' } } }
    const field  = firstMetricField(metricSchema)!
    const after  = bindMetricToProps(before, field.field, 'gdp.realGrowth')

    const measure = (after.value as { measure: string }).measure
    expect(measure).toBe('gdp.realGrowth')
  })

  it('is byte-identical to hand-authoring the metric-id via setAtPath at the field path', () => {
    const before = { chartType: 'bar', value: { measure: 'OLD', filter: { geo: 'GE' } } }
    const field  = firstMetricField(metricSchema)!

    const bound      = bindMetricToProps(before, field.field, 'gdp.level')
    const handAuthor = setAtPath(before, field.field, 'gdp.level') // what EnumRefField's onChange writes
    expect(bound).toEqual(handAuthor)
  })

  it('preserves untouched sibling branches by reference (immutability)', () => {
    const before = { chartType: 'bar', value: { measure: '', filter: { geo: 'GE' } } }
    const after  = bindMetricToProps(before, 'value.measure', 'pop.total') as typeof before

    // The touched branch is cloned; the untouched top-level sibling is shared.
    expect(after).not.toBe(before)
    expect(after.chartType).toBe(before.chartType)
    // The bound value writes a plain string (Law 2: data, never a function).
    expect(typeof after.value.measure).toBe('string')
  })
})
