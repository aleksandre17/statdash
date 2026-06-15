import type { PageSliceMeta } from '@geostat/react/engine'
import { ContainerPageSlots } from './ContainerPageNode'

export const META: PageSliceMeta = {
  sliceType:       'page',
  type:            'container-page',
  variant:         'default',
  label:           { ka: 'კონტეინერ გვერდი', en: 'Container Page' },
  icon:            'grid',
  category:        'page',
  slots:           ContainerPageSlots,
  canHaveChildren: true,
  rootOnly:        true,
  version:         1,
}
