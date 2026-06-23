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

/** The triggering interaction on a data node. */
export type NodeEventTrigger = 'row:click' | 'row:hover' | 'selection:change'

/** Action: set a filter param from a row field value. */
export interface FilterAction {
  type:      'filter'
  /** The filter param key to write (e.g. 'regionId', 'time'). */
  key:       string
  /** Row field whose value is written to the filter param. */
  fromField: string
}

/** Extensible union of all declarative action types. */
export type NodeAction = FilterAction

/** Maps one trigger event to one or more actions. */
export interface NodeEventHandler {
  event:   NodeEventTrigger
  actions: NodeAction[]
}
