import type { NodeSliceMeta } from '@statdash/react/engine'
import {
  FeaturedSliderSchema,
  FeaturedSliderDefaults,
  FeaturedSliderSlots,
  FeaturedSliderGroups,
} from './FeaturedSliderNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'featured-slider',
  variant:         'default',
  label:           { ka: 'ფიჩერ-სლაიდერი', en: 'Featured Slider' },
  icon:            'trending-up',
  category:        'content',
  schema:          FeaturedSliderSchema,
  defaults:        FeaturedSliderDefaults,
  slots:           FeaturedSliderSlots,
  groups:          FeaturedSliderGroups,
  canHaveChildren: false,
  // Reads the store through the KPI seam (NOT a DataSpec) — mirrors kpi-strip's
  // caps, so the engine's DataSpec routing/warm is never engaged (the AR-40
  // sequencing invariant: stay on the KpiSpec path, avoid dataSource-routing
  // asymmetry). 'drill' + 'methodology' declare the card affordances for the
  // Constructor taxonomy; 'filterable' = it may follow cross-filter selection.
  caps:            ['filterable', 'drill', 'methodology'],
  version:         1,
  i18n: {
    ka: {
      prev: 'წინა', next: 'შემდეგი', region: 'ფიჩერ-სტატისტიკა', slide: 'სლაიდი',
      'trend-up': 'მზარდი:', 'trend-down': 'კლებადი:', 'trend-flat': 'სტაბილური:',
      methodology: 'მეთოდოლოგია', preliminary: 'წინასწარი მონაცემი', drill: 'დეტალურად',
    },
    en: {
      prev: 'Prev', next: 'Next', region: 'Featured statistics', slide: 'Slide',
      'trend-up': 'Up:', 'trend-down': 'Down:', 'trend-flat': 'Flat:',
      methodology: 'Methodology', preliminary: 'Preliminary data', drill: 'View details',
    },
  },
}
