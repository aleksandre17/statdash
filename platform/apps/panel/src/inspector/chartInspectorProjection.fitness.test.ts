// ── FF-NO-EXTERNAL-SPECIAL-CASE · chart — the generic dock PROJECTS the contract ──
//
//  ADR-038 (the Bounded-Element Law): the chart DECLARES its authorable contract
//  (ChartNode.ts / authorableContract.fitness.test.ts); the GENERIC inspector must
//  PROJECT it with zero per-type wiring. This fitness closes the loop through the
//  REAL registered schema + the REAL FieldControlRegistry — the exact path the
//  RightDock's `element.schema` section renders:
//
//    nodeRegistry.getSchema('chart') → fieldControlRegistry.resolve(field) → Control
//
//  It proves two things the owner's grievance turns on:
//    1. FULL PROJECTION — every declared chart field resolves to a CONCRETE control
//       (never the SummaryCard/raw-JSON fallback). A sparse dock = an under-declared
//       contract; this fails the moment a render input stops projecting.
//    2. NO SPECIAL-CASE — the field-control + summarize registries are keyed by
//       PropFieldType, NEVER a node type. `has('chart')` is false in both: the chart
//       flows through the SAME generic dispatch as every other element (OCP).
//
import { describe, it, expect, beforeAll } from 'vitest'
import type { PropField, PropSchema } from '@statdash/react/engine'
import { nodeRegistry } from '@statdash/react/engine'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { fieldControlRegistry } from './FieldControlRegistry'
import { summarizeRegistry } from './summarize'
import { SummaryCard } from './controls/SummaryCard'
import {
  NumberControl, BooleanControl, SelectControl, JsonControl,
} from './controls/primitives'
import { LocaleField }  from './controls/LocaleField'
import { EnumRefField } from './controls/EnumRefField'
import { ObjectControl } from './controls/NestedItemControl'

// Field → the CONCRETE control the generic registry must resolve it to. This is the
// dock the owner sees when a chart node is selected on :3013 — a full Summary/authoring
// panel, one control per authorable render input.
const EXPECTED_CONTROL: Record<string, unknown> = {
  chartType:            SelectControl,   // options
  'data.query.measure': EnumRefField,    // governed metric-ref
  label:                LocaleField,     // localized
  centerLabel:          LocaleField,     // localized
  height:               NumberControl,
  stacked:              BooleanControl,
  distributed:          BooleanControl,
  dataLabels:           BooleanControl,
  compact:              BooleanControl,
  axes:                 ObjectControl,   // itemSchema → drill-in editor
  legend:               ObjectControl,
  tooltip:              ObjectControl,
  preliminary:          BooleanControl,
}

let schema: PropSchema
const find = (name: string): PropField => {
  const f = schema.find((x) => x.field === name)
  if (!f) throw new Error(`chart schema is missing '${name}' — the drain did not register`)
  return f
}

beforeAll(() => {
  setupCanvasRegistry()
  schema = nodeRegistry.getSchema('chart', 'default') ?? []
})

describe('FF · chart dock — the generic registry projects the WHOLE declared contract', () => {

  it('resolves each declared chart field to its concrete control (the dock the owner sees)', () => {
    for (const [name, Control] of Object.entries(EXPECTED_CONTROL)) {
      expect(fieldControlRegistry.resolve(find(name)), `'${name}' must project to its control`).toBe(Control)
    }
  })

  it('NO declared chart field falls to the SummaryCard/raw-JSON fallback (goes all the way in)', () => {
    const sparse = Object.keys(EXPECTED_CONTROL)
      .map(find)
      .filter((f) => {
        const c = fieldControlRegistry.resolve(f)
        return c === SummaryCard || c === JsonControl
      })
      .map((f) => f.field)
    expect(sparse, `chart fields with no real authoring control: ${sparse.join(' | ')}`).toEqual([])
  })
})

describe('FF-NO-EXTERNAL-SPECIAL-CASE · chart — dispatch is keyed by type, never node', () => {

  it('neither registry carries a chart (node-type) key — the chart is dispatched generically', () => {
    expect(fieldControlRegistry.has('chart')).toBe(false)
    expect(summarizeRegistry.has('chart')).toBe(false)
  })

  it('the nested axes object projects to the SAME generic ObjectControl as any element', () => {
    // The drill-in editor is the generic nested editor — no chart-axis-specific editor.
    expect(fieldControlRegistry.resolve(find('axes'))).toBe(ObjectControl)
    expect(fieldControlRegistry.resolve(find('legend'))).toBe(ObjectControl)
    expect(fieldControlRegistry.resolve(find('tooltip'))).toBe(ObjectControl)
  })
})
