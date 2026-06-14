export { StatsCarouselShell as Shell } from './StatsCarouselShell'
export { Skeleton }                    from './StatsCarouselSkeleton'
export type { StatsCarouselNode, StatItem, StatSlide } from './StatsCarouselNode'

import {
  StatsCarouselSchema,
  StatsCarouselDefaults,
  StatsCarouselSlots,
  StatsCarouselGroups,
} from './StatsCarouselNode'

export const META = {
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
  version:         1,
  i18n: {
    ka: { prev: 'წინა',  next: 'შემდეგი' },
    en: { prev: 'Prev',  next: 'Next'    },
  },
} as const