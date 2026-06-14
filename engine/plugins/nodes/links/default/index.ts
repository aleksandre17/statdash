export { LinksShell as Shell } from './LinksShell'
export type { LinksNode }      from './LinksNode'

import { LinksSchema } from './LinksNode'

export const META = {
  sliceType:       'node',
  type:            'links',
  variant:         'default',
  label:           { ka: 'ბმულები', en: 'Links' },
  category:        'content',
  schema:          LinksSchema,
  canHaveChildren: false,
  version:         1,
} as const