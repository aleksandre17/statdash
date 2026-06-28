import type { NodeBase, ViewParams, PropertyGroup, PropSchema } from '@statdash/react/engine'
import type { DataSpec, TableConfig }               from '@statdash/engine'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'

export interface TableNode extends TableConfig, NodeBase {
  type:  'table'
  data?: DataSpec
  view?: ViewParams
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  preliminary?: boolean
}

export const TableSchema: PropSchema = [
  { field: 'colLabel', type: 'string', label: { ka: 'სვეტის სათაური', en: 'Column header' } },
  ...DATA_INTEGRITY_SCHEMA,
]

export const TableGroups: PropertyGroup[] = [
  { label: { ka: 'სვეტები', en: 'Columns' }, fields: ['colLabel', 'cols'] },
  { label: { ka: 'ქვედა სტრიქონი', en: 'Footer' }, fields: ['footer'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'table': TableNode }
}