import type { NodeBase } from '@statdash/react/engine'
import type { LinkDef }  from '@statdash/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../schema-contract'

export interface LinksNode extends NodeBase {
  type:  'links'
  items: LinkDef[]
}

export const LinksSchema = defineSchema([
  { field: 'items', type: 'array', label: { ka: 'ბმულები', en: 'Links' }, required: true },
])

// FF-SCHEMA-COMPLETE (tier b): `items` (LinkDef[]) covered top-level; per-item
// authoring is the tier-c backlog.
export type _LinksCovers = Expect<AssertSchemaCovers<LinksNode, typeof LinksSchema>>

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'links': LinksNode }
}