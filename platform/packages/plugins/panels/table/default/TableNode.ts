import type { NodeBase, ViewParams, PropertyGroup } from '@statdash/react/engine'
import type { DataSpec, TableConfig }               from '@statdash/engine'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface TableNode extends TableConfig, NodeBase {
  type:  'table'
  data?: DataSpec
  view?: ViewParams
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  preliminary?: boolean
}

export const TableSchema = defineSchema([
  { field: 'colLabel', type: 'string', label: { ka: 'სვეტის სათაური', en: 'Column header' } },
  ...DATA_INTEGRITY_SCHEMA,
])

// FF-SCHEMA-COMPLETE (tier b): TableNode INTERSECTS the engine render-spec
// `TableConfig`, so its editable surface carries TableConfig's presentation fields.
// Covered top-level today: `colLabel`, `preliminary`. The remaining TableConfig
// keys are the DOCUMENTED authoring backlog (SCHEMA_TODO) — they render today
// (hand-authored config) but are not yet inspector props:
//   • nested object/array (need tier-c itemSchema seam): columns, footer, seriesFormat, seriesOrder
//   • scalar presentation (a wave-7 dock/authoring-surface decision): valueLabel,
//     color, indent, statusFlags, caption, footerLabel
export type _TableCovers = Expect<AssertSchemaCovers<
  TableNode,
  typeof TableSchema,
  | 'columns' | 'footer' | 'seriesFormat' | 'seriesOrder'
  | 'valueLabel' | 'color' | 'indent' | 'statusFlags' | 'caption' | 'footerLabel'
>>

export const TableGroups: PropertyGroup[] = [
  { label: { ka: 'სვეტები', en: 'Columns' }, fields: ['colLabel', 'cols'] },
  { label: { ka: 'ქვედა სტრიქონი', en: 'Footer' }, fields: ['footer'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'table': TableNode }
}