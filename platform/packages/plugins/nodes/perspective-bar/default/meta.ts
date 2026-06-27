import type { NodeSliceMeta } from '@statdash/react/engine'
import { PerspectiveBarSchema } from './PerspectiveBarNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'perspective-bar',
  variant:         'default',
  label:           { ka: 'პერსპექტივის ტაბ-ბარი', en: 'Perspective Tab Bar' },
  icon:            'tabs',
  category:        'layout',
  schema:          PerspectiveBarSchema,
  canHaveChildren: false,
  singleton:       true,
  caps:            [],
  version:         1,
  i18n: {
    ka: { 'aria-label': 'ნახვის რეჟიმი' },
    en: { 'aria-label': 'View mode' },
  },
}
