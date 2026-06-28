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
    label:    { ka: 'დიაგრამის ტიპი', en: 'Chart type' },
    required: true,
    options:  [
      { value: 'bar',     label: { ka: 'სვეტოვანი', en: 'Bar' } },
      { value: 'line',    label: { ka: 'წრფივი',    en: 'Line' } },
      { value: 'area',    label: { ka: 'ფართობი',   en: 'Area' } },
      { value: 'donut',   label: { ka: 'რგოლი',     en: 'Donut' } },
      { value: 'pie',     label: { ka: 'წრიული',    en: 'Pie' } },
      { value: 'scatter', label: { ka: 'წერტილოვანი', en: 'Scatter' } },
      { value: 'heatmap', label: { ka: 'სითბური რუკა', en: 'Heatmap' } },
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