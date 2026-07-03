import ReactApexChart              from 'react-apexcharts'
import { useContainerVisible }     from '@statdash/react/engine'
import type { ChartRendererProps } from '@statdash/react/engine'
import { useLocale }               from '@statdash/react'
import { toApexOptions }           from '../utils/toApexOptions'
import { categoricalChartHeight }  from '../utils/apex/base'

function apexChartType(type: string): 'bar' | 'line' | 'pie' | 'area' {
  if (type === 'hbar' || type === 'waterfall' || type === 'contribution') return 'bar'
  if (type === 'combo') return 'line'
  return type as 'bar' | 'line' | 'pie' | 'area'
}

export function ApexRenderer({ output, onDataHover, onDataLeave, onDataClick }: ChartRendererProps) {
  // Active locale drives the compact axis-tick glyph (en → 88.4K · ka → 88,4 ათ.);
  // hooks must run before any early return.
  const locale = useLocale()
  // Visibility gate (NaN-transform guard): a chart↔table toggle keeps the inactive
  // view MOUNTED but `display:none` ([data-view="hidden"], node-styles.css) so
  // toggling stays instant/a11y-safe. `key={chartKey}` below remounts ReactApexChart
  // on every series change — including while hidden. ApexCharts measures its host
  // box at mount to size its SVG; a 0×0/detached box (display:none) produces NaN
  // width/height/transform (console SVG errors, a broken chart on toggle-back).
  // Gating the ReactApexChart mount on `visible` (only flips true once the host is
  // actually laid out — ResizeObserver-driven) means nothing measures a 0×0 box;
  // on show, `visible` flips and the chart mounts fresh against a real box with the
  // latest data. The host div keeps its footprint whether or not the chart is
  // mounted, so the visibility measurement itself is never circular.
  const { ref: hostRef, visible } = useContainerVisible<HTMLDivElement>()
  if (output.series.length === 0) return null
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  const base     = toApexOptions(output, fontFamily, locale)
  const chartKey = output.series.map(s => s.data.map(d => d.value).join(',')).join(';')

  // Merge event handlers into options.chart.events without mutating base object
  const options: typeof base = {
    ...base,
    chart: {
      ...base.chart,
      events: {
        ...(base.chart as { events?: object } | undefined)?.events,
        ...(onDataHover != null && {
          dataPointMouseEnter: (_event: Event, _chartContext: unknown, config: { seriesIndex: number; dataPointIndex: number }) => {
            onDataHover(config.dataPointIndex)
          },
        }),
        ...(onDataLeave != null && {
          mouseLeave: () => { onDataLeave() },
        }),
        ...(onDataClick != null && {
          dataPointSelection: (_event: Event, _chartContext: unknown, config: { seriesIndex: number; dataPointIndex: number }) => {
            onDataClick(config.dataPointIndex)
          },
        }),
      },
    },
  }

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      {visible && (
        <ReactApexChart
          key={chartKey}
          options={options}
          series={options.series as ApexAxisChartSeries | number[]}
          type={apexChartType(output.type)}
          // Horizontal categorical charts size to their category count so rows never
          // cram; all other types fill the container ('100%') as before.
          height={categoricalChartHeight(output)}
        />
      )}
    </div>
  )
}