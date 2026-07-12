// ── useNodeInteractions — THE one cross-filter interaction adapter ──────────
//
//  The missing runtime adapter for the declarative `NodeBase.on[]` port (which
//  was typed but never wired) + the historically-dropped `dataLinks` filter
//  branch. EVERY data surface (chart point-click, table row-click, map
//  selection) routes its gesture through this ONE hook — none wires selection
//  itself. This is the structural guarantee against a second bespoke fork
//  (the geograph was the only pre-existing selection writer; now it is the
//  FIRST CONSUMER of the shared seam, not a one-off).
//
//  Contract:
//    emit(trigger, row) → for each def.on[] handler whose event === trigger,
//    fold each FilterAction through the pure `applySelection` reducer against
//    the clicked row + current param, then write via the ONE CommandBus point
//    (filter:set for a single write, filter:setMany for an atomic multi-write —
//    one URL mutation, permalink-consistent). dataLinks with target:'filter'
//    fold in identically (replace mode). Navigation (dataLinks 'navigate') is
//    NOT a selection write and stays the caller's concern (nav:drill).
//
//  No shell calls useFilter().set for a selection — enforced by
//  FF-XF-ONE-WRITE-POINT. Selection IS a filter param (Law 1, SSOT).
//

import { useCallback }        from 'react'
import { applySelection, resolveRef } from '@statdash/engine'
import type { DimVal, RefServices } from '@statdash/engine'
import type { RenderContext } from './types'
import type { NodeBase }      from './types'
import type { NodeEventTrigger, FilterAction, ActionField, NodeAction } from './node-events'
import { SELECTION_WRITE_ACTIONS, drillParamKey } from './node-events'

// ── resolveActionField — lower a state-bindable action field (AR-36/AR-38 §4.1) ──
//
//  A FilterAction `key`/`fromField` may be a bare literal (byte-identical) OR a
//  `{ $ctx: key }` ref that rotates with render state. This is the SINGLE lowering
//  point for both — it REUSES the one ref dispatcher (`resolveRef`): `$ctx` binds
//  `services.dims` (the OLAP coordinate) with a `$ref` fallback to `services.vars`
//  (a derived page var, e.g. `_selKey`), exactly mirroring `resolveEncodingRefs`.
//  A bare string resolves to itself → zero behaviour change for every stored config.
//
//  Exported so the read side (TableShell's selectedIds, which must resolve the SAME
//  target param the click writes — SSOT) lowers the key through this ONE path, never
//  a bespoke re-implementation.
export function resolveActionField(
  v:        ActionField | undefined,
  services: RefServices,
): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v
  // $ctx → dims, else $ref → vars — the one dispatcher, no second read path.
  const resolved = resolveRef(v, services) ?? resolveRef({ $ref: v.$ctx }, services)
  return resolved == null ? undefined : String(resolved)
}

// ── selectionWrite — a SELECTION-WRITE arm's (key, value, mode) for THIS gesture ──
//
//  Each selection-write arm DECLARES how it sources its param write; this ONE resolver
//  reads that declaration so the emit loop stays a generic mechanism over the arms (no
//  per-type branch in the fold spine — Bounded-Element / OCP). Returns the fold inputs,
//  or `undefined` when the arm cannot resolve a write for this gesture (skipped, no write):
//    • filter / highlight — the value is a clicked ROW FIELD (`fromField ?? key`); the
//      target param is `key`. Both may be `{ $ctx }` refs (lowered via resolveActionField).
//    • drill              — the value is the declared `toLevel` LITERAL; the target param
//      is `param ?? drillParamKey(dimension)`, always a `replace` fold (drill/roll-up toggle).
function selectionWrite(
  action:   NodeAction,
  row:      Record<string, unknown>,
  services: RefServices,
): { key: string; value: string; mode: FilterAction['mode']; max?: number } | undefined {
  if (action.type === 'drill') {
    const key = resolveActionField(action.param, services) ?? drillParamKey(action.dimension)
    return { key, value: String(action.toLevel), mode: 'replace' }
  }
  // filter / highlight — same row-field write shape (distinguished only downstream).
  const key = resolveActionField(action.key, services)
  if (!key) return undefined                                    // unresolved param → no write
  const field = resolveActionField(action.fromField, services) ?? key
  const raw   = row[field]
  if (raw === undefined || raw === null) return undefined       // no value → no write
  return { key, value: String(raw), mode: action.mode, max: action.max }
}

export interface NodeInteractions {
  /**
   * Fire a declarative gesture. Reads def.on[] (+ dataLinks filter branch),
   * resolves each FilterAction against `row`, and writes the resulting
   * selection param(s) through ctx.bus. Inert when the node declares no
   * matching handler (no gesture, no write).
   */
  emit: (trigger: NodeEventTrigger, row: Record<string, unknown>) => void
}

export function useNodeInteractions(def: NodeBase, ctx: RenderContext): NodeInteractions {
  const { on, dataLinks } = def
  const { filterParams, resolveLinks, bus, sectionCtx, vars } = ctx

  const emit = useCallback(
    (trigger: NodeEventTrigger, row: Record<string, unknown>) => {
      // Accumulate all param writes for THIS gesture, then dispatch once
      // (atomic — a multi-action gesture is one URL mutation).
      const writes: Record<string, string> = {}
      // Ref lowering services — dims (OLAP coordinate) + vars (derived page vars).
      // The SAME (dims, vars) pair resolveEncodingRefs/resolvePipeRefs thread, so a
      // state-bound `{$ctx:_selKey}` action field rotates in lockstep with the pivot.
      const services: RefServices = { dims: sectionCtx.dims, vars }

      const fold = (key: string, value: string, mode: FilterAction['mode'], max?: number) => {
        const current = writes[key] ?? (filterParams[key] == null ? '' : String(filterParams[key]))
        writes[key] = applySelection(mode ?? 'replace', current, value, max)
      }

      // 1. Declarative on[] handlers (the promoted port). Every SELECTION-WRITE arm
      //    (filter · highlight — AR-42 P1) folds through THIS one path: a highlight
      //    writes a transient param a Consumer styles from (no requery), a filter
      //    scopes a query — same write, distinguished only downstream. `key`/`fromField`
      //    may be state-bound refs — lowered through the one dispatcher (AR-36/AR-38).
      for (const handler of on ?? []) {
        if (handler.event !== trigger) continue
        for (const action of handler.actions) {
          if (!SELECTION_WRITE_ACTIONS.has(action.type)) continue
          const w = selectionWrite(action, row, services)
          if (!w) continue                                          // arm resolved no write
          fold(w.key, w.value, w.mode, w.max)
        }
      }

      // 2. dataLinks target:'filter' — the branch useChartInteractions dropped.
      //    (replace mode: DataLink filter has no mode/max vocabulary.)
      if (dataLinks?.length) {
        for (const link of resolveLinks(dataLinks, row as Record<string, DimVal>)) {
          if (link.action === 'filter' && link.filterKey) {
            fold(link.filterKey, link.filterValue == null ? '' : String(link.filterValue), 'replace')
          }
        }
      }

      const entries = Object.entries(writes)
      if (entries.length === 0) return
      if (entries.length === 1) {
        bus.dispatch({ type: 'filter:set', key: entries[0][0], value: entries[0][1] })
      } else {
        bus.dispatch({ type: 'filter:setMany', values: writes })
      }
    },
    [on, dataLinks, filterParams, resolveLinks, bus, sectionCtx, vars],
  )

  return { emit }
}
