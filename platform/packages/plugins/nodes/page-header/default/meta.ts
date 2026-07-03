import type { NodeSliceMeta } from '@statdash/react/engine'
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
  caps:            [],
  version:         1,
  i18n: {
    ka: { home: 'მთავარი', export: 'ექსპორტი', breadcrumb: 'ნავიგაციის ბილიკი' },
    en: { home: 'Home',    export: 'Export',   breadcrumb: 'Breadcrumb' },
  },
}
