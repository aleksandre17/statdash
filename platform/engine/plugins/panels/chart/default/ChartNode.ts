import type { PropertyGroup, DataLinkDef, PropSchema } from '@geostat/react/engine'
import type { ChartType }        from '@geostat/engine'
import type { ChartDef }         from '@geostat/charts'
import type { NodeBase }                   from '@geostat/react/engine'

export type ChartNode =
  Omit<NodeBase, 'type'>
  & { type: 'chart'; chartType: ChartType }
  & Omit<ChartDef, 'type'>
  & { dataLinks?: DataLinkDef[] }

export const ChartSchema: PropSchema = [
  {
    field:    'chartType',
    type:     'string',
    label:    'Chart Type',
    required: true,
    options:  [
      { value: 'bar',     label: 'Bar' },
      { value: 'line',    label: 'Line' },
      { value: 'area',    label: 'Area' },
      { value: 'donut',   label: 'Donut' },
      { value: 'pie',     label: 'Pie' },
      { value: 'scatter', label: 'Scatter' },
      { value: 'heatmap', label: 'Heatmap' },
    ],
  },
]

export const ChartGroups: PropertyGroup[] = [
  { label: { ka: 'ვიზუალიზაცია', en: 'Visualisation' }, fields: ['chartType'] },
  { label: { ka: 'ლეგენდა',      en: 'Legend'          }, fields: ['view.legend', 'view.tooltip'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'chart': ChartNode }
}