// ── Built-in ChartInterpreters ─────────────────────────────────────────
//
//  Each ChartType is implemented as a ChartInterpreter class.
//  Interpreters read DataRow[] + ChartDef and produce ChartOutput —
//  the neutral, renderer-agnostic format.
//
//  Swap rendering library = change only the adapter. Zero engine changes.
//  Pattern: Grafana panel plugin / Vega-Lite renderer-agnostic spec.
//

import type { DataRow }   from '../data/encoding'
import type { ChartType } from '../core/context'
import type {
  ChartDef, ChartOutput, ChartSeries, ChartDataPoint, AxisOutput, LegendOutput, TooltipOutput,
} from '../chart/types'
import type { ChartInterpreter } from './engine'
import { formatFieldValue, resolveThresholdColor, resolveFieldConfig } from '../field/utils'
import { placeholderOutput }     from '../chart/engine'
import { defaultRegistry }       from './engine'

// ── Shared helpers ─────────────────────────────────────────────────────

function groupBySeries(rows: DataRow[], defaultName: string): Map<string, DataRow[]> {
  const map = new Map<string, DataRow[]>()
  for (const row of rows) {
    const key = row.series ?? defaultName
    const bucket = map.get(key)
    if (bucket) bucket.push(row)
    else map.set(key, [row])
  }
  return map
}

function buildDataPoint(
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

function buildAxes(def: ChartDef): ChartOutput['axes'] {
  const fc = def.fieldConfig
  const x: AxisOutput  = { ...def.axes?.x }
  const y: AxisOutput  = {
    unit:     def.axes?.y?.unit,
    decimals: def.axes?.y?.decimals ?? fc?.decimals,
    min:      def.axes?.y?.min      ?? fc?.min,
    max:      def.axes?.y?.max      ?? fc?.max,
  }
  const y2 = def.axes?.y2 ? { ...def.axes.y2 } : undefined
  return { x, y, y2 }
}

function buildLegend(def: ChartDef, seriesCount: number): LegendOutput {
  const cfg = def.legend
  return { show: cfg?.show !== undefined ? cfg.show : seriesCount > 1, position: cfg?.position }
}

function buildTooltip(def: ChartDef, defaultShared: boolean): TooltipOutput {
  const mode = def.tooltip?.mode
  if (mode === 'none') return { show: false }
  if (mode === 'single') return { show: true, shared: false }
  if (mode === 'multi')  return { show: true, shared: true  }
  return { show: true, shared: defaultShared }
}

function uniqueLabels(rows: DataRow[]): string[] {
  const seen: string[] = []
  const set = new Set<string>()
  for (const r of rows) { if (!set.has(r.label)) { seen.push(r.label); set.add(r.label) } }
  return seen
}

// ── BarInterpreter (handles 'bar' and 'hbar') ─────────────────────────

class BarInterpreter implements ChartInterpreter {
  readonly type: ChartType
  constructor(type: ChartType = 'bar') { this.type = type }

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const chartRows  = rows.filter((r) => !r.isTotal && !r.isSeparator)
    const grouped    = groupBySeries(chartRows, def.label)
    const seriesKeys = [...grouped.keys()]
    const fc         = def.fieldConfig
    const categories = uniqueLabels(chartRows)

    const series: ChartSeries[] = seriesKeys.map((name) => {
      const seriesRows  = grouped.get(name)!
      const resolved    = resolveFieldConfig(fc, name)
      const rowsByLabel = new Map(seriesRows.map((r) => [r.label, r]))
      return {
        name,
        data:  categories.map((lbl) => {
          const r = rowsByLabel.get(lbl)
          return r ? buildDataPoint(r, resolved) : { value: 0, formatted: formatFieldValue(0, resolved) }
        }),
        color: seriesRows[0]?.color || '#6B7B8D',
      }
    })

    return {
      type: this.type, height: def.height, categories, series,
      axes: buildAxes(def), stacked: def.stacked ?? false, horizontal: this.type === 'hbar',
      legend: buildLegend(def, series.length),
      tooltip: buildTooltip(def, this.type !== 'hbar'),
      annotations: [],
      ...(def.dataLabels !== undefined ? { dataLabels: def.dataLabels } : {}),
    }
  }
}

// ── LineInterpreter ────────────────────────────────────────────────────

