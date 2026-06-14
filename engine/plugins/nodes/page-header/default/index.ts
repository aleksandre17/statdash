export { PageHeaderShell as Shell } from './PageHeaderShell'
export type { PageHeaderNode }      from './PageHeaderNode'

import { PageHeaderSchema, PageHeaderGroups } from './PageHeaderNode'

export const META = {
  sliceType:       'node',
  type:            'page-header',
  variant:         'default',
  label:           { ka: 'გვერდის სათაური', en: 'Page Header' },
  category:        'chrome',
  schema:          PageHeaderSchema,
  groups:          PageHeaderGroups,
  canHaveChildren: false,
  singleton:       true,
  version:         1,
} as const