import ReactApexChart              from 'react-apexcharts'
import { useContainerVisible, useNodeVisible } from '@statdash/react/engine'
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
  // ── Visibility gate — TWO composed signals (NaN-transform + redraw-race guard) ──
  //
  //  A chart↔table toggle keeps the INACTIVE view MOUNTED but `display:none`
  //  ([data-view="hidden"], node-styles.css) so toggling stays instant/a11y-safe.
  //  ApexCharts measures its host box at mount to size its SVG AND owns its own
  //  `redrawOnParentResize` observer, so a 0×0/detached box (display:none) yields
  //  NaN width/height/transform — console SVG errors + a broken chart on toggle-back.
  //
  //  (1) DECLARATIVE, SYNCHRONOUS — `useNodeVisible()` reads the view-toggle's own
  //      decision: the owning shell wraps each hidden view-slot in
  //      <NodeVisibilityProvider visible={false}> (SectionShell / GeographShell,
  //      the same signal the data-integrity fold uses). This is the ROOT fix for
  //      the redraw RACE: on HIDE, `nodeVisible` flips false in the SAME commit that
  //      sets display:none, so ReactApexChart unmounts SYNCHRONOUSLY — ApexCharts'
  //      destroy() tears down its resize observers BEFORE the browser lays out the
  //      hidden box, so its `redrawOnParentResize` never fires against a 0-size
  //      parent. No `if/switch` on a dimension name — a generic visibility boolean
  //      threaded declaratively from the shell (Laws 1-2).
  //  (2) DOM-BOX GUARD — `useContainerVisible` flips true only once the host is
  //      actually laid out (non-zero box + rendered ancestor chain, ResizeObserver-
  //      driven). Covers any OTHER display:none source that carries no visibility
  //      provider (responsive CSS, a future container), so nothing ever measures a
  //      0×0 box regardless of what hid it (Law 8 — open for extension).
  //
  //  Mount requires BOTH (`shown`): the declarative gate kills the race for the
  //  toggle case; the DOM-box gate is the general laid-out guarantee. The host div
  //  keeps its footprint whether or not the chart mounts, so the box measurement is
  //  never circular. On show, both flip true and the chart mounts fresh against a
  //  real box with the latest data (`key={chartKey}`).
  const { ref: hostRef, visible: boxVisible } = useContainerVisible<HTMLDivElement>()
  const nodeVisible = useNodeVisible()
  const shown = nodeVisible && boxVisible
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
      {shown && (
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