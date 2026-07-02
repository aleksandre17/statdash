// ── Declarative event handler types — N36 cross-filter propagation ────
//
//  Constructor-ready: JSON only, no functions in config.
//  Shells read node.on[] and wire to ctx.set / ctx.resolveLinks at runtime.
//
//  Analogues:
//    Grafana   — panel.options.onClick actions
//    Retool    — component.events[].action
//    Builder.io — component.actions[]
//

import type { SelectionMode } from '@statdash/engine'

/** The triggering interaction on a data node. */
export type NodeEventTrigger = 'point:click' | 'row:click' | 'row:hover' | 'selection:change'

/** Re-export the pure reducer's mode enum as the grammar's SSOT (no drift). */
export type { SelectionMode }

/** Action: set a filter param from a row field value (cross-filter selection). */
export interface FilterAction {
  type:      'filter'
  /** The filter param key to write (e.g. 'region', 'sector'). */
  key:       string
  /**
   * Row field whose value is written to the filter param.
   * Optional — defaults to `key` (reads row[key]).
   */
  fromField?: string
  /**
   * Selection semantics — how the value folds into the current param:
   *   'replace' (default) — single-select; re-click clears.
   *   'toggle'            — accumulate a CSV OR-set (multi-select).
   *   'clear'             — clear the param.
   * Resolved by the pure `applySelection` reducer (one SSOT for every surface).
   */
  mode?:     SelectionMode
  /** Cap for `toggle` accumulation — evict-oldest past `max` (multi-select cap). */
  max?:      number
}

/** Extensible union of all declarative action types. */
export type NodeAction = FilterAction

/** Maps one trigger event to one or more actions. */
export interface NodeEventHandler {
  event:   NodeEventTrigger
  actions: NodeAction[]
}