class LineInterpreter implements ChartInterpreter {
  readonly type = 'line' as const
  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const out = new BarInterpreter('line' as ChartType).interpret(def, rows)
    return { ...out, type: 'line', horizontal: false }
  }
}

// ── AreaInterpreter ────────────────────────────────────────────────────

class AreaInterpreter implements ChartInterpreter {
  readonly type = 'area' as const
  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const out = new BarInterpreter('area' as ChartType).interpret(def, rows)
    return { ...out, type: 'area', horizontal: false }
  }
}

// ── PieInterpreter (handles 'pie' and 'donut') ────────────────────────

class PieInterpreter implements ChartInterpreter {
  readonly type: ChartType
  constructor(type: ChartType = 'pie') { this.type = type }

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const fc        = def.fieldConfig
    const totalRow  = rows.find((r) => r.isTotal)
    const sliceRows = rows.filter((r) => !r.isTotal && r.value !== 0)
    if (sliceRows.length === 0) return placeholderOutput(def)
    const series: ChartSeries[] = [{
      name:  def.label,
      data:  sliceRows.map((r) => buildDataPoint(r, resolveFieldConfig(fc, r.label))),
      color: '#6B7B8D',
    }]
    return {
      type: this.type, height: def.height,
      categories: sliceRows.map((r) => r.label), series,
      axes: { x: {}, y: {} }, stacked: false, horizontal: false,
      legend: buildLegend(def, sliceRows.length),
      tooltip: buildTooltip(def, false),
      annotations: [],
      ...(totalRow !== undefined ? { total: totalRow.value } : {}),
      ...(def.centerLabel ? { centerLabel: def.centerLabel } : {}),
    }
  }
}

// ── WaterfallInterpreter ───────────────────────────────────────────────
//
//  Stacked bar with invisible 'spacer' series that floats each bar
//  above the cumulative total. Adapter renders spacer with opacity 0.
//

class WaterfallInterpreter implements ChartInterpreter {
  readonly type = 'waterfall' as const

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const fc      = def.fieldConfig
    const hasTotals = rows.some((r) => r.isTotal)
    let cumulative = 0

    const spacerData: ChartDataPoint[] = []
    const barData:    ChartDataPoint[] = []

    for (const row of rows) {
      if (row.isSeparator) {
        spacerData.push({ value: 0, formatted: '' })
        barData.push(   { value: 0, formatted: '' })
        continue
      }
      if (hasTotals && row.isTotal) {
        spacerData.push({ value: 0, formatted: '' })
        barData.push(buildDataPoint({ ...row, value: cumulative }, resolveFieldConfig(fc, row.label)))
      } else {
        const base = row.value >= 0 ? cumulative : cumulative + row.value
        spacerData.push({ value: Math.max(0, base), formatted: '' })
        barData.push(buildDataPoint(row, resolveFieldConfig(fc, row.label)))
        cumulative += row.value
      }
    }

    const series: ChartSeries[] = [
      { name: '__spacer__', data: spacerData, color: 'transparent' },
      { name: def.label,    data: barData,    color: rows[0]?.color ?? '#6B7B8D' },
    ]

    return {
      type: 'waterfall', height: def.height,
      categories: rows.map((r) => r.label), series,
      axes: buildAxes(def), stacked: true, horizontal: false,
      legend: { show: false },
      tooltip: buildTooltip(def, false),
      annotations: [],
    }
  }
}

// ── ComboInterpreter ───────────────────────────────────────────────────
//
//  Mixed bar + line. Alternates bar/line per series.
//  Supports dual Y-axis when def.axes.y2 is configured.
//

class ComboInterpreter implements ChartInterpreter {
  readonly type = 'combo' as const

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const grouped    = groupBySeries(rows, def.label)
    const seriesKeys = [...grouped.keys()]
    const fc         = def.fieldConfig
    const hasY2      = !!def.axes?.y2
    const categories = uniqueLabels(rows)

