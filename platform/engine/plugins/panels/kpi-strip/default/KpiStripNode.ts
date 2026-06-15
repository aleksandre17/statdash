import type { NodeBase, PropertyGroup, PropSchema } from '@geostat/react/engine'
import type { KpiSpec }                 from '@geostat/engine'

export interface KpiStripNode extends NodeBase {
  type:  'kpi-strip'
  items: KpiSpec[]
}

export const KpiStripSchema: PropSchema = [
  { field: 'items', type: 'array', label: 'KPI მეტრიკები', required: true },
]

export const KpiStripGroups: PropertyGroup[] = [
  { label: { ka: 'მეტრიკები', en: 'Metrics' }, fields: ['items'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'kpi-strip': KpiStripNode }
}