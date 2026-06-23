import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'

export interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'
}

export const DividerSchema: PropSchema = [
  {
    field:   'variant',
    type:    'string',
    label:   'სტილი',
    default: 'solid',
    options: [
      { value: 'solid',     label: 'Solid' },
      { value: 'dashed',    label: 'Dashed' },
      { value: 'invisible', label: 'Invisible' },
    ],
  },
]

export const DividerDefaults: Partial<DividerNode> = { variant: 'solid' }

export const DividerGroups: PropertyGroup[] = [
  { label: { ka: 'სტილი', en: 'Style' }, fields: ['variant'] },
]

declare module '@statdash/react/engine' {
  interface NodeTypeMap { 'divider': DividerNode }
}