import type { StatsCarouselNode } from '@plugins/nodes/stats-carousel/default/StatsCarouselNode'

export const LANDING_STATS: StatsCarouselNode = {
  id:         'landing-stats',
  type:       'stats-carousel',
  autoplayMs: 7000,

  slides: [
    {
      tab:   { ka: 'მშპ მაჩვენებლები',  en: 'GDP Indicators'      },
      title: { ka: 'მთლიანი შიდა პროდუქტი - 2025', en: 'Gross Domestic Product – 2025' },
      stats: [
        {
          icon: '📊', iconBg: '#E6F3FA',
          label: { ka: 'მშპ საბაზრო ფასებში',  en: 'GDP at market prices'      },
          value: '104 598', unit: 'მლნ ₾',
        },
        {
          icon: '💰', iconBg: '#E8F5F2',
          label:      { ka: 'ერთ სულ მოსახლეზე',          en: 'Per capita'                        },
          value:      '10 200', unit: '$',
          change:     9.7,
          changeText: { ka: 'წინა წელთან შედარებით', en: 'compared to previous year' },
        },
        {
          icon: '📈', iconBg: '#FEF0EC',
          label:      { ka: 'რეალური ზრდა',               en: 'Real growth'                       },
          value:      '7.5', unit: '%',
          change:     7.5,
          changeText: { ka: 'წინა წელთან შედარებით', en: 'compared to previous year' },
        },
        {
          icon: '📉', iconBg: '#FFF8EC',
          label: { ka: 'მშპ-ს დეფლატორი', en: 'GDP deflator' },
          value: '4.6', unit: '%',
        },
      ],
    },
    {
      tab:   { ka: 'ეროვნული ანგარიშები',  en: 'National Accounts'     },
      title: { ka: 'ეროვნული ანგარიშები - 2025', en: 'National Accounts – 2025' },
      stats: [
        {
          icon: '🏗️', iconBg: '#E6F3FA',
          label: { ka: 'გამოშვება საბაზრო ფასებში', en: 'Output at market prices'  },
          value: '204 000', unit: 'მლნ ₾',
        },
        {
          icon: '🛒', iconBg: '#E8F5F2',
          label: { ka: 'შუალედური მოხმარება',        en: 'Intermediate consumption' },
          value: '99 400', unit: 'მლნ ₾',
        },
        {
          icon: '💼', iconBg: '#FEF0EC',
          label: { ka: 'ეროვნული შემოსავალი',        en: 'National income'          },
          value: '108 200', unit: 'მლნ ₾',
        },
        {
          icon: '📋', iconBg: '#FFF8EC',
          label: { ka: 'წმინდა დაკრედიტება/სესხება', en: 'Net lending/borrowing'    },
          value: '6 400', unit: 'მლნ ₾',
        },
      ],
    },
    {
      tab:   { ka: 'რეგიონული სტატისტიკა', en: 'Regional Statistics'   },
      title: { ka: 'რეგიონული ანალიზი - 2024', en: 'Regional Analysis – 2024' },
      stats: [
        {
          icon: '🏛️', iconBg: '#E6F3FA',
          label: { ka: 'თბილისი — მშპ',       en: 'Tbilisi — GDP'      },
          value: '54 100', unit: 'მლნ ₾',
        },
        {
          icon: '🌍', iconBg: '#E8F5F2',
          label: { ka: 'ქვემო ქართლი — მშპ',  en: 'Kvemo Kartli — GDP' },
          value: '9 500', unit: 'მლნ ₾',
        },
        {
          icon: '⚙️', iconBg: '#FEF0EC',
          label: { ka: 'იმერეთი — მშპ',       en: 'Imereti — GDP'      },
          value: '9 000', unit: 'მლნ ₾',
        },
        {
          icon: '🏖️', iconBg: '#FFF8EC',
          label: { ka: 'აჭარა — მშპ',         en: 'Adjara — GDP'       },
          value: '8 500', unit: 'მლნ ₾',
        },
      ],
    },
  ],
}