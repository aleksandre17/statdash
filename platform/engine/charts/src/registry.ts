// ── ChartRegistry — Strategy + Plugin Pattern (chart half) ────────────
//
//  Phase 8.1 split: chart interpretation moved out of @geostat/engine into
//  @geostat/charts. The registry was split BY PACKAGE rather than shared —
//  EngineRegistry (core) keeps spec resolution; ChartRegistry (here) owns
//  chart interpretation. This breaks the would-be cycle engine→charts→engine.
//
//  Usage:
//    import { chartRegistry } from '@geostat/charts'
//    chartRegistry.registerChart(myInterpreter)   // extend / override (last wins)
//

import type { DataRow, SectionContext, ChartType } from '@geostat/engine'
import type { ChartDef, ChartOutput } from './types'

// ── ChartInterpreter — plugin interface for ChartDef → ChartOutput ────
export interface ChartInterpreter {
  readonly type: ChartType
  interpret(def: ChartDef, rows: DataRow[], ctx: SectionContext): ChartOutput
}

// ── ChartRegistry ──────────────────────────────────────────────────────
export class ChartRegistry {
  private readonly _charts = new Map<string, ChartInterpreter>()

  /** Register a ChartInterpreter. Last registration wins. Fluent. */
  registerChart(interp: ChartInterpreter): this {
    this._charts.set(interp.type, interp)
    return this
  }

  chart(type: string): ChartInterpreter | undefined { return this._charts.get(type) }

  /** All registered ChartType keys — used by Constructor + validateChartDef. */
  chartTypes(): string[] { return [...this._charts.keys()] }

  hasChart(type: string): boolean { return this._charts.has(type) }
}

// ── chartRegistry — pre-populated singleton ────────────────────────────
//
//  interpreters.ts registers all 13 built-ins onto this instance as an
//  import side effect.
//
export const chartRegistry = new ChartRegistry()
