import type { NodeSliceMeta } from '@geostat/react/engine'
import { SectionSchema, SectionDefaults, SectionSlots, SectionGroups } from './SectionNode'

export const META: NodeSliceMeta = {
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
}
