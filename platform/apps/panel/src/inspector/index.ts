// ── inspector — public surface (C1) ─────────────────────────────────────────
//
//  The schema-driven property panel: given a selected node's type, reads
//  nodeRegistry.getSchema(type) and renders a property form generically. A new
//  node type = a new schema (no panel change); a new field type = a new control
//  registration (no Inspector change).
//
export { Inspector } from './Inspector'
export type { InspectorProps } from './Inspector'
export { nodeSchemaSource } from './schemaSource'
export type { SchemaSource } from './schemaSource'
export { fieldControlRegistry } from './FieldControlRegistry'
export type { FieldControlRegistry } from './FieldControlRegistry'
export type { FieldControl, FieldControlProps, FieldControlKey } from './fieldControl.types'
export { useActiveLocales, orderLocales, PLATFORM_LOCALES } from './useActiveLocales'
export { LocaleField }  from './controls/LocaleField'
export { EnumRefField } from './controls/EnumRefField'
export { ArrayOfControl, ObjectControl } from './controls/NestedItemControl'
