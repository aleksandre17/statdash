import type { PanelSliceMeta } from '@statdash/react/engine'
import { TextSchema, TextDefaults, TextGroups } from './TextNode'

export const META: PanelSliceMeta = {
  sliceType:       'panel',
  type:            'text',
  variant:         'default',
  label:           { ka: 'ტექსტი', en: 'Text' },
  icon:            'text',
  category:        'content',
  schema:          TextSchema,
  defaults:        TextDefaults,
  groups:          TextGroups,
  canHaveChildren: false,
  caps:            [] as const,
  version:         1,
}
