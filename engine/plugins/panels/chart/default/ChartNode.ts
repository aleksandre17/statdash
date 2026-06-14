import type { PropertyGroup, DataLinkDef } from '@geostat/react/engine'
import type { ChartDef, ChartType }        from '@geostat/engine'
import type { NodeBase }                   from '@geostat/react/engine'

export type ChartNode =
  Omit<NodeBase, 'type'>
  & { type: 'chart'; chartType: ChartType }
  & Omit<ChartDef, 'type'>
  & { dataLinks?: DataLinkDef[] }

export const ChartSchema = {
  type: 'object',
  required: ['chartType'],
  properties: {
    chartType: {
      type: 'string',
      enum: ['bar', 'line', 'area', 'donut', 'pie', 'scatter', 'heatmap'],
      title: 'Chart Type',
    },
  },
} as const

export const ChartGroups: PropertyGroup[] = [
  { label: { ka: 'ვიზუალიზაცია', en: 'Visualisation' }, fields: ['chartType'] },
  { label: { ka: 'ლეგენდა',      en: 'Legend'          }, fields: ['view.legend', 'view.tooltip'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'chart': ChartNode }
}