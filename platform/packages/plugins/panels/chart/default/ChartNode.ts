import type { PropertyGroup, DataLinkDef, PropSchema } from '@statdash/react/engine'
import type { ChartType }        from '@statdash/engine'
import type { ChartDef }         from '@statdash/charts'
import type { NodeBase }                   from '@statdash/react/engine'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'

export type ChartNode =
  Omit<NodeBase, 'type'>
  & { type: 'chart'; chartType: ChartType }
  & Omit<ChartDef, 'type'>
  & { dataLinks?: DataLinkDef[] }
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  & { preliminary?: boolean }

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
  ...DATA_INTEGRITY_SCHEMA,
]

export const ChartGroups: PropertyGroup[] = [
  { label: { ka: 'ვიზუალიზაცია', en: 'Visualisation' }, fields: ['chartType'] },
  { label: { ka: 'ლეგენდა',      en: 'Legend'          }, fields: ['view.legend', 'view.tooltip'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'chart': ChartNode }
}