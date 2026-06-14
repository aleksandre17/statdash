// ── EngineRegistry — Strategy + Plugin Pattern ────────────────────────
//
//  The registry is what separates a "folder of functions" from a
//  commercial rendering engine. It enables:
//
//    - New DataSpec types without touching interpretSpec switch
//    - New chart types without touching any chart code
//    - Override / replace built-in behavior per deployment
//    - Schema generation (Constructor knows all registered types)
//    - Runtime capability queries ("can this engine render 'sankey'?")
//
//  Pattern: Grafana panel plugin registry, Vega-Lite mark registry,
//           Retool component registry, Builder.io plugin system.
//
//  Usage:
//    // Extend with custom type
//    defaultRegistry.registerSpec(mySpecResolver)
//    defaultRegistry.registerChart(myChartInterpreter)
//
//    // Override a built-in
//    defaultRegistry.registerSpec(optimizedRowListResolver)  // last wins
//

import type { DataRow, EngineRow } from '../data/encoding'
import type { DataSpec }           from '../config/section'
import type { SectionContext, ChartType } from '../core/context'
import type { ChartDef, ChartOutput }     from '../chart/types'
import type { DataStore }          from '../data/store'

// ── SpecResolver — plugin interface for DataSpec → EngineRow[] ────────
//
//  Implement this to add a new DataSpec type or replace a built-in.
//  The type discriminant must match DataSpec.type exactly.
//
//  Resolvers return EngineRow[] — neutral records, no renderer concepts.
//  Encoding (field→channel mapping) happens at the renderer boundary.
//
export interface SpecResolver<T extends DataSpec = DataSpec> {
  /** Matches DataSpec.type — used as the registry key. */
  readonly type: T['type']
  resolve(spec: T, ctx: SectionContext, store: DataStore): EngineRow[]
}

// ── ChartInterpreter — plugin interface for ChartDef → ChartOutput ────
//
//  The engine produces neutral ChartOutput — no ApexCharts, no Recharts.
//  The React adapter (apexAdapter.ts) converts ChartOutput → ApexOptions.
//
//  Swap rendering library:  change apexAdapter.ts only.
//  Add server-side PNG:      add canvasAdapter.ts.
//  Add PDF export:           add pdfAdapter.ts.
//  Zero engine changes in all cases.
//
export interface ChartInterpreter {
  readonly type: ChartType
  interpret(def: ChartDef, rows: DataRow[], ctx: SectionContext): ChartOutput
}

// ── EngineRegistry ────────────────────────────────────────────────────

export class EngineRegistry {
  private readonly _specs  = new Map<string, SpecResolver>()
  private readonly _charts = new Map<string, ChartInterpreter>()

  /** Register a SpecResolver. Last registration wins. Fluent. */
  registerSpec<T extends DataSpec>(resolver: SpecResolver<T>): this {
    this._specs.set(resolver.type as string, resolver as SpecResolver)
    return this
  }

  /** Register a ChartInterpreter. Last registration wins. Fluent. */
  registerChart(interp: ChartInterpreter): this {
    this._charts.set(interp.type, interp)
    return this
  }

  spec(type: string): SpecResolver | undefined  { return this._specs.get(type)  }
  chart(type: string): ChartInterpreter | undefined { return this._charts.get(type) }

  /** All registered DataSpec type keys — used by Constructor + validateDataSpec. */
  specTypes(): string[]  { return [...this._specs.keys()]  }
  /** All registered ChartType keys — used by Constructor + validateChartDef. */
  chartTypes(): string[] { return [...this._charts.keys()] }

  hasSpec(type: string): boolean  { return this._specs.has(type)  }
  hasChart(type: string): boolean { return this._charts.has(type) }
}

// ── defaultRegistry — pre-populated with all built-in resolvers ────────
//
//  Extend at application level without touching engine source:
//    import { defaultRegistry } from '@geostat/engine'
//    defaultRegistry.registerSpec(myResolver)
//    defaultRegistry.registerChart(myInterpreter)
//
export const defaultRegistry = new EngineRegistry()