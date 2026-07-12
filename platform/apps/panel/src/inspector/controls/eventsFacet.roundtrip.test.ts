// ── FF-EVENTS-ROUNDTRIP — authored on[] is a valid, interpretable interaction spec ──
//
//  The EVENTS facet's authoring→serialize→INTERPRET invariant (SPEC slice 4 — closing
//  the AR-42 loop from the panel: build → declare → runs):
//    1. The authoring vocabulary IS the engine union SSOT — every declared trigger /
//       NodeAction arm is offered (the tsc-exhaustive Record tables; asserted at runtime).
//    2. The reducers build a `NodeEventHandler[]` whose shape MATCHES the engine grammar
//       the runtime interprets — proven by feeding the authored drill/filter through the
//       SAME exported spine primitives (`drillParamKey`, `resolveActionField`,
//       `applySelection`) that `useNodeInteractions` folds with (no bespoke re-parse).
//    3. JSON round-trip (serialize → re-parse) is lossless; empties are pruned; immutable.
//  Kept PURE (no DOM) — drives the model reducers + the engine reducers directly.
//
import { describe, it, expect } from 'vitest'
import { applySelection } from '@statdash/engine'
import { drillParamKey, resolveActionField } from '@statdash/react/engine'
import type { NodeEventHandler } from '@statdash/react/engine'
import {
  TRIGGER_LABELS, ACTION_ARM_LABELS, ACTION_ARM_SCHEMAS,
  NODE_EVENT_TRIGGERS, NODE_ACTION_TYPES, newAction,
  addHandler, addAction, setActionType, setActionParam, setHandlerTrigger,
  removeHandler, removeAction,
} from './eventsFacetModel'

