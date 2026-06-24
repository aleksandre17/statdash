import './gauge.css'

import { Fragment }                from 'react'
import ReactApexChart              from 'react-apexcharts'
import { defineShell, resolvePreliminary } from '@statdash/react/engine'
import { resolveThresholdColor }   from '@statdash/engine'
import type { RenderContext }      from '@statdash/react/engine'
import { useInject, EMPTY_STATE, EXPORT_BAR, useExtensions, PANEL_TITLE_BADGE } from '@statdash/react'
import type { ExportMeta }         from '@statdash/engine'
import type { GaugeNode }          from './GaugeNode'
import { toGaugePct }              from './gaugeUtils'

export const GaugeShell = defineShell<GaugeNode>({
  render({ def, ctx }) {
    return <GaugeControl def={def} ctx={ctx} />
  },
})

function GaugeControl({ def, ctx }: { def: GaugeNode; ctx: RenderContext }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const ExportBar  = useInject(ctx.ui, EXPORT_BAR)
  const rows       = ctx.rows ?? []
  const valueField = def.valueField ?? 'value'

  const titleBadges = useExtensions(ctx.extensions, PANEL_TITLE_BADGE, {
    nodeType:    'gauge',
    nodeId:      def.id,
    preliminary: resolvePreliminary(def, ctx),
  })
  const titleBadge = titleBadges.length > 0
    ? <>{titleBadges.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>
    : undefined
  // valueField is a dynamic field name (Law 1) — read via the generic record form.
  const raw        = ((rows[0] as unknown as Record<string, unknown> | undefined)?.[valueField] as number | undefined) ?? 0
  const min        = def.min ?? 0
  const max        = def.max ?? 100

  const pct = toGaugePct(raw, min, max)

  const thresholds = def.thresholds ?? []
  const color      = resolveThresholdColor(raw, thresholds)

  const options: ApexCharts.ApexOptions = {
    chart: {
      type:      'radialBar',
      sparkline: { enabled: true },
      animations: { enabled: false },
    },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle:    135,
        hollow:     { size: '65%' },
        track:      { background: 'var(--color-border)' },
        dataLabels: {
          name:  { show: false },
          value: {
            show:       def.showValue !== false,
            fontSize:   '28px',
            fontWeight: 700,
            formatter:  () => String(raw),
          },
        },
      },
    },
    fill:   { colors: [color ?? 'var(--color-accent)'] },
    stroke: { lineCap: 'round' },
  }

  if (rows.length === 0) return <EmptyState />

  const title = def.view?.label
  const exportMeta: ExportMeta = {
    title,
    filename: def.id ?? title,
  }

  return (
    <>
      {titleBadge && (
        <div className="gauge__title-badges" aria-live="polite">
          {titleBadge}
        </div>
      )}
      <div className="gauge-panel">
        <ReactApexChart
          type="radialBar"
          series={[pct]}
          options={options}
          height={220}
        />
      </div>
      <ExportBar
        rows={rows}
        meta={exportMeta}
        onExport={fmt => ctx.bus.dispatch({ type: 'data:export', format: fmt, rows, meta: exportMeta })}
      />
    </>
  )
}