    const series: ChartSeries[] = seriesKeys.map((name, idx) => {
      const seriesRows  = grouped.get(name)!
      const resolved    = resolveFieldConfig(fc, name)
      const rowsByLabel = new Map(seriesRows.map((r) => [r.label, r]))
      const seriesType: 'bar' | 'line' = idx % 2 === 0 ? 'bar' : 'line'
      const yAxis: 'y' | 'y2' | undefined = hasY2 && seriesType === 'line' ? 'y2' : undefined
      return {
        name,
        data: categories.map((lbl) => {
          const r = rowsByLabel.get(lbl)
          return r ? buildDataPoint(r, resolved) : { value: 0, formatted: formatFieldValue(0, resolved) }
        }),
        color: seriesRows[0]?.color || '#6B7B8D',
        seriesType, yAxis,
      }
    })

    return {
      type: 'combo', height: def.height, categories, series,
      axes: buildAxes(def), stacked: false, horizontal: false,
      legend: buildLegend(def, series.length),
      tooltip: buildTooltip(def, true),
      annotations: [],
    }
  }
}

// ── TreemapInterpreter ─────────────────────────────────────────────────
//
//  Treemap: each row = one tile, sized by value.
//  Same per-row color logic as PieInterpreter — thresholdColor carries
//  the DataRow.color through to the adapter.
//

class TreemapInterpreter implements ChartInterpreter {
  readonly type = 'treemap' as const

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const fc = def.fieldConfig
    // Squarify layout: isTotal row anchors top-left when rendered first.
    // Pipe sort is table-optimised (total last); re-sort here for visual layout only.
    const hasTotal  = rows.some((r) => r.isTotal)
    const chartRows = hasTotal
      ? [...rows].sort((a, b) => {
          if (!!a.isTotal !== !!b.isTotal) return a.isTotal ? -1 : 1
          return b.value - a.value
        })
      : rows
    const series: ChartSeries[] = [{
      name:  def.label,
      data:  chartRows.map((r) => buildDataPoint(r, resolveFieldConfig(fc, r.label))),
      color: chartRows[0]?.color ?? '#0080BE',
    }]
    return {
      type: 'treemap', height: def.height,
      categories: chartRows.map((r) => r.label), series,
      axes: { x: {}, y: {} }, stacked: false, horizontal: false,
      legend: { show: false },
      tooltip: buildTooltip(def, false),
      annotations: [],
    }
  }
}

// ── HBarDivergingInterpreter ───────────────────────────────────────────
//
//  Position-based horizontal bar for SNA T-account diverging charts.
//  Unlike BarInterpreter, does NOT deduplicate by label — each DataRow
//  occupies its own y-axis slot identified by id. This lets the same
//  label appear at multiple positions (e.g. B1G as closing of one account
//  and opening of the next), enabling the carry-forward chain visual.
//
//  Two series expected: 'Resources' (positive → right) and 'Uses'
//  (negative → left). Returns type 'hbar' so apexAdapter builds a
//  standard horizontal bar with correct axes.
//

class HBarDivergingInterpreter implements ChartInterpreter {
  readonly type = 'hbar-diverging' as const

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    // Separate group-header separators from actual data rows.
    // Separators become ChartGroup entries; data rows drive series + categories.
    const groups: Array<{ label: string; color: string; length: number }> = []
    const dataRows: DataRow[] = []

    for (const row of rows) {
      if (row.isSeparator) {
        groups.push({ label: row.label, color: row.color ?? '#6B7B8D', length: 0 })
      } else {
        if (groups.length > 0) groups[groups.length - 1].length++
        dataRows.push(row)
      }
    }

    const grouped    = groupBySeries(dataRows, def.label)
    const seriesKeys = [...grouped.keys()]
    const fc         = def.fieldConfig
    const categories = dataRows.map((r) => r.label)
    const posById    = new Map(dataRows.map((r, i) => [r.id, i]))

    const series: ChartSeries[] = seriesKeys.map((name) => {
      const seriesRows = grouped.get(name)!
      const resolved   = resolveFieldConfig(fc, name)
      const empty      = { value: 0, formatted: formatFieldValue(0, resolved) }
      const data: ChartDataPoint[] = Array.from({ length: dataRows.length }, () => ({ ...empty }))
      for (const r of seriesRows) {
        const pos = posById.get(r.id)
        if (pos !== undefined) data[pos] = buildDataPoint(r, resolved)
      }
      return {
        name,
        data,
        color: seriesRows.find((r) => !r.isSeparator)?.color ?? '#6B7B8D',
      }
    })

