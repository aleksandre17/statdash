import type { NodeBase, PropertyGroup } from '@geostat/react/engine'
import type { KpiSpec }                 from '@geostat/engine'

export interface KpiStripNode extends NodeBase {
  type:  'kpi-strip'
  items: KpiSpec[]
}

export const KpiStripSchema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: { type: 'array', title: 'KPI მეტრიკები' },
  },
} as const

export const KpiStripGroups: PropertyGroup[] = [
  { label: { ka: 'მეტრიკები', en: 'Metrics' }, fields: ['items'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'kpi-strip': KpiStripNode }
}