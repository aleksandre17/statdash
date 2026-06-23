import type { NodeSliceMeta } from '@statdash/react/engine'
import {
  StatsCarouselSchema,
  StatsCarouselDefaults,
  StatsCarouselSlots,
  StatsCarouselGroups,
} from './StatsCarouselNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'stats-carousel',
  variant:         'default',
  label:           { ka: 'სტატისტიკის კარუსელი', en: 'Stats Carousel' },
  icon:            'bar-chart-2',
  category:        'content',
  schema:          StatsCarouselSchema,
  defaults:        StatsCarouselDefaults,
  slots:           StatsCarouselSlots,
  groups:          StatsCarouselGroups,
  canHaveChildren: false,
  caps:            [],
  version:         1,
  i18n: {
    ka: { prev: 'წინა',  next: 'შემდეგი' },
    en: { prev: 'Prev',  next: 'Next'    },
  },
}
