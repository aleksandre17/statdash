// ── Shared interpreter helpers ─────────────────────────────────────────

import type { DataRow } from '@statdash/engine'
import { formatFieldValue, resolveThresholdColor, resolveFieldConfig } from '@statdash/engine'
import type { ChartDef, ChartDataPoint, AxisOutput, LegendOutput, TooltipOutput, ChartOutput } from '../types'

export function groupBySeries(rows: DataRow[], defaultName: string): Map<string, DataRow[]> {
  const map = new Map<string, DataRow[]>()
  for (const row of rows) {
    const key = row.series ?? defaultName
    const bucket = map.get(key)
    if (bucket) bucket.push(row)
    else map.set(key, [row])
  }
  return map
}

export function buildDataPoint(
  row:    DataRow,
  config: ReturnType<typeof resolveFieldConfig>,
): ChartDataPoint {
  // Priority: fieldConfig threshold color > DataRow.color > undefined
  const thresholdColor = (config?.colorMode === 'thresholds' && config.thresholds)
    ? resolveThresholdColor(row.value, config.thresholds)
    : row.color || undefined
  const status = row.status && row.status !== 'A' ? row.status : undefined
  return { value: row.value, formatted: formatFieldValue(row.value, config), thresholdColor, status }
}

export function buildAxes(def: ChartDef): ChartOutput['axes'] {
  const fc = def.fieldConfig
  const x: AxisOutput  = { ...def.axes?.x }
  const y: AxisOutput  = {
    unit:     def.axes?.y?.unit,
    decimals: def.axes?.y?.decimals ?? fc?.decimals,
    min:      def.axes?.y?.min      ?? fc?.min,
    max:      def.axes?.y?.max      ?? fc?.max,
    hidden:   def.axes?.y?.hidden,
  }
  const y2 = def.axes?.y2 ? { ...def.axes.y2 } : undefined
  return { x, y, y2 }
}

export function buildLegend(def: ChartDef, seriesCount: number): LegendOutput {
  const cfg = def.legend
  return { show: cfg?.show !== undefined ? cfg.show : seriesCount > 1, position: cfg?.position }
}

export function buildTooltip(def: ChartDef, defaultShared: boolean): TooltipOutput {
  const mode = def.tooltip?.mode
  if (mode === 'none') return { show: false }
  if (mode === 'single') return { show: true, shared: false }
  if (mode === 'multi')  return { show: true, shared: true  }
  return { show: true, shared: defaultShared }
}

export function uniqueLabels(rows: DataRow[]): string[] {
  const seen: string[] = []
  const set = new Set<string>()
  for (const r of rows) { if (!set.has(r.label)) { seen.push(r.label); set.add(r.label) } }
  return seen
}
