// ── Accounts page config — Track A: InnerPageNode & PageConfigBase ────
//
//  Pure NodeDef tree — JSON-serializable, Constructor-ready.
//  Phase 2: this file deleted → manifest.ts fetches from API.
//
import { ACCOUNTS_SECTIONS }                    from './accounts.sections'
import { ACCOUNTS_KPIS }                        from './accounts.kpis'
import { ACCOUNTS_FILTER_SCHEMA }               from './accounts.filters'
import { codesOf }                              from '@geostat/engine'
import { ACCOUNTS_CLASSIFIERS }                 from '@/data/accounts/store'
import type { InnerPageNode }                   from '@plugins/pages/inner-page/default/InnerPageNode'
import type { PageConfigBase }                  from '@geostat/react/engine'
import type { VarMap }                          from '@geostat/engine'

const _years = (codesOf(ACCOUNTS_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const FIRST  = _years[0]
const LAST   = _years[_years.length - 1]

const ACCOUNTS_VARS: VarMap = {
  selectedSectionId: {
    op:  'lookup',
    key: 'account',
    map: {
      production:     'production-account',
      income_gen:     'income-formation',
      primary_dist:   'primary-distribution',
      secondary_dist: 'secondary-distribution',
      capital:        'capital-account',
    },
    fallback: null,
  },
}

export const ACCOUNTS_PAGE: InnerPageNode & PageConfigBase = {
  id:           'accounts',
  type:         'inner-page',
  path:         '/accounts',
  storeKey:     'accounts',
  color:        '#0080BE',
  filterSchema: ACCOUNTS_FILTER_SCHEMA,
  vars:         ACCOUNTS_VARS,
  modeOrder:    ['year', 'range'],
  children: [
    {
      type:   'page-header',
      title:  'ეროვნული ანგარიშების სისტემა',
      badge:  { year: 'განახლდა: {time}', range: `${FIRST}–${LAST}` },
      crumbs: [{ label: 'ეროვნული ანგარიშები' }],
    },
    { type: 'filter-bar' },
    { type: 'mode-bar', modes: ['year', 'range'] },
    { type: 'kpi-strip', items: ACCOUNTS_KPIS },
    ...ACCOUNTS_SECTIONS,
    {
      type:  'links',
      items: [
        { href: 'https://www.geostat.ge/media/48809/metodologiuri-ganmartebebi.pdf',                      label: 'მეთოდოლოგიური განმარტებები', icon: 'doc'  },
        { href: 'https://www.geostat.ge/ka/modules/categories/24/mtliani-erovnuli-shemosavali-mesh',      label: 'დამატებითი ინფორმაცია',        icon: 'info' },
        { href: 'https://www.geostat.ge',                                                                  label: 'საქსტატი — geostat.ge',         icon: 'ext'  },
      ],
    },
  ],
}