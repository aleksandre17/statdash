export { ContainerPageShell as Shell } from './ContainerPageShell'
export type { ContainerPageNode }      from './ContainerPageNode'

import { ContainerPageSlots } from './ContainerPageNode'
import type { NodeSliceMeta }  from '@geostat/react/engine'

export const META: NodeSliceMeta = {
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