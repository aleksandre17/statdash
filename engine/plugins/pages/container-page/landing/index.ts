export { LandingContainerShell as Shell } from './LandingContainerShell'

export const META = {
  sliceType: 'page',
  type:      'container-page',
  variant:   'landing',
  label:     { ka: 'Landing გვერდი', en: 'Landing Page' },
  category:  'landing',
  rootOnly:  true,
  version:   1,
  defaults:  { frame: 'landing', chrome: { AppHeader: 'transparent', InnerSidebar: 'hidden' } },
} as const