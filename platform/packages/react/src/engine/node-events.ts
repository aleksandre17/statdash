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

import type { SelectionMode, CtxScopeRef } from '@statdash/engine'

/** The triggering interaction on a data node. */
export type NodeEventTrigger = 'point:click' | 'row:click' | 'row:hover' | 'selection:change'

/** Re-export the pure reducer's mode enum as the grammar's SSOT (no drift). */
export type { SelectionMode }

/**
 * A state-bindable action field (AR-36/AR-38 §4.1). Either a bare literal
 * (today's byte-identical form) OR a `{ $ctx: key }` ref that ROTATES with
 * render state — lowered in `useNodeInteractions` through the ONE ref
 * dispatcher (`resolveRef`, dims→vars fallback), exactly as `resolveEncodingRefs`
 * rotates an encoding channel. This lets a cross-filter gesture's TARGET PARAM
 * (or source field) follow the OLAP pivot: e.g. when the composition table pivots
 * (State B), the same click keeps writing `region` even though the region moved
 * to the series/column axis. Law 1: the resolved value is data (a param/field
 * name), never a privileged-dim literal in code.
 */
export type ActionField = string | CtxScopeRef

/** Action: set a filter param from a row field value (cross-filter selection). */
export interface FilterAction {
  type:      'filter'
  /**
   * The filter param key to write (e.g. 'region', 'sector'), OR a `{ $ctx: key }`
   * ref that rotates the target param with state (resolved via the one write point).
   */
  key:       ActionField
  /**
   * Row field whose value is written to the filter param.
   * Optional — defaults to `key` (reads row[key]). May be a `{ $ctx: key }` ref.
   */
  fromField?: ActionField
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
