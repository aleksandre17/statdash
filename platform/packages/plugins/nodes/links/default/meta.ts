import type { NodeSliceMeta } from '@statdash/react/engine'
import { LinksSchema } from './LinksNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'links',
  variant:         'default',
  label:           { ka: 'ბმულები', en: 'Links' },
  category:        'content',
  schema:          LinksSchema,
  canHaveChildren: false,
  // `flow` — placement capability: links is flow content (admissible in a section).
  caps:            ['flow'],
  version:         1,
}
