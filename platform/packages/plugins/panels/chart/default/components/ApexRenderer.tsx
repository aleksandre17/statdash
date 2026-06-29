import ReactApexChart              from 'react-apexcharts'
import type { ChartRendererProps } from '@statdash/react/engine'
import { toApexOptions }           from '../utils/toApexOptions'
import { categoricalChartHeight }  from '../utils/apex/base'

function apexChartType(type: string): 'bar' | 'line' | 'pie' | 'area' {
  if (type === 'hbar' || type === 'waterfall' || type === 'contribution') return 'bar'
  if (type === 'combo') return 'line'
  return type as 'bar' | 'line' | 'pie' | 'area'
}

export function ApexRenderer({ output, onDataHover, onDataLeave, onDataClick }: ChartRendererProps) {
  if (output.series.length === 0) return null
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  const base     = toApexOptions(output, fontFamily)
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
    <ReactApexChart
      key={chartKey}
      options={options}
      series={options.series as ApexAxisChartSeries | number[]}
      type={apexChartType(output.type)}
      // Horizontal categorical charts size to their category count so rows never
      // cram; all other types fill the container ('100%') as before.
      height={categoricalChartHeight(output)}
    />
  )
}