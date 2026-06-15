import type { NodeSliceMeta } from '@geostat/react/engine'
import { HeroSchema, HeroDefaults, HeroSlots, HeroGroups } from './HeroNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'hero',
  variant:         'default',
  label:           { ka: 'გმირი სექცია', en: 'Hero Section' },
  icon:            'layout-hero',
  category:        'content',
  schema:          HeroSchema,
  defaults:        HeroDefaults,
  slots:           HeroSlots,
  groups:          HeroGroups,
  canHaveChildren: false,
  version:         1,
  i18n: {
    ka: { view: 'ნახვა', prev: 'წინა',  next: 'შემდეგი' },
    en: { view: 'View',  prev: 'Prev',  next: 'Next'    },
  },
}
