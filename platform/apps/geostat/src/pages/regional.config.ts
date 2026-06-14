// ── Regional page config — Track A: InnerPageNode & PageConfigBase ────
//
//  Pure NodeDef tree — JSON-serializable, Constructor-ready.
//  Phase 2: this file deleted → manifest.ts fetches from API.
//
import { REGIONAL_SECTIONS }                from './regional.sections'
import { REGIONAL_KPIS }                    from './regional.kpis'
import { REGIONAL_FILTER_SCHEMA }           from './regional.filters'
import { codesOf }                          from '@geostat/engine'
import { REGIONAL_CLASSIFIERS }             from '@/data/regional/store'
import type { InnerPageNode }               from '@plugins/pages/inner-page/default/InnerPageNode'
import type { PageConfigBase }              from '@geostat/react/engine'
import type { VarMap }                      from '@geostat/engine'

const _years = (codesOf(REGIONAL_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const FIRST  = _years[0]
const LAST   = _years[_years.length - 1]

const REGIONAL_VARS: VarMap = {
  regionObj: {
    op: 'find', source: { $d: 'geo' }, by: 'region', idField: 'code',
  },
  _pageColor: {
    op: 'find', source: { $d: 'geo' }, by: 'region', idField: 'code',
    field: 'color', fallback: '#0080BE',
  },
  _pageCrumbs: {
    op:         'breadcrumbs',
    prefix:     [{ label: 'რეგიონული ანგარიშები' }],
    source:     { $cl: 'geo' },
    by:         'region',
    idField:    'code',
    labelField: 'label',
  },
  _geoMode: { op: 'if', cond: { op: 'includes', left: { $ctx: 'region' }, right: ',' }, then: 'multi', else: 'single' },
  _regionTitle: {
    op: 'join-labels', source: { $d: 'geo' }, by: 'region', idField: 'code', labelField: 'label',
    maxItems: 1, overflow: '',
  },
}

export const REGIONAL_PAGE: InnerPageNode & PageConfigBase = {
  id:           'regional',
  type:         'inner-page',

  path:         '/regional',
  storeKey:     'regional',
  color:        '#0080BE',
  filterSchema: REGIONAL_FILTER_SCHEMA,
  vars:         REGIONAL_VARS,
  modeOrder:    ['year', 'range'],
  children: [
    {
      type:   'page-header',
      title:  'რეგიონული ანგარიშები',
      badge:  { year: 'განახლდა: {time}', range: `${FIRST}–${LAST} · მლნ ₾` },
      crumbs: [{ label: 'რეგიონული ანგარიშები' }],
    },
    { type: 'filter-bar' },
    { type: 'mode-bar', modes: ['year', 'range'] },
    { type: 'kpi-strip', items: REGIONAL_KPIS },
    ...REGIONAL_SECTIONS,
    {
      type:  'links',
      items: [
        { href: 'https://www.geostat.ge/ka/modules/categories/23/mtliani-shida-produkti-mshp', label: 'დამატებითი ინფორმაცია', icon: 'info' },
        { href: 'https://www.geostat.ge',                                                       label: 'საქსტატი — geostat.ge', icon: 'ext'  },
      ],
    },
  ],
}