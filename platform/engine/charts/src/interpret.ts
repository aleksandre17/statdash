// ── Chart Dispatch ────────────────────────────────────────────────────
//
//  interpretChart() — entry point for chart interpretation.
//  Dispatches to the registered ChartInterpreter via chartRegistry.
//
//  Phase 8.1: no more setChartRegistry lazy shim. charts is its own package.
//

import type { DataRow, SectionContext } from '@geostat/engine'
import type { ChartDef, ChartOutput }   from './types'
import { chartRegistry }                from './registry'
import type { ChartRegistry }           from './registry'

/**
 * Interpret a ChartDef + DataRow[] → ChartOutput (neutral format).
 * Dispatches to the registered ChartInterpreter for def.type.
 * Falls back to placeholderOutput when the type is not registered.
 */
export function interpretChart(
  def:  ChartDef,
  rows: DataRow[],
  ctx:  SectionContext,
  reg:  ChartRegistry = chartRegistry,
): ChartOutput {
  const interp = reg.chart(def.type)
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
