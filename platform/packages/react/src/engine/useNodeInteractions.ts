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
import { applySelection }     from '@statdash/engine'
import type { DimVal }        from '@statdash/engine'
import type { RenderContext } from './types'
import type { NodeBase }      from './types'
import type { NodeEventTrigger, FilterAction } from './node-events'

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
  const { filterParams, resolveLinks, bus } = ctx

  const emit = useCallback(
    (trigger: NodeEventTrigger, row: Record<string, unknown>) => {
      // Accumulate all param writes for THIS gesture, then dispatch once
      // (atomic — a multi-action gesture is one URL mutation).
      const writes: Record<string, string> = {}

      const fold = (key: string, value: string, mode: FilterAction['mode'], max?: number) => {
        const current = writes[key] ?? (filterParams[key] == null ? '' : String(filterParams[key]))
        writes[key] = applySelection(mode ?? 'replace', current, value, max)
      }

      // 1. Declarative on[] handlers (the promoted port).
      for (const handler of on ?? []) {
        if (handler.event !== trigger) continue
        for (const action of handler.actions) {
          if (action.type !== 'filter') continue
          const field = action.fromField ?? action.key
          const raw   = row[field]
          if (raw === undefined || raw === null) continue           // no value → no write
          fold(action.key, String(raw), action.mode, action.max)
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
    [on, dataLinks, filterParams, resolveLinks, bus],
  )

  return { emit }
}
