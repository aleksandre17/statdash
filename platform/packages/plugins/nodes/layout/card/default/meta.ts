import type { NodeSliceMeta } from '@statdash/react/engine'
import { CardSlots, CardSchema, CardGroups } from './CardNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'card',
  variant:         'default',
  label:           { ka: 'კარტა', en: 'Card' },
  icon:            'layout-card',
  category:        'layout',
  schema:          CardSchema,
  groups:          CardGroups,
  slots:           CardSlots,
  canHaveChildren: true,
  // `flow` — placement capability: a card is flow content (admissible in a section) AND
  // an open container itself (its slot admits any child).
  caps:            ['flow'],
  version:         1,
}
