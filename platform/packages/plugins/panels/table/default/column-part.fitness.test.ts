// @vitest-environment node
//
// ── column-part.fitness.test.ts — ADR-041 · the CLOSED-CIRCLE DoD proof ───────────
//
//  The structural test that the Part grammar's circle is closed: a NEW selectable /
//  authorable KIND — table COLUMNS — became a first-class Part through DECLARATION
//  ONLY. No new adapter, no bridge, no `if type === 'table'`, no edit to any generic
//  layer (the port, `partFieldsOf`, the adapters, CanvasOverlay, the inspector, a
//  composer). The table META declares `columns` as a `value` PartField (its EXISTING
//  `TableConfig.columns` / ColumnDef model, Strangler-style); the generic mechanisms
//  discover it for free. If this is green with zero mechanism change, the foundation
//  holds: the next kind is a declaration, never a fifth grammar.
//
//  Mirrors the kpi-strip `items` value-band proof (object-model.fitness.test.ts):
//  same `partFieldsOf` reading, same `bandItemsOf` selection path — a table column is
//  reached identically to a KPI card, with NO per-kind mechanism.
//
import { describe, it, expect } from 'vitest'
import { partFieldsOf, bandFieldsOf, bandItemsOf } from '@statdash/react/engine'
import type { ObjectMeta } from '@statdash/react/engine'

import { META as tableMeta }          from './meta'
import { TableSchema, ColumnItemSchema } from './TableNode'

describe('ADR-041 DoD — table columns are a `value` Part by DECLARATION ALONE', () => {
  it('partFieldsOf(tableMeta) yields ONE `value` part `columns` carrying the itemSchema', () => {
    const parts = partFieldsOf(tableMeta as ObjectMeta)
    const columns = parts.filter((p) => p.residence === 'value')
    expect(columns).toHaveLength(1)
    expect(columns[0]).toMatchObject({ field: 'columns', residence: 'value', multi: true })
    // the column's per-item contract travels on the part — the bounded schema the
    // inspector projects, identical in shape to a KPI card's item contract.
    expect(columns[0].itemSchema).toEqual(ColumnItemSchema)
    expect(columns[0].itemLabel).toBe('label')
  })

  it('the value part mirrors the kpi-strip `items` shape — same reading, no per-type branch', () => {
    // `partFieldsOf` special-cases nothing: it filters array-fields-with-itemSchema.
    // The table's `columns` and kpi-strip's `items` are BOTH discovered by the SAME
    // predicate (`bandFieldsOf`), so the column is enumerable with zero new mechanism.
    const bandFields = bandFieldsOf(TableSchema)
    expect(bandFields.map((f) => f.field)).toEqual(['columns'])
  })

  it('a table column is SELECTABLE through the existing band path — like a KPI card', () => {
    // The live selection path (`bandItemsOf`, promoted engine-side as the `value`
    // PartSource) enumerates a table instance's columns as bounded, addressable items
    // — the SAME function that enumerates KPI cards. No `if type === 'table'` anywhere.
    const tableInstance = {
      columns: [
        { key: 'value', label: { en: 'Value' } },
        { key: 'pct',   label: { en: 'Share' } },
      ],
    }
    const items = bandItemsOf(tableInstance, TableSchema)
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.path)).toEqual(['columns.0', 'columns.1'])
    // each item carries its OWN bounded contract (the per-column schema) + label handle
    expect(items[0].itemSchema).toEqual(ColumnItemSchema)
    expect(items[0].itemLabel).toBe('label')
  })

  it('the table declares NO slot part — `columns` is a VALUE band, not tree children (kind reconciled)', () => {
    // A leaf-KIND panel (canHaveChildren:false → zero SLOT parts) that is a
    // wrapper-BY-CONTRACT via its VALUE band — exactly the kpi-strip reconciliation
    // FF-DERIVED-CONTAINMENT asserts. No contradiction is introduced.
    const parts = partFieldsOf(tableMeta as ObjectMeta)
    expect(parts.some((p) => p.residence === 'slot')).toBe(false)
    expect(parts.some((p) => p.residence === 'value')).toBe(true)
  })
})
