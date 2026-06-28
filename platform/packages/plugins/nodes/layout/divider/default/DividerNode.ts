import type { NodeBase, PropertyGroup, PropSchema } from '@statdash/react/engine'

export interface DividerNode extends NodeBase {
  type:     'divider'
  variant?: 'solid' | 'dashed' | 'invisible'
}

export const DividerSchema: PropSchema = [
  {
    field:   'variant',
    type:    'string',
    label:   { ka: 'სტილი', en: 'Style' },
    default: 'solid',
    options: [
      { value: 'solid',     label: { ka: 'მთლიანი',     en: 'Solid' } },
      { value: 'dashed',    label: { ka: 'წყვეტილი',    en: 'Dashed' } },
      { value: 'invisible', label: { ka: 'უხილავი',     en: 'Invisible' } },
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