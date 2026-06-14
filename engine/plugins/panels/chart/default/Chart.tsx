import './chart.css'

import { createElement }          from 'react'
import { chartRendererRegistry }  from '@geostat/react/engine'
import type { BodyStyleAttrs }    from '@geostat/react/engine'
import ChartPlaceholder           from './components/ChartPlaceholder'
import type { ChartType }         from './components/ChartPlaceholder'
import type { ChartOutput }       from '@geostat/engine'

interface ChartProps {
  output:        ChartOutput
  bodyAttrs:     BodyStyleAttrs
  onDataHover?:  (dataIndex: number) => void
  onDataLeave?:  () => void
  onDataClick?:  (dataIndex: number) => void
}

export default function Chart({ output, bodyAttrs, onDataHover, onDataLeave, onDataClick }: ChartProps) {
  const Renderer = chartRendererRegistry.get(output.type)
  if (!Renderer) return <ChartPlaceholder type={output.type as ChartType} />

  const ariaLabel = output.series.map(s => s.name).filter(Boolean).join(', ') || output.type

  return (
    <div {...bodyAttrs} className="chart-wrap" role="img" aria-label={ariaLabel}>
      {createElement(Renderer, { output, onDataHover, onDataLeave, onDataClick })}
    </div>
  )
}