    if (def.compact) {
      // Keep only rows where at least one series has a non-zero value
      const keepMask      = Array.from({ length: dataRows.length }, (_, i) =>
        series.some((s) => s.data[i].value !== 0),
      )
      const compactCats   = categories.filter((_, i) => keepMask[i])
      const compactSeries = series.map((s) => ({ ...s, data: s.data.filter((_, i) => keepMask[i]) }))
      let offset = 0
      const compactGroups = groups.map((g) => {
        const kept = keepMask.slice(offset, offset + g.length).filter(Boolean).length
        offset += g.length
        return { ...g, length: kept }
      })
      return {
        type: 'hbar-diverging' as const, height: def.height,
        categories: compactCats, series: compactSeries,
        axes: buildAxes(def), stacked: false, horizontal: true,
        legend: buildLegend(def, compactSeries.length),
        tooltip: buildTooltip(def, false),
        annotations: [], groups: compactGroups, compact: true,
      }
    }

    return {
      type: 'hbar-diverging', height: def.height, categories, series,
      axes: buildAxes(def), stacked: false, horizontal: true,
      legend: buildLegend(def, series.length),
      tooltip: buildTooltip(def, false),
      annotations: [],
      groups,
    }
  }
}

// ── ContributionInterpreter ────────────────────────────────────────────
//
//  Expenditure-equation bar chart: C + I + X − M = GDP.
//  All bars start at zero with absolute height (Math.abs(value)).
//  Negative-valued rows (imports) get a "(-)" prefix on the axis label;
//  positive rows get "(+)"; the isTotal row gets "(=)".
//  Per-bar color comes from DataRow.color (thresholdColor slot).
//
//  The prefix logic lives here — not in the config pipe — because it is
//  a pure rendering decision that depends only on sign and isTotal status.
//

class ContributionInterpreter implements ChartInterpreter {
  readonly type = 'contribution' as const

  interpret(def: ChartDef, rows: DataRow[]): ChartOutput {
    const fc       = def.fieldConfig
    const totalRow = rows.find((r) => r.isTotal)
    const dataRows = rows.filter((r) => !r.isTotal && !r.isSeparator)

    const categories: string[] = dataRows.map((r) =>
      (r.value < 0 ? '(-) ' : '(+) ') + r.label,
    )
    const pts: ChartDataPoint[] = dataRows.map((r) => {
      const resolved = resolveFieldConfig(fc, r.label)
      return {
        value:          Math.abs(r.value),
        formatted:      formatFieldValue(Math.abs(r.value), resolved),
        thresholdColor: r.color || undefined,
      }
    })

    if (totalRow) {
      categories.push('(=) ' + totalRow.label)
      const resolved = resolveFieldConfig(fc, totalRow.label)
      pts.push({
        value:          totalRow.value,
        formatted:      formatFieldValue(totalRow.value, resolved),
        thresholdColor: totalRow.color || '#E53E3E',
      })
    }

    return {
      type:        'contribution',
      height:      def.height,
      categories,
      series:      [{ name: def.label, data: pts, color: '#0080BE' }],
      axes:        buildAxes(def),
      stacked:     false,
      horizontal:  false,
      legend:      { show: false },
      tooltip:     buildTooltip(def, false),
      annotations: [],
    }
  }
}

// ── PlaceholderInterpreter ─────────────────────────────────────────────

class PlaceholderInterpreter implements ChartInterpreter {
  constructor(readonly type: ChartType) {}
  interpret(def: ChartDef): ChartOutput { return placeholderOutput(def) }
}

// ── Register all built-in chart interpreters ───────────────────────────

defaultRegistry
  .registerChart(new BarInterpreter('bar'))
  .registerChart(new BarInterpreter('hbar'))
  .registerChart(new HBarDivergingInterpreter())
  .registerChart(new LineInterpreter())
  .registerChart(new AreaInterpreter())
  .registerChart(new PieInterpreter('pie'))
  .registerChart(new PieInterpreter('donut'))
  .registerChart(new WaterfallInterpreter())
  .registerChart(new ContributionInterpreter())
  .registerChart(new ComboInterpreter())
  .registerChart(new TreemapInterpreter())
  .registerChart(new PlaceholderInterpreter('map'))
  .registerChart(new PlaceholderInterpreter('sankey'))
