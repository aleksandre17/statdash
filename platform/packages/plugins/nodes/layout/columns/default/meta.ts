import type { NodeSliceMeta } from '@statdash/react/engine'
import { ColumnsSchema, ColumnsDefaults, ColumnsSlots, ColumnsGroups } from './ColumnsNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'columns',
  variant:         'default',
  label:           { ka: 'სვეტები', en: 'Columns' },
  icon:            'layout-columns',
  category:        'layout',
  schema:          ColumnsSchema,
  defaults:        ColumnsDefaults,
  slots:           ColumnsSlots,
  groups:          ColumnsGroups,
  canHaveChildren: true,
  // `nav-transparent` (descend-for-nav): columns is a REAL-DOM container, but the
  // nav extractor traverses its children so sections nested in a columns grid
  // still appear in the page nav. Absorbed from the retired `row` primitive when
  // the two grid families converged to one (DESIGN-responsive-composition §3.2).
  // `flow` (placement capability): columns is flow content, admissible in a section.
  caps:            ['nav-transparent', 'flow'],
  version:         1,
}
