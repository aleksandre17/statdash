import './chart.css'

import { createElement }          from 'react'
import type { CSSProperties }     from 'react'
import { chartRendererRegistry }  from '@statdash/react/engine'
import type { BodyStyleAttrs }    from '@statdash/react/engine'
import { ChartDataTable }         from '@statdash/react'
import ChartPlaceholder           from './components/ChartPlaceholder'
import type { ChartType }         from './components/ChartPlaceholder'
import type { ChartOutput }       from '@statdash/charts'
import { useThemeVersion }        from './utils/useThemeVersion'

interface ChartProps {
  output:        ChartOutput
  bodyAttrs:     BodyStyleAttrs
  onDataHover?:  (dataIndex: number) => void
  onDataLeave?:  () => void
  onDataClick?:  (dataIndex: number) => void
}

export default function Chart({ output, bodyAttrs, onDataHover, onDataLeave, onDataClick }: ChartProps) {
  // Bumps when the theme flips at runtime; folded into the render-wrapper key
  // below so every renderer (Apex builders + custom SVG donut/treemap/hbar) is
  // remounted and re-reads its token colours from the new cascade. Chart chrome
  // is baked to SVG in JS, so it cannot flip via CSS alone. See useThemeVersion.
  const themeVersion = useThemeVersion()
  const Renderer = chartRendererRegistry.get(output.type)
  if (!Renderer) return <ChartPlaceholder type={output.type as ChartType} />

  const ariaLabel = output.series.map(s => s.name).filter(Boolean).join(', ') || output.type

  // Low-cardinality fill (defect #2): a HORIZONTAL bar's honest height is its
  // category count (ApexRenderer → categoricalChartHeight, a definite px), NOT the
  // width-ratio aspect band. When a config authors `aspectRatio` on a chart, that
  // band lands on .chart-wrap ([data-aspect] → --size-panel-height) and a 2-row hbar
  // renders its ~240px plot inside a ~728px band → dead whitespace below the bars.
  // A horizontal chart therefore opts OUT of the band and sizes to content. Inline
  // style is deliberate: it must beat BOTH `[data-aspect]{height:band}` and the
  // equal-height-stretch rule `… > .chart-wrap[data-aspect]{flex:1 1 band}` without
  // a shared-stylesheet specificity fight (project panel-sizing model). Harmless in
  // a non-flex/no-band context (height:auto is the default; the flex shorthand is
  // ignored off a flex item). Vertical charts keep filling their band, unchanged.
  const { style: bodyStyle, ...bodyRest } = bodyAttrs
  const fillStyle: CSSProperties | undefined = output.horizontal
    ? { ...(bodyStyle as CSSProperties), height: 'auto', flex: '0 0 auto' }
    : (bodyStyle as CSSProperties | undefined)

  // A11y contract [N15]: visual chart is aria-hidden (SVG is not AT-navigable);
  // ChartDataTable is the screen-reader and keyboard-accessible representation.
  // PanelLayout view toggle provides sighted keyboard access to the table view.
  return (
    <div {...bodyRest} style={fillStyle} data-content="chart" className="chart-wrap">
      {/* height:100% so a renderer that fills its parent (the custom flexbox
          TreemapChart root is `height:100%`) resolves against .chart-wrap's
          resolved height — without it this wrapper shrinks to content and the
          treemap blocks collapse to 0 (blank panel). Apex renderers measure the
          box and are unaffected; donut/bar already fill. Same height-chain class
          as the regional GeoMap panel. */}
      <div aria-hidden="true" className="chart-wrap__render" key={themeVersion}>
        {createElement(Renderer, { output, onDataHover, onDataLeave, onDataClick })}
      </div>
      <ChartDataTable output={output} label={ariaLabel} />
    </div>
  )
}