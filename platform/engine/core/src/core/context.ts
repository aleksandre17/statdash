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
}