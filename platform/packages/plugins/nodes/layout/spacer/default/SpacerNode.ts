import type { NodeBase, PropertyGroup } from '@statdash/react/engine'
import { defineSchema, type AssertSchemaCovers, type Expect } from '../../../../schema-contract'

export interface SpacerNode extends NodeBase {
  type:  'spacer'
  size?: string
}

export const SpacerSchema = defineSchema([
  { field: 'size', type: 'string', label: { ka: 'ზომა', en: 'Size' }, default: 'var(--spacing-xl)' },
])

// FF-SCHEMA-COMPLETE (tier b): 1:1 with editable keys.
export type _SpacerCovers = Expect<AssertSchemaCovers<SpacerNode, typeof SpacerSchema>>

export const SpacerDefaults: Partial<SpacerNode> = { size: 'var(--spacing-xl)' }

export const SpacerGroups: PropertyGroup[] = [
  { label: { ka: 'ზომა', en: 'Size' }, fields: ['size'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'spacer': SpacerNode }
}