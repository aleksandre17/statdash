export { CardShell as Shell } from './CardShell'
export type { CardNode }      from './CardNode'

import { CardSlots } from './CardNode'

export const META = {
  sliceType:       'node',
  type:            'card',
  variant:         'default',
  label:           { ka: 'კარტა', en: 'Card' },
  icon:            'layout-card',
  category:        'layout',
  schema:          { type: 'object', properties: {} } as const,
  slots:           CardSlots,
  canHaveChildren: true,
  version:         1,
} as const