import type { NodeBase, PropertyGroup } from '@geostat/react/engine'

export interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'
}

export const DividerSchema = {
  type: 'object',
  properties: {
    variant: { type: 'string', enum: ['solid', 'dashed', 'invisible'], title: 'სტილი', default: 'solid' },
  },
} as const

export const DividerDefaults: Partial<DividerNode> = { variant: 'solid' }

export const DividerGroups: PropertyGroup[] = [
  { label: { ka: 'სტილი', en: 'Style' }, fields: ['variant'] },
]

declare module '@geostat/react/engine' {
  interface NodeTypeMap { 'divider': DividerNode }
}