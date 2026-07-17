import { useId, useLayoutEffect, useState } from 'react'
import ReactApexChart              from 'react-apexcharts'
import { useContainerVisible, useNodeVisible } from '@statdash/react/engine'
import type { ChartRendererProps } from '@statdash/react/engine'
import { useLocale }               from '@statdash/react'
import { toApexOptions }           from '../utils/toApexOptions'
import { categoricalChartHeight }  from '../utils/apex/base'
import { shouldRenderSlider, buildBrushOptions, navSeriesData, sliderChartId, SLIDER_HEIGHT } from '../utils/apex/cartesian/brush'

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
  // Stable per-instance id → the sanitized main/brush chart ids a range-slider
  // brush companion links by (hooks run unconditionally, before any early return).
  const uid = useId()
  const shown = nodeVisible && boxVisible
  // Sub-row scroll-sliver fit (definition + rationale at the bottom of this
  // file). Called BEFORE the empty-series early return — hooks order law.
  const fitDelta = useScrollSliverFit(
    hostRef,
    shown && !shouldRenderSlider(output) && typeof categoricalChartHeight(output) === 'number',
    output.series.map(sr => sr.data.map(d => d.value).join(',')).join(';'),
  )
  if (output.series.length === 0) return null
  const fontFamily = typeof window !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--font-family-base').trim() || 'system-ui, sans-serif')
    : 'system-ui, sans-serif'
  // Range-slider brush: a long vertical time-dynamics chart declares `rangeSlider`
  // (ChartOutput). When it qualifies (shouldRenderSlider), the main chart takes a
  // stable id and a slim brush companion renders beneath it, linked by that id.
  const sliderOn = shouldRenderSlider(output)
  const mainId   = sliderChartId(uid, 'main')
  const brushId  = sliderChartId(uid, 'brush')
  const base     = toApexOptions(output, fontFamily, locale, sliderOn ? mainId : undefined)
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

  // The host div (with the box-measuring ref) is ALWAYS rendered so `shown` can
  // flip once it is laid out — the footprint must exist before the chart mounts
  // (measurement is never circular). Slider path stacks the main plot + a
  // fixed-height brush rail (flex column); non-slider path is the single
  // container-filling chart, unchanged (flag-absent render stays byte-identical).
  const sliderLayout = sliderOn
    ? { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' as const }
    : { width: '100%', height: '100%' }

  return (
    <div ref={hostRef} style={sliderLayout}>
      {shown && sliderOn && (
        <>
          {/* Main plot renders FIRST so ApexCharts registers it before the brush's
              `brush.target` lookup runs. */}
          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            <ReactApexChart
              key={chartKey}
              options={options}
              series={options.series as ApexAxisChartSeries | number[]}
              type={apexChartType(output.type)}
              height="100%"
            />
          </div>
          <div className="chart-brush-rail" style={{ flex: '0 0 auto', height: SLIDER_HEIGHT }}>
            <ReactApexChart
              key={`${chartKey}-brush`}
              options={buildBrushOptions(output, { mainId, brushId, fontFamily })}
              series={[{ name: '__nav__', data: navSeriesData(output) }] as ApexAxisChartSeries}
              type="area"
              height={SLIDER_HEIGHT}
            />
          </div>
        </>
      )}
      {shown && !sliderOn && (
        <ReactApexChart
          key={chartKey}
          options={options}
          series={options.series as ApexAxisChartSeries | number[]}
          type={apexChartType(output.type)}
          // Horizontal categorical charts size to their category count so rows never
          // cram; all other types fill the container ('100%') as before. `fitDelta`
          // shaves a sub-row scrollbar sliver (see useLayoutEffect below).
          height={fitHeight(categoricalChartHeight(output), fitDelta)}
        />
      )}
    </div>
  )
}

// ── Sub-row scroll-sliver fit ────────────────────────────────────────────────
//
//  A definite-px categorical chart (hbar floor/row-count) lives inside a
//  vw-scaled section band — two independent axes that can cross by a few px at
//  any viewport, raising a scrollbar over NOTHING (owner, round 10: a 6px
//  y-scroll on the regional comparison). After paint, measure the nearest
//  scrolling ancestor: an overshoot UNDER one row (34px) is chrome noise → the
//  chart re-renders shaved by exactly that delta; a genuine many-row overflow
//  (> one row) keeps its designed scroll. Shrink-only + capped + reset per
//  chart identity — the loop is structurally bounded to ONE correction.

const FIT_TOLERANCE_PX = 34 // = one hbar row (HBAR_PX_PER_CATEGORY)

function fitHeight(desired: number | '100%', delta: number): number | '100%' {
  return typeof desired === 'number' ? Math.max(1, desired - delta) : desired
}

function useScrollSliverFit(
  hostRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  resetKey: string,
): number {
  // Reset-on-key via render-time derived state (the React-sanctioned pattern) —
  // never a synchronous setState inside an effect.
  const [fit, setFit] = useState({ key: resetKey, delta: 0 })
  if (fit.key !== resetKey) setFit({ key: resetKey, delta: 0 })
  const delta = fit.key === resetKey ? fit.delta : 0
  useLayoutEffect(() => {
    if (!active || delta !== 0) return
    const id = requestAnimationFrame(() => {
      let el: HTMLElement | null = hostRef.current
      while (el && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement
      if (!el) return
      const over = el.scrollHeight - el.clientHeight
      if (over > 0 && over <= FIT_TOLERANCE_PX) setFit({ key: resetKey, delta: over })
    })
    return () => cancelAnimationFrame(id)
  }, [hostRef, active, delta, resetKey])
  return delta
}