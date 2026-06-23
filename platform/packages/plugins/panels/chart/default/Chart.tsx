import './chart.css'

import { createElement }          from 'react'
import { chartRendererRegistry }  from '@statdash/react/engine'
import type { BodyStyleAttrs }    from '@statdash/react/engine'
import { ChartDataTable }         from '@statdash/react'
import ChartPlaceholder           from './components/ChartPlaceholder'
import type { ChartType }         from './components/ChartPlaceholder'
import type { ChartOutput }       from '@statdash/charts'

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

  // A11y contract [N15]: visual chart is aria-hidden (SVG is not AT-navigable);
  // ChartDataTable is the screen-reader and keyboard-accessible representation.
  // PanelLayout view toggle provides sighted keyboard access to the table view.
  return (
    <div {...bodyAttrs} className="chart-wrap">
      <div aria-hidden="true">
        {createElement(Renderer, { output, onDataHover, onDataLeave, onDataClick })}
      </div>
      <ChartDataTable output={output} label={ariaLabel} />
    </div>
  )
}