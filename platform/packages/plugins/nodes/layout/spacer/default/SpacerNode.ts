import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'

export interface SpacerNode extends NodeBase {
  type:  'spacer'
  size?: string
}

export const SpacerSchema: PropSchema = [
  { field: 'size', type: 'string', label: { ka: 'ზომა', en: 'Size' }, default: 'var(--spacing-xl)' },
]

export const SpacerDefaults: Partial<SpacerNode> = { size: 'var(--spacing-xl)' }

export const SpacerGroups: PropertyGroup[] = [
  { label: { ka: 'ზომა', en: 'Size' }, fields: ['size'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'spacer': SpacerNode }
}