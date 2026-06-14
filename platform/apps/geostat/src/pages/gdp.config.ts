// ── GDP page config — Track A: InnerPageNode & PageConfigBase ─────────
//
//  Pure NodeDef tree — JSON-serializable, Constructor-ready.
//  Phase 2: this file deleted → manifest.ts fetches from API.
//
import { GDP_SECTIONS }         from './gdp.sections'
import { GDP_KPIS }             from './gdp.kpis'
import { GDP_FILTER_SCHEMA }    from './gdp.filters'
import { codesOf }              from '@geostat/engine'
import { GDP_CLASSIFIERS }      from '@/data/gdp/store'
import type { InnerPageNode }   from '@plugins/pages/inner-page'
import type { PageConfigBase }  from '@geostat/react/engine'

const _years = (codesOf(GDP_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const FIRST  = _years[0]
const LAST   = _years[_years.length - 1]

export const GDP_PAGE: InnerPageNode & PageConfigBase = {
  id:           'gdp',
  type:         'inner-page',
  path:         '/gdp',
  storeKey:     'gdp',
  color:        '#0080BE',
  filterSchema: GDP_FILTER_SCHEMA,
  modeOrder:    ['year', 'range'],
  children: [
    {
      type:   'page-header',
      title:  'მთლიანი შიდა პროდუქტი',
      badge:  { year: 'განახლდა: {time}', range: `${FIRST}–${LAST} · მლნ ₾` },
      crumbs: [{ label: 'მთლიანი შიდა პროდუქტი' }],
    },
    { type: 'filter-bar' },
    { type: 'mode-bar', modes: ['year', 'range'] },
    { type: 'kpi-strip', items: GDP_KPIS },
    ...GDP_SECTIONS,
    {
      type:  'links',
      items: [
        { href: 'https://www.geostat.ge/media/29303/Mtliani-shida-produqtis-metodologia.pdf', label: 'მეთოდოლოგიური განმარტებები', icon: 'doc'  },
        { href: 'https://www.geostat.ge/ka/modules/categories/23/gross-domestic-product-gdp',  label: 'დამატებითი ინფორმაცია',        icon: 'info' },
        { href: 'https://www.geostat.ge',                                                       label: 'საქსტატი — geostat.ge',         icon: 'ext'  },
      ],
    },
  ],
}