// ── ApexCharts Adapter ─────────────────────────────────────────────────
//
//  ChartOutput (engine neutral format) → ApexCharts ApexOptions.
//  This is THE ONLY PLACE in the codebase that knows about ApexCharts.
//
//  Swap ApexCharts → Recharts:  write rechartsAdapter.ts, delete this file.
//  Add PDF export:              write pdfAdapter.ts using the same ChartOutput.
//  Zero engine changes in all cases.
//
//  Pattern: Grafana panel adapter / Vega-Lite renderer adapter.
//

import type { ApexOptions } from 'apexcharts'
import type { ChartOutput } from '@statdash/charts'

import { BASE }               from './apex/base'
import { buildCartesian }     from './apex/cartesian'
import { buildPie }           from './apex/pie'
import { buildContribution }  from './apex/contribution'
import { buildTreemap }       from './apex/treemap'
import { buildHBarDiverging } from './apex/hbar-diverging'

/**
 * Convert engine ChartOutput → ApexCharts ApexOptions.
 *
 * The ONLY translation point between engine and ApexCharts.
 * Input is 100% renderer-agnostic. Output is ApexCharts-specific.
 */
export function toApexOptions(output: ChartOutput): ApexOptions {
  switch (output.type) {
    case 'pie':
    case 'donut':
      return buildPie(output)

    case 'bar':
    case 'hbar':
    case 'line':
    case 'area':
    case 'waterfall':
    case 'combo':
      return buildCartesian(output)

    case 'contribution':
      return buildContribution(output)

    case 'hbar-diverging':
      return buildHBarDiverging(output)

    case 'treemap':
      return buildTreemap(output)

      // Placeholder + unknown types — engine returns empty ChartOutput, adapter returns minimal config.
      // ChartType is an open string (registry is the source of truth), so a default is required:
      // an unrendered/unregistered type degrades to the minimal base rather than crashing.
    case 'map':
    case 'sankey':
    default:
      return { ...BASE, chart: { ...BASE.chart, height: '100%' } }
  }
}