describe('FF-EVENTS-ROUNDTRIP — authored on[] is a valid, interpretable interaction spec', () => {
  it('the authoring vocabulary mirrors the engine union SSOT (every arm/trigger offered)', () => {
    // NodeAction arms — the three the runtime folds today.
    expect(new Set(NODE_ACTION_TYPES)).toEqual(new Set(['filter', 'highlight', 'drill']))
    // Every arm carries a label, a param schema and a default constructor (tsc-exhaustive
    // Records guarantee this; assert at runtime that no arm is silently un-offered).
    for (const arm of NODE_ACTION_TYPES) {
      expect(ACTION_ARM_LABELS[arm], arm).toBeTruthy()
      expect(ACTION_ARM_SCHEMAS[arm], arm).toBeTruthy()
      expect(newAction(arm).type, arm).toBe(arm)
    }
    // NodeEventTrigger vocabulary — the declared gestures, each with a label.
    expect(NODE_EVENT_TRIGGERS).toContain('point:click')
    expect(NODE_EVENT_TRIGGERS).toContain('row:click')
    expect(NODE_EVENT_TRIGGERS).toContain('selection:change')
    for (const t of NODE_EVENT_TRIGGERS) expect(TRIGGER_LABELS[t], t).toBeTruthy()
  })

  it("a drill's `dimension` is a GOVERNED enum-ref (Law 1 — pick a noun, never a literal)", () => {
    const drillSchema = ACTION_ARM_SCHEMAS.drill
    const dim = drillSchema.find((f) => f.field === 'dimension')!
    expect(dim.type).toBe('enum-ref')
    expect(dim.source).toBe('dimensions')            // the governed DimensionDef catalog
    expect(drillSchema.some((f) => f.field === 'toLevel')).toBe(true)
  })

  it('the :3013 gesture is authorable: point:click → drill geo toLevel 1 (the AR-42 loop)', () => {
    // Build it exactly as the panel does — through the reducers, one write at a time.
    let on = addHandler(undefined, 'point:click')
    on = addAction(on, 0, 'drill')
    on = setActionParam(on, 0, 0, 'dimension', 'geo')
    on = setActionParam(on, 0, 0, 'toLevel', 1)

    const expected: NodeEventHandler[] = [
      { event: 'point:click', actions: [{ type: 'drill', dimension: 'geo', toLevel: 1 }] },
    ]
    expect(on).toEqual(expected)

    // …and it is INTERPRETABLE by the SAME spine the runtime uses. A drill folds through
    // `applySelection('replace')` writing `drillParamKey(dimension) = String(toLevel)` —
    // exactly `selectionWrite`'s drill branch. So the authored spec drills `geo` on click.
    const action = on[0]!.actions[0] as { dimension: string; toLevel: number }
    const key = drillParamKey(action.dimension)
    expect(key).toBe('__drill:geo')
    expect(applySelection('replace', '', String(action.toLevel))).toBe('1')
    // A re-click on the SAME level rolls up (replace-fold clears an equal value) — the
    // free drill/roll-up toggle the grammar documents.
    expect(applySelection('replace', '1', '1')).toBe('')
  })

  it('a filter action folds through the SAME row-field write spine the runtime uses', () => {
    // Author: row:click → filter region from the clicked row's `region` field.
    let on = addHandler(undefined, 'row:click')
    on = addAction(on, 0, 'filter')
    on = setActionParam(on, 0, 0, 'key', 'region')
    on = setActionParam(on, 0, 0, 'fromField', 'region')

    expect(on).toEqual([
      { event: 'row:click', actions: [{ type: 'filter', key: 'region', fromField: 'region' }] },
    ])

    // Interpretability: resolveActionField lowers the (literal) key/fromField, then the
    // clicked row value folds via applySelection — the runtime's exact filter path.
    const services = { dims: {}, vars: {} }
    const filter = on[0]!.actions[0] as { key: string; fromField: string }
    const key = resolveActionField(filter.key, services)
    const field = resolveActionField(filter.fromField, services) ?? key!
    const row = { region: 'GE-TB' }
    expect(key).toBe('region')
    expect(applySelection('replace', '', String(row[field as keyof typeof row]))).toBe('GE-TB')
  })

  it('switching an action arm resets to the new arm default (no stale cross-arm params)', () => {
    let on = addHandler(undefined, 'point:click')
    on = addAction(on, 0, 'filter')
    on = setActionParam(on, 0, 0, 'key', 'region')
    // Switch filter → drill: the `key` (filter-only) must NOT leak; drill starts clean.
    on = setActionType(on, 0, 0, 'drill')
    expect(on[0]!.actions[0]).toEqual({ type: 'drill', dimension: '', toLevel: 1 })
  })

  it('clearing a param PRUNES the key (a cleared picker drops the field, byte-clean)', () => {
    let on = addHandler(undefined, 'row:click')
    on = addAction(on, 0, 'filter')
    on = setActionParam(on, 0, 0, 'key', 'region')
    on = setActionParam(on, 0, 0, 'fromField', 'sector')
    on = setActionParam(on, 0, 0, 'fromField', '')          // clear it
    expect(on[0]!.actions[0]).toEqual({ type: 'filter', key: 'region' })
  })

  it('serialize → re-parse is lossless (the authored spec is pure JSON data — Law 2)', () => {
    let on = addHandler(undefined, 'selection:change')
    on = addAction(on, 0, 'highlight')
    on = setActionParam(on, 0, 0, 'key', 'geo')
    on = setActionParam(on, 0, 0, 'mode', 'toggle')
    const reparsed = JSON.parse(JSON.stringify(on))
    expect(reparsed).toEqual(on)
  })

  it('the reducers are immutable — the input array is never mutated', () => {
    const before = addHandler(undefined, 'point:click')
    const snapshot = JSON.parse(JSON.stringify(before))
    const after = addAction(before, 0, 'filter')
    expect(before).toEqual(snapshot)                        // untouched
    expect(after[0]!.actions).toHaveLength(1)

    // remove paths are immutable too
    const two = addHandler(before, 'row:click')
    const twoSnap = JSON.parse(JSON.stringify(two))
    removeHandler(two, 0)
    removeAction(addAction(two, 0, 'drill'), 0, 0)
    expect(two).toEqual(twoSnap)
  })

  it('setHandlerTrigger swaps the gesture without disturbing the actions', () => {
    let on = addHandler(undefined, 'point:click')
    on = addAction(on, 0, 'drill')
    on = setHandlerTrigger(on, 0, 'row:click')
    expect(on[0]!.event).toBe('row:click')
    expect(on[0]!.actions).toHaveLength(1)
  })
})
