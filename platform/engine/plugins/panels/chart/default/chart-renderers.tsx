import { chartRendererRegistry } from '@geostat/react/engine'
import { ApexRenderer }          from './components/ApexRenderer'
import HBarDivergingChart        from './components/HBarDivergingChart'
import DonutChart                from './components/DonutChart'
import TreemapChart              from './components/TreemapChart'
import ChartPlaceholder          from './components/ChartPlaceholder'

chartRendererRegistry
  .register(['bar', 'hbar', 'line', 'area', 'waterfall', 'combo', 'contribution', 'pie'], ApexRenderer)
  .register('hbar-diverging', HBarDivergingChart)
  .register('donut',          DonutChart)
  .register('treemap',        TreemapChart)
  .register('map',            () => <ChartPlaceholder type="map" />)
  .register('sankey',         () => <ChartPlaceholder type="sankey" />)