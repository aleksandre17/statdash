// ── Chart Dispatch Engine ─────────────────────────────────────────────
//
//  interpretChart() — engine entry point for chart interpretation.
//  Dispatches to the registered ChartInterpreter via the registry.
//
//  Lazy registry reference avoids circular imports at module load time.
//  setChartRegistry() is called from index.ts after all modules are loaded.
//

import type { DataRow }        from '../data/encoding'
import type { SectionContext } from '../core/context'
import type { EngineRegistry } from '../registry/engine'
import type { ChartDef, ChartOutput } from './types'

let _registry: EngineRegistry | null = null

export function setChartRegistry(reg: EngineRegistry): void {
  _registry = reg
}

/**
 * Interpret a ChartDef + DataRow[] → ChartOutput (neutral format).
 * Dispatches to the registered ChartInterpreter for def.type.
 * Falls back to placeholderOutput when the type is not registered.
 *
 * Call from React adapter:
 *   const output = interpretChart(def, rows, ctx)
 *   const options = toApexOptions(output)  ← in apexAdapter.ts
 */
export function interpretChart(
  def:  ChartDef,
  rows: DataRow[],
  ctx:  SectionContext,
  reg?: EngineRegistry,
): ChartOutput {
  const registry = reg ?? _registry
  if (!registry) return placeholderOutput(def)
  const interp = registry.chart(def.type)
  if (!interp) return placeholderOutput(def)
  return interp.interpret(def, rows, ctx)
}

/** Fallback ChartOutput for unregistered types (sankey, map, etc.) */
export function placeholderOutput(def: ChartDef): ChartOutput {
  return {
    type:        def.type,
    height:      def.height ?? 300,
    categories:  [],
    series:      [],
    axes:        { x: {}, y: {} },
    stacked:     false,
    horizontal:  false,
    legend:      { show: false },
    tooltip:     { show: true },
    annotations: [],
  }
}