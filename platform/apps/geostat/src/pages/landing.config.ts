import type { NodePageConfig } from '@geostat/react/engine'
import { LANDING_HERO }  from './landing.hero'
import { LANDING_STATS } from './landing.stats'

export const LANDING_CONFIG: NodePageConfig = {
  type:    'container-page',
  variant: 'landing',
  id:      'landing',

  children: [
    LANDING_HERO,
    LANDING_STATS,
  ],
}