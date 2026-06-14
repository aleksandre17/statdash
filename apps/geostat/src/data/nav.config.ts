// ── nav.config.ts — V-12: nav separate from page configs ─────────────
//
//  NavEntry[] = independent of PageConfig/NodePageConfig.
//  Phase 2: this file deleted → nav comes from fetchSiteManifest() API response.
//
import type { NavEntry } from '@geostat/react'

export const NAV: NavEntry[] = [
  {
    id:    'gdp',
    path:  '/gdp',
    color: '#0080BE',
    label: 'მთლიანი შიდა პროდუქტი',
    icon:  'bar-chart',
    items: [
      { label: 'წარმოების მიდგომა',          anchor: 'production'       },
      { label: 'დანახარჯების მიდგომა',       anchor: 'expenditure'      },
      { label: 'შემოსავლების ფორმირება',     anchor: 'income'           },
      { label: 'სტრუქტურული ინდიკატორები',  anchor: 'structural'       },
      { label: 'ზრდის ტემპები',             anchor: 'growth-dynamics'  },
    ],
  },
  {
    id:    'accounts',
    path:  '/accounts',
    color: '#0080BE',
    label: 'ეროვნული ანგარიშები',
    icon:  'document',
    items: [
      { label: 'SNA სრული სტრუქტურა',    anchor: 'sna-hero'           },
      { label: 'წარმოების ანგარიში',      anchor: 'production-account' },
      { label: 'შემოსავლის ფორმირება',   anchor: 'income-formation'   },
      { label: 'კაპიტალის ანგარიში',     anchor: 'capital-account'    },
    ],
  },
  {
    id:    'regional',
    path:  '/regional',
    color: '#0080BE',
    label: 'რეგიონული ანალიზი',
    icon:  'pin',
    items: [
      { label: 'სექტორული სტრუქტურა',    anchor: 'sectors'        },
      { label: 'რეგიონთაშორისი შედარება', anchor: 'comparison'     },
      { label: 'ზრდის ტემპები',          anchor: 'growth-ranking' },
    ],
  },
]