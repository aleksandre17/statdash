export { SectionShell as Shell }    from './SectionShell'
export { Skeleton }                 from './SectionSkeleton'
export { default as SectionBlock }  from './components/SectionBlock'
export type { SectionNode }         from './SectionNode'

import {
  SectionSchema,
  SectionDefaults,
  SectionSlots,
  SectionGroups,
} from './SectionNode'

export const META = {
  sliceType:       'node',
  type:            'section',
  variant:         'default',
  label:           { ka: 'სექცია',  en: 'Section' },
  icon:            'layout-section',
  category:        'layout',
  schema:          SectionSchema,
  defaults:        SectionDefaults,
  slots:           SectionSlots,
  groups:          SectionGroups,
  canHaveChildren: true,
  version:         1,
} as const