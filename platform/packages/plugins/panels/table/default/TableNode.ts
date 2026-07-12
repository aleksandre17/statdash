import type { NodeBase, ViewParams, PropertyGroup } from '@statdash/react/engine'
import type { DataSpec, TableConfig, ColumnDef }     from '@statdash/engine'
import { DATA_INTEGRITY_SCHEMA, DATA_INTEGRITY_FIELDS } from '../../dataIntegritySchema'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface TableNode extends TableConfig, NodeBase {
  type:  'table'
  data?: DataSpec
  view?: ViewParams
  /** Explicit "preliminary data" override (Law 9) — signal #1 of resolvePreliminary. */
  preliminary?: boolean
}

// ── ColumnItemSchema — the per-COLUMN nested schema (ADR-041 DoD · ADR-022) ───────
//  STRANGLER: declares the EXISTING `TableConfig.columns` (ColumnDef[]) model as a
//  VALUE PartField itemSchema — the SAME shape the table already renders from
//  (DataTable reads a column's key/label/format/width/align). NO parallel column
//  model is forked. By this declaration ALONE — zero new adapter, zero engine/app
//  change — each column becomes an enumerable, selectable Part (residence 'value'):
//  `partFieldsOf(tableMeta)` now surfaces `columns`, and `bandItemsOf` enumerates a
//  table's columns exactly like a KPI card's items. This is the ADR-041 closed-circle
//  proof: the next selectable/authorable KIND is a DECLARATION, never a new bridge.
//
//  The advanced presentation facets — `bar` (bool|{min,max} union) and `valueMappings`
//  (ValueMapping[]) — stay a documented compile-Todo, not surfaced as opaque runtime
//  fields: the per-item editor stays scalar-only (no OPAQUE_BY_DESIGN debt incurred).
export const ColumnItemSchema = defineSchema([
  { field: 'label',  type: 'LocaleString', label: { ka: 'სათაური', en: 'Header' }, coverage: 'localized', required: true },
  { field: 'key',    type: 'string',       label: { ka: 'ველის გასაღები', en: 'Source field' }, required: true },
  { field: 'format', type: 'string',       label: { ka: 'ფორმატი', en: 'Format' } },
  { field: 'width',  type: 'string',       label: { ka: 'სიგანე', en: 'Width' } },
  {
    field: 'align', type: 'string', label: { ka: 'სწორება', en: 'Align' },
    options: [
      { value: 'l', label: { ka: 'მარცხნივ', en: 'Left'  } },
      { value: 'r', label: { ka: 'მარჯვნივ', en: 'Right' } },
    ],
  },
])

// FF-SCHEMA-COMPLETE depth (tier c): 1:1 with ColumnDef's editable keys. `bar` +
// `valueMappings` are the documented advanced-presentation deferral (raw-authored).
export type _ColumnCovers = Expect<AssertSchemaCovers<ColumnDef, typeof ColumnItemSchema, 'bar' | 'valueMappings'>>

export const TableSchema = defineSchema([
  { field: 'colLabel', type: 'string', label: { ka: 'სვეტის სათაური', en: 'Column header' } },
  {
    field: 'columns', type: 'array', label: { ka: 'სვეტები', en: 'Columns' },
    itemSchema: ColumnItemSchema, itemLabel: 'label',
  },
  ...DATA_INTEGRITY_SCHEMA,
])

// FF-SCHEMA-COMPLETE (tier b): TableNode INTERSECTS the engine render-spec
// `TableConfig`, so its editable surface carries TableConfig's presentation fields.
// Covered top-level today: `colLabel`, `columns` (now a structured VALUE band —
// ADR-041 DoD), `preliminary`. The remaining TableConfig keys are the DOCUMENTED
// authoring backlog (SCHEMA_TODO) — they render today (hand-authored config) but are
// not yet inspector props:
//   • nested object/array (need tier-c itemSchema seam): footer, seriesFormat, seriesOrder
//   • scalar presentation (a wave-7 dock/authoring-surface decision): valueLabel,
//     color, indent, statusFlags, caption, footerLabel
export type _TableCovers = Expect<AssertSchemaCovers<
  TableNode,
  typeof TableSchema,
  | 'footer' | 'seriesFormat' | 'seriesOrder'
  | 'valueLabel' | 'color' | 'indent' | 'statusFlags' | 'caption' | 'footerLabel'
>>

export const TableGroups: PropertyGroup[] = [
  { label: { ka: 'სვეტები', en: 'Columns' }, fields: ['colLabel', 'columns'] },
  { label: { ka: 'ქვედა სტრიქონი', en: 'Footer' }, fields: ['footer'] },
  { label: { ka: 'მონაცემთა მთლიანობა', en: 'Data integrity' }, fields: [...DATA_INTEGRITY_FIELDS] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'table': TableNode }
}