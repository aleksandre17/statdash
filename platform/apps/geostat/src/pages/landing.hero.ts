import type { HeroNode } from '@plugins/nodes/hero'

export const LANDING_HERO: HeroNode = {
  id:   'landing-hero',
  type: 'hero',

  title:    { ka: 'ეროვნული ანგარიშების პორტალი', en: 'National Accounts Portal' },
  subtitle: { ka: '',                               en: ''                         },

  cards: [
    {
      id:     'gdp',
      title:  { ka: 'მთლიანი შიდა პროდუქტი',  en: 'Gross Domestic Product'   },
      sub:    { ka: '',                          en: ''                         },
      color:  '#0080BE',
      img:    'https://sna.geostat.ge/img/home/mtliani.png',
      pageBg: 'linear-gradient(160deg, #faf0e8 0%, #e4f0e8 40%, #d8ece8 70%, #d0e8ec 100%)',
    },
    {
      id:     'accounts',
      title:  { ka: 'ეროვნული ანგარიშები',     en: 'National Accounts'         },
      sub:    { ka: '',                          en: ''                          },
      color:  '#0080BE',
      img:    'https://sna.geostat.ge/img/home/erovnuli.png',
      pageBg: 'linear-gradient(160deg, #eef4e8 0%, #e0ece8 40%, #d4ecec 70%, #c8e8f0 100%)',
    },
    {
      id:     'regional',
      title:  { ka: 'რეგიონული ანალიზი',       en: 'Regional Analysis'         },
      sub:    { ka: '',                          en: ''                          },
      color:  '#0080BE',
      img:    'https://sna.geostat.ge/img/home/regionul.png',
      pageBg: 'linear-gradient(160deg, #e8f4f0 0%, #dcf0ec 40%, #d0ece8 70%, #c4e8f0 100%)',
    },
  ],
}