import type { NodeSliceMeta } from '@geostat/react/engine'
import { LinksSchema } from './LinksNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'links',
  variant:         'default',
  label:           { ka: 'ბმულები', en: 'Links' },
  category:        'content',
  schema:          LinksSchema,
  canHaveChildren: false,
  version:         1,
}
