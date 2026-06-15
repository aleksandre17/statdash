import type { FilterSchemaInput } from '@geostat/engine'

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
          default: { from: 'options', pick: 'last' },
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
          default: { from: 'options', pick: 'first' },
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
          default: { from: 'options', pick: 'last' },
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