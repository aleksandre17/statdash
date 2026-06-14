export { FilterBarShell as Shell } from './FilterBarShell'
export type { FilterBarNode }      from './FilterBarNode'

export const META = {
  sliceType: 'node',
  type:      'filter-bar',
  variant:   'default',
  label:     { ka: 'ფილტრების პანელი', en: 'Filter Bar' },
  icon:      'sliders',
  category:  'layout',
  version:   1,
} as const