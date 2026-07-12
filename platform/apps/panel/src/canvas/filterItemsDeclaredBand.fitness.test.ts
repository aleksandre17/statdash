// ── FF-FILTER-ITEMS-DECLARED-BAND — the filter band is DECLARED + SSOT-faithful ──
//
//  ADR-039 BE-4 (extends ADR-038), re-homed under the ADR-041 Part port (Phase 2)
//  and collapsed onto the ONE stable-key `PartAddress` (Phase 3): an individual
//  filter control is a bounded, selectable element — the SAME gesture as a KPI card —
//  reached NOT by a per-type wire but through the ONE port (`enumerateParts` →
//  `getPartSource(residence)`), keyed by RESIDENCE (`'sourced'`) never by type. This
//  gate locks the invariants that make that lawful:
//
//    (a) DECLARED + RESIDENCE-KEYED — the filter-bar META declares `band.source:
//        'page-filters'`, and the port resolves the `sourced` residence to
//        `sourcedParts` (no external `type==='filter-bar'` branch; the descriptor
//        drives selection — FF-NO-EXTERNAL-SPECIAL-CASE). The default homogeneous
//        band routes to the engine `valueParts` (`value` residence).
//    (b) DISCRIMINATED + SSOT-FAITHFUL — the adapter resolves each item's authoring
//        schema through the engine `getParamSchema(type)` (the REAL registered
//        ParamDef schema, discriminated per type), and its WRITE goes through
//        `setBarParams` (the SSOT reducer) — a `filter-schema` mutation with NO
//        denormalised copy on the node.
//    (c) STABLE-KEY ADDRESS (Delta 1) — a filter control's ONE `PartAddress.partPath`
//        is `${barId}.${controlKey}` (the control's SSOT key, NOT its position), so a
//        reorder/insert in the page `filterSchema` never renumbers a live selection.
//        Selecting it yields ONLY that control's own declared contract.
//
//  Placement note: like noExternalSpecialCase.fitness, this boots the REAL registry
//  (setupCanvasRegistry) so the assertions run against the registered filter-bar META
//  and the side-effect-registered ParamDef schemas (`@statdash/engine` imports them).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { nodeRegistry, valueParts } from '@statdash/react/engine'
import type { ObjectMeta, PartField } from '@statdash/react/engine'
import { getParamSchema } from '@statdash/engine'
import type { FilterSchemaInput } from '@statdash/engine'
import { setupCanvasRegistry } from './setupCanvasRegistry'
import { enumerateParts, getPartSource, sourcedParts } from './bandSource'
import { setBarParams } from '../features/filters/filterSchemaModel'

beforeAll(() => { setupCanvasRegistry() })

// A REAL page-owned filter schema: two DISCRIMINATED control types (year-select and
// range), each a genuine ParamDef whose authoring schema is registered in the engine.
const filterSchema: FilterSchemaInput = {
  bars: {
    main: {
      filters: {
        year:   { type: 'year-select', default: 2024 },
        amount: { type: 'range', label: 'Amount', default: '0,100' },
      },
    },
    extra: {
      filters: {
        region: { type: 'year-select', default: 2020 },
      },
    },
  },
}

// The authoring node container the port enumerates from — a filter-bar's props hold
// only `barIds` (the placeholder projection selector), NEVER the filters themselves.
const nodeProps = { barIds: ['main'] }
const NODE_ID = 'fb'

