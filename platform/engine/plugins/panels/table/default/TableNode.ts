import type { NodeBase, ViewParams, PropertyGroup } from '@geostat/react/engine'
import type { DataSpec, TableConfig }               from '@geostat/engine'

export interface TableNode extends TableConfig, NodeBase {
  type:  'table'
  data?: DataSpec
  view?: ViewParams
}

export const TableSchema = {
  type: 'object',
  properties: {
    colLabel: { type: 'string', title: 'სვეტის სათაური' },
  },
} as const

export const TableGroups: PropertyGroup[] = [
  { label: { ka: 'სვეტები', en: 'Columns' }, fields: ['colLabel', 'cols'] },
  { label: { ka: 'ქვედა სტრიქონი', en: 'Footer' }, fields: ['footer'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'table': TableNode }
}