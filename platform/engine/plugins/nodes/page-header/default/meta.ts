import type { NodeSliceMeta } from '@geostat/react/engine'
import { PageHeaderSchema, PageHeaderGroups } from './PageHeaderNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'page-header',
  variant:         'default',
  label:           { ka: 'გვერდის სათაური', en: 'Page Header' },
  category:        'content',
  schema:          PageHeaderSchema,
  groups:          PageHeaderGroups,
  canHaveChildren: false,
  singleton:       true,
  version:         1,
}
