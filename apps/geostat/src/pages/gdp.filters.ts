import { codesOf }               from '@geostat/engine'
import type { FilterSchemaInput } from '@geostat/engine'
import { GDP_CLASSIFIERS }       from '@/data/gdp/store'

const _years    = (codesOf(GDP_CLASSIFIERS.time) as number[]).slice().sort((a, b) => a - b)
const GDP_FIRST = String(_years[0])
const GDP_LAST  = String(_years[_years.length - 1])

export const GDP_FILTER_SCHEMA: FilterSchemaInput = {
  context: {
    timeMode: 'mode',
    dims:     { time: 'year', fromYear: 'fromYear', toYear: 'toYear' },
  },
  effects: [
    { when: { mode: 'range' },          set: { year: ''                  } },
    { when: { mode: { neq: 'range' } }, set: { fromYear: '', toYear: '' } },
  ],
  bars: {
    'year-bar': {
      position: 'sticky',
      order:    0,
      showWhen: { mode: { neq: 'range' } },
      filters: {
        mode: { type: 'hidden', default: 'year' },
        year: {
          type:    'year-select',
          default: GDP_LAST,
          years:   { type: 'inline', items: { $cl: 'time' }, field: 'code' },
        },
      },
    },
    'range-bar': {
      position: 'sticky',
      order:    0,
      showWhen: { mode: 'range' },
      filters: {
        mode:    { type: 'hidden', default: 'year' },
        fromYear: {
          type:    'select',
          label:   'შუალედი:',
          suffix:  '-დან',
          default: GDP_FIRST,
          options: {
            type:       'inline',
            items:      { $d: 'time' },
            pipe:       [{ op: 'sort', by: 'code', dir: 'asc' }],
            valueField: 'code',
            labelField: 'code',
          },
        },
        toYear: {
          type:    'select',
          suffix:  '-მდე',
          default: GDP_LAST,
          options: {
            type:       'inline',
            items:      { $d: 'time' },
            pipe:       [{ op: 'sort', by: 'code', dir: 'desc' }],
            valueField: 'code',
            labelField: 'code',
          },
        },
      },
    },
  },
}