describe('FF-FILTER-ITEMS-DECLARED-BAND — filters are a declared, SSOT-faithful band (ADR-039/041)', () => {
  it('(a) the filter-bar META DECLARES a sourced band; the port resolves it by RESIDENCE', () => {
    const meta = nodeRegistry.getMeta('filter-bar')
    expect(meta?.band?.source).toBe('page-filters')
    // The port resolves each part by its residence — the MULTI-consumer `sourced` residence
    // by its SOURCE id (Delta 1: 'page-filters' → the filter adapter `sourcedParts`), the
    // positional `value` residence by residence alone (the engine `valueParts`). Keying by
    // the declared source id (NOT a node type) is what keeps this per-type-free.
    expect(getPartSource('sourced', 'page-filters')).toBe(sourcedParts)
    expect(getPartSource('value')).toBe(valueParts)
  })

  it('(b/c) enumerate through the ONE port — STABLE-KEY addresses, discriminated schemas', () => {
    const meta  = nodeRegistry.getMeta('filter-bar') as ObjectMeta | undefined
    const items = enumerateParts(nodeProps, meta, { filterSchema }, NODE_ID)

    // Scoped to the node's barIds — only `main` (2 controls), never `extra`. The ONE
    // PartAddress.partPath is the STABLE KEY `${barId}.${controlKey}` (Delta 1), NOT a
    // positional index, and carries the owning node id.
    expect(items.map((i) => i.address)).toEqual([
      { nodeId: NODE_ID, partPath: 'main.year' },
      { nodeId: NODE_ID, partPath: 'main.amount' },
    ])
    expect(items.map((i) => i.key)).toEqual(['year', 'amount'])

    // Each item's contract is the type's OWN registered ParamDef schema — DISCRIMINATED
    // (year-select ≠ range), derived from the ONE declaration, not a synthetic fixture.
    expect(items[0]!.contract).toBe(getParamSchema('year-select'))
    expect(items[1]!.contract).toBe(getParamSchema('range'))
    expect(items[0]!.contract).not.toBe(items[1]!.contract)
    expect(items[0]!.contract.length).toBeGreaterThan(0)

    // The live subject is the self-contained ParamNode (the ParamDef + its map `key`,
    // via toBarViews) read from the SSOT — the bounded subject the Inspector edits; the
    // anchor coordinate is still (barId, index), matching FilterBarShell's stamped anchors.
    expect(items[0]!.subject).toEqual({ type: 'year-select', default: 2024, key: 'year' })
    expect(items[0]!.field).toBe('main')
    expect(items[0]!.index).toBe(0)
  })

  it('(b) write commits through setBarParams by STABLE KEY — a filter-schema mutation, NO node copy', () => {
    const before = JSON.parse(JSON.stringify(nodeProps))
    // Addressed by the STABLE key `main.amount` (not a position) — resolved by key on write.
    const mut = sourcedParts.writePart(
      nodeProps, { nodeId: NODE_ID, partPath: 'main.amount' }, 'label', 'Value', { filterSchema },
    )

    expect(mut).not.toBeNull()
    expect(mut!.target).toBe('filter-schema')

    // The write is EXACTLY the SSOT reducer applied to the edited control — proven by
    // reconstructing it independently through setBarParams (no bespoke write path).
    const expected = setBarParams(filterSchema, 'main', [
      { key: 'year',   type: 'year-select', default: 2024 },
      { key: 'amount', type: 'range', label: 'Value', default: '0,100' },
    ])
    expect(mut!.target === 'filter-schema' && mut!.schema).toEqual(expected)

    // An unknown key resolves to nothing (never a silent positional rebind).
    expect(sourcedParts.writePart(
      nodeProps, { nodeId: NODE_ID, partPath: 'main.ghost' }, 'label', 'X', { filterSchema },
    )).toBeNull()

    // No denormalisation: the node container is NEVER mutated and gains NO filters copy.
    expect(nodeProps).toEqual(before)
    expect('filters' in nodeProps).toBe(false)
  })

  it('(c) selecting a filter item yields ONLY that control’s bounded contract', () => {
    const meta     = nodeRegistry.getMeta('filter-bar') as ObjectMeta | undefined
    const items    = enumerateParts(nodeProps, meta, { filterSchema }, NODE_ID)
    const selected = items.find((i) => i.address.partPath === 'main.year')!
    // The bounded projection is the control's own ParamDef schema — nothing from the
    // OTHER control (range) and nothing from the whole bar leaks in.
    expect(selected.contract).toBe(getParamSchema('year-select'))
    expect(selected.contract).not.toContainEqual(
      expect.objectContaining({ field: 'min' }), // a range-only field must be absent
    )
  })

  it('the props band (BE-1 valueParts) is UNCHANGED — homogeneous itemSchema, POSITIONAL address', () => {
    // The value adapter still enumerates a props band by dot-path over the container,
    // addressed POSITIONALLY (`${field}.${index}`) — proving the port did not regress
    // kpi-strip's shape while the sourced band moved to a stable key.
    const part: PartField = {
      field: 'items', residence: 'value', label: 'Items',
      itemSchema: [{ field: 'label', type: 'string', label: 'Label' }],
    }
    const out = valueParts.enumerateParts({ id: 'strip', items: [{ label: 'A' }, { label: 'B' }] }, part, {})
    expect(out.map((i) => i.address.partPath)).toEqual(['items.0', 'items.1'])
    expect(out[0]!.subject).toEqual({ label: 'A' })
    const mut = valueParts.writePart(
      { id: 'strip', items: [{ label: 'A' }] }, { nodeId: 'strip', partPath: 'items.0' }, 'label', 'Z', {},
    )
    expect(mut!.target).toBe('node-props')
  })
})
