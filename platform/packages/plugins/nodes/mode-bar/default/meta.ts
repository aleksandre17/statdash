import type { NodeSliceMeta } from '@statdash/react/engine'
import { ModeBarSchema } from './ModeBarNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'mode-bar',
  variant:         'default',
  label:           { ka: 'Mode Tab Bar', en: 'Mode Tab Bar' },
  icon:            'tabs',
  category:        'layout',
  schema:          ModeBarSchema,
  canHaveChildren: false,
  singleton:       true,
  caps:            [],
  version:         1,
  i18n: {
    ka: { 'aria-label': 'ნახვის რეჟიმი' },
    en: { 'aria-label': 'View mode' },
  },
}
