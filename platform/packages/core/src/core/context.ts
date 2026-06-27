// ── Engine Context + Primitive Types ──────────────────────────────────
//
//  Everything in this file is a dependency of all other engine modules.
//  Kept minimal — only types that truly belong at the foundation layer.
//
import type { DimVal } from '../sdmx'
import type { ModeId }  from '../mode/types'

// ── UI Mode ────────────────────────────────────────────────────────────

export type { ModeId }
/** Backward compat alias — widened from closed union to open ModeId string. */
export type TimeMode = ModeId

// ── Unit ───────────────────────────────────────────────────────────────

// Open string — units are data, not an engine-owned enum.
// New unit (EUR, THOU_GEL, …) requires zero engine change.
// Grafana Stat panel.unit: string · SDMX Attribute codelist analogue.
export type Unit = string

// ── ChartType ──────────────────────────────────────────────────────────
//
//  Open string — the chart registry (EngineRegistry.registerChart) is the
//  single source of truth for which types exist. A closed union here would
//  be a mirror that drifts the moment a new interpreter registers.
//  Grafana PanelPlugin.type: string · Vega-Lite mark registry.
//  Built-ins (registry/interpreters.ts): bar · hbar · hbar-diverging · line ·
//  area · pie · donut · waterfall · contribution · treemap · map · sankey · combo.
//
export type ChartType = string

// ── SDMX-inspired Indicator (internal store primitive) ─────────────────
//
//  Used by staticStore. Not part of the config layer — config references
//  indicators by code only. The store resolves codes to values.
//
export interface Indicator {
  code:       string
  label:      string
  unit:       Unit
  color:      string
  timeseries: Record<number, number>
}

// ── SectionContext — OLAP cube coordinate ─────────────────────────────
//
//  dims is a generic dimension map — no dimension is privileged.
//  Conventional keys (SDMX-inspired):
//    'time'  → year / period   (SDMX TIME_PERIOD)
//    'geo'   → region / area   (SDMX REF_AREA)
//  Any other dimension can be added without touching this interface.
//
//  timeMode is UI meta-state (which DataSpec branch to use),
//  not a data dimension — kept separate from dims for that reason.
//
export interface SectionContext {
  timeMode: TimeMode
  dims:     Record<string, DimVal>
  /** Active UI locale — ExternalStore passes as ?lang= query param (Phase 2). Engine never reads. */
  locale?:  string
  /**
   * Active perspective id per axis param — the Harel orthogonal-regions container
   * (VISION #3). `perspectiveState['perspective'] = 'range'` means the `perspective`
   * axis is on its `range` state. ADDITIVE + OPTIONAL: nothing reads it yet (the
   * ctx-scoping + visibility wiring land in P1/P2); an absent slot is the N=1-free
   * default (no axis ⇒ identity scoping ⇒ byte-identical render, FF-ONE-VIEW-NO-MACHINERY).
   *
   * Separate from `dims` ON PURPOSE: a perspective id is UI meta-state (which named
   * query-view is active), NOT a data dimension — it never enters a store query
   * (resolveTime/withFilter keep reading `dims`, SCOPED BY the active perspective).
   * This RETIRES the Law-1-violating privileged `timeMode` field (deleted in P6) with
   * a generic Record<param, id> — one axis now, multi-axis free later (another key).
   */
  perspectiveState?: Record<string, string>
}

// ── TIME_DIM — canonical time-axis dimension key ──────────────────────
//
//  The SDMX TIME_PERIOD convention key (see header above + sdmx.ts).
//  Time-axis resolvers (timeseries / growth / kpi yoy·cagr) pin a year by
//  writing ctx.dims[TIME_DIM]; the API store reads it for from/to bounds.
//
//  This is NOT a privileged dimension — it is the single named SSOT for the
//  one conventional key those resolvers operate on, replacing a magic 'time'
//  literal scattered across modules. No dimension is special-cased elsewhere.
//
export const TIME_DIM = 'time'

// ── MEASURE_DIM — canonical measure (SDMX flow code) dimension key ────
//
//  The SDMX MEASURE / OBS-flow code key. A `{ type:'val', code }` query
//  selects the cell for THIS measure: stores match `obs[MEASURE_DIM] === code`
//  (ExternalStore._val) and the wire filter pins it as `filter[MEASURE_DIM]`.
//
//  Like TIME_DIM, this is NOT a privileged dimension — it is the single named
//  SSOT for the one conventional key the OLAP point-read (`val`) operates on,
//  replacing a magic 'measure' literal scattered across stores. The async
//  ApiStore MUST thread the val `code` through this key or every val read
//  degenerates to "all measures in the slice" → rows[0] mis-binding.
//
export const MEASURE_DIM = 'measure'

// ── atTime — pin the time-axis dim to a specific value ────────────────
//
//  Returns ctx unchanged when already at t (referential-equality fast path
//  preserved); otherwise a shallow clone with dims[TIME_DIM] overwritten.
//  Shared by registry resolvers and the KPI engine — both pin a year before
//  a store read.
//
export function atTime(t: number, ctx: SectionContext): SectionContext {
  if ((ctx.dims[TIME_DIM] as number) === t) return ctx
  return { ...ctx, dims: { ...ctx.dims, [TIME_DIM]: t } }
}