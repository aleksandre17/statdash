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

/**
 * The triggering interaction on a data node.
 *   `interval:brush` (AR-42 P1) — a drag-select over a continuous axis emits a
 *   `[lo,hi]` RANGE (folded via `applySelection` `interval` mode → a range param),
 *   the range peer of the point/row gestures. Additive; all others unchanged.
 */
export type NodeEventTrigger =
  | 'point:click' | 'row:click' | 'row:hover' | 'selection:change' | 'interval:brush'

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

/**
 * Action (AR-42 P1): write a TRANSIENT highlight param that a Consumer reads in an
 * encoding *condition* to STYLE without re-querying (linked highlighting) — never a
 * query filter, so no requery. It folds through the SAME `applySelection` reducer and
 * the SAME CommandBus write point as `FilterAction` (FF-XF-ONE-WRITE-POINT); the ONLY
 * difference is downstream — a query reads a filter param, an encoding condition reads
 * a highlight param. Same write shape (`key`/`fromField`/`mode`) → one interpreter path.
 */
export interface HighlightAction {
  type:      'highlight'
  /** The highlight param key to write, OR a `{ $ctx: key }` ref that rotates with state. */
  key:       ActionField
  /** Row field whose value is written to the highlight param (defaults to `key`). */
  fromField?: ActionField
  /** Selection semantics — folded by `applySelection` (default 'replace': hover-highlight one). */
  mode?:     SelectionMode
  /** Cap for `toggle` accumulation (multi-highlight cap). */
  max?:      number
}

/**
 * Action (AR-42 P2 — DRILL-DOWN): descend a governed dimension HIERARCHY. The gesture
 * writes a DRILL-STATE param (the target level along `dimension`'s `DimensionHierarchy`)
 * through the SAME `applySelection`/CommandBus spine as `filter`/`highlight` — the only
 * difference is the WRITE VALUE SOURCE (a declared `toLevel` literal, not a clicked row
 * field) and the downstream Consumer (the metric re-renders at the drilled grain via the
 * `evalMetricDrill` seam — additivity-correct: base measures sum descendant leaves, a
 * ratio re-derives, FF-NO-SUM-OF-RATIO). Emits the `DrillTarget { dimension, level }` the
 * core `data/drill.ts` seam lowers. Law 1: `dimension` is a generic DimensionDef id, never
 * a privileged-dim literal in code; Law 2: pure data.
 *
 * A `replace`-mode fold gives free drill/roll-up toggle: the first click writes `toLevel`;
 * a re-click on the SAME level clears the param (rolls back to the metric spec's own grain).
 */
export interface DrillAction {
  type:      'drill'
  /** The DimensionDef id (registry key) whose governed hierarchy to descend (Law 1). */
  dimension: string
  /** Target hierarchy level index (0 = coarsest root; e.g. 1 = one level down). */
  toLevel:   number
  /**
   * The drill-state param key written by the gesture and read by the Consumer. Optional —
   * defaults to the `drillParamKey(dimension)` SSOT so the writer and the render Consumer
   * derive the SAME key (never a hand-copied literal). May be a `{ $ctx }` ref (state-bound).
   */
  param?:    ActionField
}

/**
 * drillParamKey — the SSOT drill-state param key for a dimension. A private, namespaced
 * key (`__drill:<dim>`) so a drill's grain state never collides with a query filter param
 * for the same dim. Parameterized by the DECLARED dimension (no privileged-dim literal,
 * Law 1). Shared by the writer (`useNodeInteractions`) and the render Consumer
 * (`resolveDrill`) so a drilled param is written and read through ONE key derivation.
 */
export function drillParamKey(dimension: string): string {
  return `__drill:${dimension}`
}

/**
 * Extensible discriminated union of all declarative action types (OCP — a new arm is
 * a new capability, the interpreter unchanged). `filter`, `highlight` and `drill` are the
 * three SELECTION-WRITE arms today: each folds a value into a param through the one
 * `applySelection`/CommandBus spine, distinguished only by the write-value SOURCE (a
 * clicked row field vs a declared drill level) and how the Consumer reads the param
 * (query filter · encoding condition · drilled metric grain).
 */
export type NodeAction = FilterAction | HighlightAction | DrillAction

/**
 * The action types that WRITE a selection param through the `applySelection`/CommandBus
 * spine (as opposed to, e.g., a future navigate arm). A new selection-write arm joins by
 * membership here — a declaration, not an interpreter branch (FF-ACTION-UNION-OCP).
 */
export const SELECTION_WRITE_ACTIONS = new Set<NodeAction['type']>(['filter', 'highlight', 'drill'])

/** Maps one trigger event to one or more actions. */
export interface NodeEventHandler {
  event:   NodeEventTrigger
  actions: NodeAction[]
}
