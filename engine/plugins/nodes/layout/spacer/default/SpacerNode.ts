import type { NodeBase, PropertyGroup } from '@geostat/react/engine'

export interface SpacerNode extends NodeBase {
  type:  'spacer'
  size?: string
}

export const SpacerSchema = {
  type: 'object',
  properties: {
    size: { type: 'string', title: 'ზომა', default: 'var(--spacing-xl)' },
  },
} as const

export const SpacerDefaults: Partial<SpacerNode> = { size: 'var(--spacing-xl)' }

export const SpacerGroups: PropertyGroup[] = [
  { label: { ka: 'ზომა', en: 'Size' }, fields: ['size'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'spacer': SpacerNode }
}