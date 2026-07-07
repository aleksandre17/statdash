import './gauge.css'

import ReactApexChart              from 'react-apexcharts'
import { defineShell, useNodeTemplate } from '@statdash/react/engine'
import { usePanelTitleBadge }      from '@statdash/react/engine'
import { resolveThresholdColor }   from '@statdash/engine'
import type { RenderContext, ViewParams } from '@statdash/react/engine'
import { useInject, EMPTY_STATE, PanelExport }    from '@statdash/react'
import type { ExportMeta }         from '@statdash/engine'
import type { GaugeNode }          from './GaugeNode'
import { toGaugePct, gaugeApexOptions, GAUGE_HEIGHT } from './gaugeUtils'

export const GaugeShell = defineShell<GaugeNode>({
  render({ def, ctx, merged }) {
    return <GaugeControl def={def} ctx={ctx} merged={merged} />
  },
})

function GaugeControl({ def, ctx, merged }: { def: GaugeNode; ctx: RenderContext; merged: ViewParams }) {
  const EmptyState = useInject(ctx.ui, EMPTY_STATE)
  const titleBadge = usePanelTitleBadge(ctx, def, 'gauge')
  const rows       = ctx.rows ?? []
  const resolve    = useNodeTemplate(ctx)

  // Empty-state first — no dial math on the empty path (matches Chart/Map).
  if (rows.length === 0) return <EmptyState />

  const valueField = def.valueField ?? 'value'
  // valueField is a dynamic field name (Law 1) — read via the generic record form.
  const raw        = ((rows[0] as unknown as Record<string, unknown> | undefined)?.[valueField] as number | undefined) ?? 0
  const min        = def.min ?? 0
  const max        = def.max ?? 100

  const pct        = toGaugePct(raw, min, max)
  const color      = resolveThresholdColor(raw, def.thresholds ?? [])
  const options    = gaugeApexOptions(raw, color, def.showValue !== false)

  // merged.label is an i18n carrier — resolve to the active locale for the export meta.
  const title = resolve(merged.label) ?? ''
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
          height={GAUGE_HEIGHT}
        />
      </div>
      <PanelExport ctx={ctx} rows={rows} meta={exportMeta} nodeId={def.id} />
    </>
  )
}
