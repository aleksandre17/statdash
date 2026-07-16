// @vitest-environment node
//
// ── FF-ELEMENT-DECLARES-CONTRACT · chart (ADR-038, the Bounded-Element Law) ────
//
//  The chart element must DECLARE its full authorable contract ONCE, as DATA, and
//  the generic Inspector PROJECTS that declaration — no external per-type wiring
//  (ADR-038 · FF-NO-EXTERNAL-SPECIAL-CASE). This fitness is the executable, greppable
//  mirror of the compile-time `_ChartCovers` assert (ChartNode.ts): where that fails
//  `tsc` if a ChartDef render input is left uncovered, this names the exact authorable
//  field-set the owner sees, pins each field's control-resolving descriptor, and
//  proves the nested viz-objects (axes / legend / tooltip) drain to scalar leaves —
//  so "the chart dock goes all the way in" is a build gate, not a hope.
//
//  Pure (node-env): imports ONLY the declared schema data — no React, no registry,
//  no ApexCharts. The projection side is proved in apps/panel
//  (chartInspectorProjection.fitness.test.ts), through the real generic registry.
//
import { describe, it, expect } from 'vitest'
import type { PropField, PropSchema } from '@statdash/react/engine'
import {
  ChartSchema, ChartGroups,
  AxisItemSchema, AxesItemSchema, LegendItemSchema, TooltipItemSchema,
} from './ChartNode'

// The authorable render inputs a chart DECLARES → the control-resolving `type` the
// generic Inspector dispatches on. This is the chart's WHOLE editable surface
// (ChartDef ∩ ChartNode, minus the system keys fieldConfig/dataLinks authored via
// their own paths). A missing entry = the owner cannot author that render input.
const EXPECTED: Record<string, PropField['type']> = {
  chartType:            'string',      // options → SelectControl
  'data.query.measure': 'enum-ref',    // governed metric-ref → EnumRefField
  label:                'LocaleString', // localized → LocaleField
  centerLabel:          'LocaleString', // localized → LocaleField
  height:               'number',
  stacked:              'boolean',
  distributed:          'boolean',
  palette:              'string',      // options → SelectControl (categorical | sequential)
  dataLabels:           'boolean',
  compact:              'boolean',
  rangeSlider:          'boolean',      // x-range navigator (brush) intent
  axes:                 'object',       // itemSchema → ObjectControl (drill-in)
  legend:               'object',
  tooltip:              'object',
  preliminary:          'boolean',      // Law 9 data-integrity fragment
}

const byField = (schema: PropSchema): Map<string, PropField> =>
  new Map(schema.map((f) => [f.field, f]))

/**
 * Recursively collect the dot-keys of every OPAQUE nested array/object field —
 * one with no structured `itemSchema` (mirrors schema-completeness.fitness's
 * `collectOpaqueNested`). An empty result ⇒ every nested field drains to scalar
 * leaves and is authored item-by-item — "nothing un-buildable" for the chart.
 */
function opaqueLeaves(schema: PropSchema, prefix: string, out: string[]): void {
  for (const f of schema) {
    if (f.type !== 'array' && f.type !== 'object') continue
    const key = `${prefix}.${f.field}`
    if (f.itemSchema && f.itemSchema.length > 0) opaqueLeaves(f.itemSchema, key, out)
    else out.push(key)
  }
}

describe('FF-ELEMENT-DECLARES-CONTRACT · chart — the full authorable contract is declared', () => {

  it('declares every authorable ChartDef render input with the right control-resolving type', () => {
    const map = byField(ChartSchema)
    for (const [field, type] of Object.entries(EXPECTED)) {
      const decl = map.get(field)
      expect(decl, `chart must DECLARE the authorable render input '${field}' (SCHEMA_TODO drained)`).toBeTruthy()
      expect(decl!.type, `'${field}' must resolve to the ${type} control`).toBe(type)
    }
  })

  it('declares NOTHING beyond the authorable contract (no phantom top-level field)', () => {
    const declared = new Set<string>(ChartSchema.map((f) => f.field))
    const allowed  = new Set(Object.keys(EXPECTED))
    for (const f of declared) {
      expect(allowed.has(f), `unexpected top-level chart field '${f}' — extend EXPECTED or remove it`).toBe(true)
    }
  })

  it('drains every nested viz-object to scalar leaves — no opaque array/object at ANY depth', () => {
    const leaves: string[] = []
    opaqueLeaves(ChartSchema, 'chart', leaves)
    expect(leaves, `opaque nested chart fields (need an itemSchema): ${leaves.join(' | ')}`).toEqual([])
  })

  it('the localized text fields carry coverage:"localized" (bilingual authoring)', () => {
    const map = byField(ChartSchema)
    for (const field of ['label', 'centerLabel']) {
      expect((map.get(field) as { coverage?: string }).coverage,
        `'${field}' must be authored per-locale (ka/en)`).toBe('localized')
    }
  })
})

describe('FF-ELEMENT-DECLARES-CONTRACT · chart — the nested sub-contracts are complete', () => {

  it('one axis (x/y/y2) exposes unit/decimals/min/max/hidden — unit localized', () => {
    const map = byField(AxisItemSchema)
    expect([...map.keys()].sort()).toEqual(['decimals', 'hidden', 'max', 'min', 'unit'])
    expect(map.get('unit')!.type).toBe('LocaleString')
    expect((map.get('unit') as { coverage?: string }).coverage).toBe('localized')
  })

  it('axes exposes x / y / y2, each a structured axis object', () => {
    for (const f of AxesItemSchema) {
      expect(['x', 'y', 'y2']).toContain(f.field)
      expect(f.type).toBe('object')
      expect(f.itemSchema).toBe(AxisItemSchema)
    }
  })

  it('legend exposes show + a positioned select; tooltip exposes a mode select', () => {
    const legend = byField(LegendItemSchema)
    expect(legend.get('show')!.type).toBe('boolean')
    expect(legend.get('position')!.options?.map((o) => o.value)).toEqual(['top', 'bottom', 'right', 'left'])

    const tooltip = byField(TooltipItemSchema)
    expect(tooltip.get('mode')!.options?.map((o) => o.value)).toEqual(['multi', 'single', 'none'])
  })
})

describe('FF-NO-EXTERNAL-SPECIAL-CASE · chart — the contract is pure, projectable DATA', () => {

  it('every group references a REAL declared field (no dead view.legend-style ref)', () => {
    const declared = new Set<string>(ChartSchema.map((f) => f.field))
    for (const g of ChartGroups) {
      for (const field of g.fields) {
        expect(declared.has(field), `ChartGroups references undeclared field '${field}'`).toBe(true)
      }
    }
  })

  it('the whole schema is serializable DATA — no function anywhere (Law 2 / Constructor-ready)', () => {
    // A function in the contract would be un-projectable by a generic reader and force
    // a chart-specific code path. structuredClone throws on a function → this proves the
    // chart declares, and the generic Inspector recurses, with ZERO chart code.
    const walk = (v: unknown): void => {
      if (typeof v === 'function') throw new Error('function in schema')
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    expect(() => walk(ChartSchema)).not.toThrow()
    expect(() => structuredClone(ChartSchema)).not.toThrow()
  })
})
