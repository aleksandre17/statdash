import type { NodeSliceMeta } from '@statdash/react/engine'
import { RowSchema, RowDefaults, RowSlots } from './RowNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'row',
  variant:         'default',
  label:           { ka: 'მწკრივი', en: 'Row Layout' },
  category:        'layout',
  schema:          RowSchema,
  defaults:        RowDefaults,
  slots:           RowSlots,
  canHaveChildren: true,
  // `nav-transparent` (descend-for-nav) is DISTINCT from render `transparent`:
  // a row is a REAL DOM container, but the nav extractor traverses its children
  // so sections nested in a row still appear in the page nav.
  caps:            ['nav-transparent'],
  version:         1,
}
